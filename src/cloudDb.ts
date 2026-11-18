import { supabase } from "./supabase";
import { backupSchema, defaultTemplate, exerciseById, sessionPlan, type Injury, type PainLog, type Session, type SetLog, type WorkoutTemplate } from "./domain";
import type { Profile } from "./db";
import { profileSettingsSchema, type ProfileSettings } from "./domain";

type Row = Record<string, any>;
const pageSize = 500;
async function allPages(page: (start: number, end: number) => Promise<{
  data: Row[] | null; error: { message: string } | null;
}>): Promise<Row[]> {
  const rows: Row[] = [];
  for (let start = 0; ; start += pageSize) {
    const batch = checked(await page(start, start + pageSize - 1));
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}
async function rowsForIds(table: string, column: string, ids: string[], order: string[]): Promise<Row[]> {
  const rows: Row[] = [];
  const batches: string[][] = [];
  for (let offset = 0; offset < ids.length; offset += 50)
    batches.push(ids.slice(offset, offset + 50));
  for (let offset = 0; offset < batches.length; offset += 4) {
    const group = await Promise.all(batches.slice(offset, offset + 4).map((batchIds) =>
      allPages(async (start, end) => {
        let query = client().from(table).select("*").in(column, batchIds);
        for (const field of order) query = query.order(field);
        return await query.range(start, end);
      })));
    for (const batch of group) rows.push(...batch);
  }
  return rows;
}
function groupRows(rows: Row[], key: string): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const id = String(row[key]);
    const group = grouped.get(id) ?? [];
    group.push(row);
    grouped.set(id, group);
  }
  return grouped;
}
const client = () => {
  if (!supabase) throw Error("Brak konfiguracji Supabase.");
  return supabase;
};
const checked = <T>(result: { data: T | null; error: { message: string } | null }): T => {
  if (result.error) throw Error(result.error.message);
  return result.data as T;
};
const userId = async () => {
  const { data: { user }, error } = await client().auth.getUser();
  if (error || !user) throw Error("Sesja wygasła. Zaloguj się ponownie.");
  return user.id;
};
// PostgreSQL returns timestamptz with an offset (often +00:00), while the
// application stores timestamps as canonical UTC ISO strings ending in Z.
export function cloudTimestamp(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw Error(`Nieprawidłowa data z Supabase: ${value}`);
  return timestamp.toISOString();
}

async function insertProfileWithStarter(id: string, name: string) {
  const template = { ...defaultTemplate(), id: crypto.randomUUID() };
  const result = await client().rpc("create_profile_with_template", {
    payload: { id, name, template },
  });
  if (!result.error) return;
  if (result.error.code === "PGRST202")
    throw Error("Brak migracji profilu konta. Zastosuj 20261116_account_profile_settings.sql w Supabase SQL Editor.");
  throw Error(`Tworzenie profilu: ${result.error.message}`);
}

async function profiles(): Promise<Profile[]> {
  const owner = await userId();
  let rows: Row[];
  try {
    rows = await allPages(async (start, end) => await client().from("profiles")
      .select("*").eq("owner_user_id", owner).order("id").range(start, end));
  } catch (error) {
    throw Error(`Odczyt profili: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!rows.length) {
    const id = owner;
    try {
      await insertProfileWithStarter(id, "Profil główny");
    } catch (error) {
      // A second tab may have created the same deterministic profile first.
      if (!(error instanceof Error) || !(error.message.includes("duplicate key") || error.message.includes("already has its profile"))) throw error;
    }
    rows = await allPages(async (start, end) => await client().from("profiles")
      .select("*").eq("owner_user_id", owner).order("id").range(start, end));
    if (!rows.length) throw Error("Nie udało się utworzyć profilu głównego.");
  }
  const profileIds = rows.map((row) => row.id as string);
  const [sites, contexts, injuries, injurySites] = profileIds.length ? await Promise.all([
    allPages(async (start, end) => await client().from("profile_rehab_sites")
      .select("profile_id,id,name,body_area,position,active,archived").in("profile_id", profileIds)
      .order("profile_id").order("position").range(start, end)),
    allPages(async (start, end) => await client().from("profile_pain_contexts")
      .select("profile_id,value,label,position,active").in("profile_id", profileIds)
      .order("profile_id").order("position").range(start, end)),
    allPages(async (start, end) => await client().from("profile_injuries")
      .select("profile_id,id,name,side,started_on,resolved_on,status,note,position")
      .in("profile_id", profileIds).order("profile_id").order("position").range(start, end)),
    allPages(async (start, end) => await client().from("injury_rehab_sites")
      .select("profile_id,injury_id,site_id").in("profile_id", profileIds)
      .order("profile_id").order("site_id").range(start, end)),
  ]) : [[], [], [], []];
  const sitesByProfile = groupRows(sites, "profile_id"), contextsByProfile = groupRows(contexts, "profile_id"),
    injuriesByProfile = groupRows(injuries, "profile_id"), injurySitesById = groupRows(injurySites, "injury_id");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    timeZone: row.time_zone ?? "Europe/Warsaw", avatarPath: row.avatar_path ?? null,
    weeklyGoal: row.weekly_goal,
    checkInTime: String(row.check_in_time).slice(0, 5),
    rehabSites: (sitesByProfile.get(row.id) ?? []).map((site) => ({
      id: site.id, name: site.name, bodyArea: site.body_area,
      position: site.position, active: site.active, archived: site.archived,
    })),
    painContexts: (contextsByProfile.get(row.id) ?? []).map((context) => ({
      value: context.value, label: context.label, position: context.position, active: context.active,
    })),
    injuries: (injuriesByProfile.get(row.id) ?? []).map((injury) => ({
      id: injury.id, name: injury.name, side: injury.side, startedOn: injury.started_on,
      ...(injury.resolved_on ? { resolvedOn: injury.resolved_on } : {}),
      status: injury.status, note: injury.note,
      position: injury.position,
      siteIds: (injurySitesById.get(injury.id) ?? []).filter((link) => link.profile_id === row.id)
        .map((link) => link.site_id),
    } satisfies Injury)),
  }));
}
async function templates(profileId: string): Promise<WorkoutTemplate[]> {
  const rows = await allPages(async (start, end) => await client().from("workout_templates")
    .select("id,name").eq("profile_id", profileId).order("id").range(start, end));
  if (!rows.length) return [];
  const entries = await rowsForIds("template_exercises", "template_id", rows.map((r) => r.id), ["template_id", "position"]);
  const byTemplate = groupRows(entries, "template_id");
  return rows.map((row) => ({ id: row.id, name: row.name, profileId,
    entries: (byTemplate.get(row.id) ?? []).map((e) => ({
      exerciseId: e.exercise_id, sets: e.set_count, weight: Number(e.weight), reps: e.reps, note: e.note,
      ...(e.timer_config ? { timer: e.timer_config } : {}),
    })),
  }));
}
async function putTemplate(template: WorkoutTemplate) {
  const profileId = template.profileId;
  if (!profileId) throw Error("Brak profilu planu.");
  const result = await client().rpc("save_workout_template", { payload: { ...template, profileId } });
  if (result.error) {
    if (result.error.code === "PGRST202" || result.error.message.includes("schema cache"))
      throw Error("Brak funkcji zapisu planów w Supabase. Uruchom migracje 20261115_atomic_writes.sql oraz 20261115_exercise_timers.sql w SQL Editor.");
    if (result.error.code === "23503" && result.error.message.includes("template_exercises_exercise_id_fkey"))
      throw Error("W bazie Supabase brakuje ćwiczeń użytych w planie. Uruchom migrację 20261115_exercise_catalog_seed.sql w SQL Editor.");
    throw Error(`Nie udało się zapisać planu: ${result.error.message}`);
  }
}

async function logs(profileId: string): Promise<PainLog[]> {
  const rows = await allPages(async (start, end) => await client().from("pain_logs")
    .select("*").eq("profile_id", profileId).order("log_date").order("id").range(start, end));
  if (!rows.length) return [];
  const [values, injuryLinks] = await Promise.all([
    rowsForIds("pain_log_values", "pain_log_id", rows.map((r) => r.id), ["pain_log_id", "site_id"]),
    rowsForIds("pain_log_injuries", "pain_log_id", rows.map((r) => r.id), ["pain_log_id", "injury_id"]),
  ]);
  const byLog = groupRows(values, "pain_log_id");
  const injuriesByLog = groupRows(injuryLinks, "pain_log_id");
  return rows.map((row) => ({ id: row.id, profileId, date: row.log_date,
    at: cloudTimestamp(row.measured_at), context: row.context, note: row.note,
    injuryIds: (injuriesByLog.get(row.id) ?? []).map((link) => link.injury_id),
    values: (byLog.get(row.id) ?? []).map((value) => ({ siteId: value.site_id, value: value.value })),
  }));
}
async function putLog(log: PainLog) {
  if (!log.profileId) throw Error("Brak profilu pomiaru.");
  const result = await client().rpc("save_pain_log_with_injuries", { payload: log });
  if (result.error?.code === "PGRST202") throw Error("Brak migracji kontuzji i analiz. Zastosuj 20261117_injuries_analytics.sql w Supabase SQL Editor.");
  checked(result);
}

async function sessions(profileId: string): Promise<Session[]> {
  const rows = await allPages(async (start, end) => await client().from("workout_sessions")
    .select("*").eq("profile_id", profileId).order("started_at").order("id").range(start, end));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [plans, sets] = await Promise.all([
    rowsForIds("session_exercises", "session_id", ids, ["session_id", "position"]),
    rowsForIds("session_sets", "session_id", ids, ["session_id", "exercise_id", "side", "set_index"]),
  ]);
  const plansBySession = groupRows(plans, "session_id");
  const setsBySession = groupRows(sets, "session_id");
  return rows.map((row) => ({
    id: row.id, profileId, started: cloudTimestamp(row.started_at),
    ...(row.ended_at ? { ended: cloudTimestamp(row.ended_at) } : {}),
    note: row.note, ...(row.plan_name ? { planName: row.plan_name } : {}),
    ...(row.source_template_id ? { templateId: row.source_template_id } : {}),
    ...(row.decision ? { decision: row.decision } : {}),
    ...(row.rule_version ? { ruleVersion: row.rule_version } : {}),
    ...(row.edited_at ? { editedAt: cloudTimestamp(row.edited_at) } : {}),
    exerciseProgress: row.exercise_progress ?? [],
    plan: (plansBySession.get(row.id) ?? []).map((p) => ({ exerciseId: p.exercise_id,
      sets: p.planned_sets, weight: Number(p.planned_weight), reps: p.planned_reps, note: p.note,
      ...(p.timer_config ? { timer: p.timer_config } : {}) })),
    sets: (setsBySession.get(row.id) ?? []).map((s) => ({ exerciseId: s.exercise_id,
      side: s.side as "L" | "P" | "both", index: s.set_index, weight: Number(s.weight), reps: s.reps, done: s.done })),
  }));
}
async function putSession(session: Session) {
  if (!session.profileId) throw Error("Brak profilu treningu.");
  checked(await client().rpc("save_workout_session", { payload: {
    ...session,
    templateId: session.templateId && /^[0-9a-f-]{36}$/i.test(session.templateId) ? session.templateId : null,
    plan: (session.plan ?? []).map((entry) => ({ ...entry,
      exerciseName: exerciseById(entry.exerciseId).name,
      unilateral: exerciseById(entry.exerciseId).unilateral,
    })),
  } }));
}

export async function saveCloudSessionSets(session: Session, changed: SetLog[]) {
  const result = await client().rpc("update_session_sets", {
    payload: { sessionId: session.id, sets: changed },
  });
  if (!result.error) return;
  // Existing deployments may not have the targeted-write migration yet.
  if (result.error.code === "PGRST202") {
    await putSession(session);
    return;
  }
  throw Error(`Nie udało się zapisać serii: ${result.error.message}`);
}

export const cloudDb = {
  profiles: { toArray: profiles, update: async (id: string, changes: ProfileSettings) => {
    const settings = profileSettingsSchema.parse(changes);
    const result = await client().rpc("save_profile_settings_with_archiving", { payload: { profileId: id, ...settings } });
    if (result.error?.code === "PGRST202") throw Error("Brak migracji archiwizacji obszarów. Zastosuj 20261118_rehab_site_archiving.sql w Supabase SQL Editor.");
    checked(result);
  } },
  templates: { where: (_field: string) => ({ equals: (id: string) => ({ toArray: () => templates(id) }) }),
    put: putTemplate, delete: async (id: string) => { checked(await client().from("workout_templates").delete().eq("id", id)); } },
  logs: { where: (_field: string) => ({ equals: (id: string) => ({ sortBy: async (_sort: string) => logs(id) }) }),
    put: putLog, delete: async (id: string) => { checked(await client().from("pain_logs").delete().eq("id", id)); } },
  sessions: { where: (_field: string) => ({ equals: (id: string) => ({ sortBy: async (_sort: string) => sessions(id) }) }),
    put: putSession, add: putSession,
    delete: async (id: string) => { checked(await client().from("workout_sessions").delete().eq("id", id)); } },
};

export async function exportCloudBackup(profileId: string) {
  const profile = (await profiles()).find((row) => row.id === profileId);
  if (!profile) throw Error("Nie znaleziono profilu.");
  const strip = <T extends { profileId?: string }>(rows: T[]) => rows.map(({ profileId: _id, ...row }) => row);
  return { version: 5 as const, profileName: profile.name,
    profileSettings: { name: profile.name, weeklyGoal: profile.weeklyGoal,
      checkInTime: profile.checkInTime, rehabSites: profile.rehabSites, painContexts: profile.painContexts,
      injuries: profile.injuries },
    exportedAt: new Date().toISOString(),
    templates: strip(await templates(profileId)), logs: strip(await logs(profileId)), sessions: strip(await sessions(profileId)) };
}

export async function importCloudBackup(raw: unknown, profileId: string) {
  const data = backupSchema.parse(raw);
  const sourceTemplates = data.version === 1 ? [defaultTemplate()] : data.templates!;
  const ids = new Map(sourceTemplates.map((row) => [row.id, crypto.randomUUID()]));
  const payload = {
    profileSettings: data.profileSettings,
    templates: sourceTemplates.map((row) => ({ ...row, id: ids.get(row.id), profileId,
      entries: row.entries.map((entry) => ({ ...entry })) })),
    logs: data.logs.map((row) => ({ ...row, id: crypto.randomUUID(), profileId })),
    sessions: data.sessions.map((row) => ({ ...row, id: crypto.randomUUID(), profileId,
      templateId: row.templateId ? ids.get(row.templateId) ?? null : null,
      plan: sessionPlan(row).map((entry) => ({ ...entry,
        exerciseName: exerciseById(entry.exerciseId).name,
        unilateral: exerciseById(entry.exerciseId).unilateral,
      })),
    })),
  };
  const result = await client().rpc("replace_profile_data_with_injuries", { target_profile: profileId, payload });
  if (result.error?.code === "PGRST202") throw Error("Brak migracji kontuzji i analiz. Zastosuj 20261117_injuries_analytics.sql w Supabase SQL Editor.");
  checked(result);
}
