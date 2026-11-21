import { message as systemMessage } from "./i18n/config";
import { cachedResource, invalidateResources, patchResource } from "./app/resourceCache";
import { isPreference, readPreference, storePreference } from "./i18n/config";
import { remapMeasurementSessions } from "./analytics/metrics";
import { supabase } from "./supabase";
import { backupSchema, defaultTemplate, exerciseById, sessionPlan, type Injury, type PainLog, type Session, type SetLog, type WorkoutTemplate } from "./domain";
import type { Profile } from "./db";
import { profileSettingsSchema, type ProfileSettings } from "./domain";

type Row = Record<string, any>;
async function recordPages(resource: "sessions" | "logs", profileId: string, signal?: AbortSignal, since?: string): Promise<Row[] | null> {
  const result: Row[] = [];
  let before: Row | undefined;
  for (;;) {
    const response = await client().rpc("read_record_page_v1", { target_profile: profileId, resource, page_size: 50,
      ...(before ? { before_time: before[resource === "sessions" ? "started_at" : "measured_at"], before_id: before.id } : {}),
      ...(since ? { since_date: since } : {}) }, { get: true }).abortSignal(signal ?? new AbortController().signal);
    if (response.error?.code === "PGRST202" && !before) return null;
    checked(response);
    if (!response.data || !Array.isArray(response.data.items)) throw Error("Invalid paginated API response");
    const items = response.data.items as Row[];
    result.push(...items);
    if (items.length < 50) return result;
    const next = items.at(-1)!;
    if (before?.id === next.id) throw Error("Invalid API cursor");
    before = next;
  }
}
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
async function rowsForIds(table: string, column: string, ids: string[], order: string[], signal?: AbortSignal): Promise<Row[]> {
  const rows: Row[] = [];
  const batches: string[][] = [];
  for (let offset = 0; offset < ids.length; offset += 50)
    batches.push(ids.slice(offset, offset + 50));
  for (let offset = 0; offset < batches.length; offset += 4) {
    const group = await Promise.all(batches.slice(offset, offset + 4).map((batchIds) =>
      allPages(async (start, end) => {
        let query = client().from(table).select("*").in(column, batchIds);
        for (const field of order) query = query.order(field);
        return await query.range(start, end).abortSignal(signal ?? new AbortController().signal);
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
  if (Number.isNaN(timestamp.getTime())) throw Error(systemMessage("Nieprawidłowa data z Supabase: {{v0}}",{v0: value}));
  return timestamp.toISOString();
}

async function insertProfileWithStarter(id: string, name: string) {
  const template = { ...defaultTemplate(), id: crypto.randomUUID() };
  const result = await client().rpc("create_profile_with_template", {
    payload: { id, name, template },
  });
  if (!result.error) {
    const preference = readPreference();
    if (preference) {
      // Only a newly created profile adopts the explicit pre-login choice.
      // A missing language migration must not prevent account creation.
      storePreference(preference, id, true);
      try {
        const saved = await client().rpc("update_profile_language", { target_profile_id: id, language_preference: preference });
        if (!saved.error) storePreference(preference, id);
      } catch { /* Keep the pending preference and let the user retry. */ }
    }
    return;
  }
  if (result.error.code === "PGRST202")
    throw Error("Brak migracji profilu konta. Zastosuj 20261116_account_profile_settings.sql w Supabase SQL Editor.");
  throw Error(`Tworzenie profilu: ${result.error.message}`);
}

async function profiles(ownerId?: string, signal?: AbortSignal): Promise<Profile[]> {
  const owner = ownerId ?? await userId();
  let rows: Row[];
  try {
    rows = await allPages(async (start, end) => await client().from("profiles")
      .select("*").eq("owner_user_id", owner).order("id").range(start, end).abortSignal(signal ?? new AbortController().signal));
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
      .select("*").eq("owner_user_id", owner).order("id").range(start, end).abortSignal(signal ?? new AbortController().signal));
    if (!rows.length) throw Error("Nie udało się utworzyć profilu głównego.");
  }
  const profileIds = rows.map((row) => row.id as string);
  const [sites, contexts, injuries, injurySites] = profileIds.length ? await Promise.all([
    allPages(async (start, end) => await client().from("profile_rehab_sites")
      .select("profile_id,id,name,body_area,position,active,archived").in("profile_id", profileIds)
      .order("profile_id").order("position").range(start, end).abortSignal(signal ?? new AbortController().signal)),
    allPages(async (start, end) => await client().from("profile_pain_contexts")
      .select("profile_id,value,label,position,active").in("profile_id", profileIds)
      .order("profile_id").order("position").range(start, end).abortSignal(signal ?? new AbortController().signal)),
    allPages(async (start, end) => await client().from("profile_injuries")
      .select("profile_id,id,name,side,started_on,resolved_on,status,note,position")
      .in("profile_id", profileIds).order("profile_id").order("position").range(start, end).abortSignal(signal ?? new AbortController().signal)),
    allPages(async (start, end) => await client().from("injury_rehab_sites")
      .select("profile_id,injury_id,site_id").in("profile_id", profileIds)
      .order("profile_id").order("site_id").range(start, end).abortSignal(signal ?? new AbortController().signal)),
  ]) : [[], [], [], []];
  const sitesByProfile = groupRows(sites, "profile_id"), contextsByProfile = groupRows(contexts, "profile_id"),
    injuriesByProfile = groupRows(injuries, "profile_id"), injurySitesById = groupRows(injurySites, "injury_id");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    preferredLanguage: isPreference(row.preferred_language) ? row.preferred_language : "pl",
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
async function templates(profileId: string, signal?: AbortSignal): Promise<WorkoutTemplate[]> {
  const rows = await allPages(async (start, end) => await client().from("workout_templates")
    .select("id,name").eq("profile_id", profileId).order("id").range(start, end).abortSignal(signal ?? new AbortController().signal));
  if (!rows.length) return [];
  const entries = await rowsForIds("template_exercises", "template_id", rows.map((r) => r.id), ["template_id", "position"], signal);
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
    throw Error(systemMessage("Nie udało się zapisać planu: {{v0}}",{v0: result.error.message}));
  }
}

async function logs(profileId: string, signal?: AbortSignal, since?: string): Promise<PainLog[]> {
  const embedded = await recordPages("logs", profileId, signal, since);
  const rows = embedded ?? await allPages(async (start, end) => await client().from("pain_logs")
    .select("*").eq("profile_id", profileId).gte("log_date", since ?? "0001-01-01").order("log_date").order("id").range(start, end).abortSignal(signal ?? new AbortController().signal));
  if (!rows.length) return [];
  const [values, injuryLinks] = embedded ? [rows.flatMap(row => row.values), rows.flatMap(row => row.injuries)] : await Promise.all([
    rowsForIds("pain_log_values", "pain_log_id", rows.map((r) => r.id), ["pain_log_id", "site_id"], signal),
    rowsForIds("pain_log_injuries", "pain_log_id", rows.map((r) => r.id), ["pain_log_id", "injury_id"], signal),
  ]);
  const byLog = groupRows(values, "pain_log_id");
  const injuriesByLog = groupRows(injuryLinks, "pain_log_id");
  return rows.map((row) => ({ id: row.id, profileId, date: row.log_date,
    sessionId: row.session_id ?? undefined, measurementPhase: row.measurement_phase ?? "unspecified",
    at: cloudTimestamp(row.measured_at), context: row.context, note: row.note,
    injuryIds: (injuriesByLog.get(row.id) ?? []).map((link) => link.injury_id),
    values: (byLog.get(row.id) ?? []).map((value) => ({ siteId: value.site_id, value: value.value })),
  }));
}
async function putLog(log: PainLog) {
  if (!log.profileId) throw Error("Brak profilu pomiaru.");
  const result = await client().rpc("save_pain_log_analytics", { payload: log });
  if (result.error?.code === "PGRST202") throw Error("Brak migracji powiązań analiz. Zastosuj 20261121_analytics_links.sql w Supabase SQL Editor.");
  checked(result);
}

async function sessions(profileId: string, signal?: AbortSignal, since?: string): Promise<Session[]> {
  const embedded = await recordPages("sessions", profileId, signal, since);
  const rows = embedded ?? await allPages(async (start, end) => await client().from("workout_sessions")
    .select("*").eq("profile_id", profileId).order("started_at").order("id").range(start, end).abortSignal(signal ?? new AbortController().signal));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [plans, sets] = embedded ? [rows.flatMap(row => row.plans), rows.flatMap(row => row.sets)] : await Promise.all([
    rowsForIds("session_exercises", "session_id", ids, ["session_id", "position"], signal),
    rowsForIds("session_sets", "session_id", ids, ["session_id", "exercise_id", "side", "set_index"], signal),
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
    completionReason: row.completion_reason ?? "unspecified",
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
  const result = await client().rpc("save_workout_session_analytics", { payload: {
    ...session,
    templateId: session.templateId && /^[0-9a-f-]{36}$/i.test(session.templateId) ? session.templateId : null,
    plan: (session.plan ?? []).map((entry) => ({ ...entry,
      exerciseName: exerciseById(entry.exerciseId).name,
      unilateral: exerciseById(entry.exerciseId).unilateral,
    })),
  } });
  if (result.error?.code === "PGRST202") throw Error("Brak migracji powiązań analiz. Zastosuj 20261121_analytics_links.sql w Supabase SQL Editor.");
  checked(result);
}

export async function saveCloudSessionSets(session: Session, changed: SetLog[]) {
  const result = await client().rpc("update_session_sets", {
    payload: { sessionId: session.id, sets: changed },
  });
  if (!result.error) { invalidateResources(`recent-sessions:${session.profileId}`); patchResource<Session[]>(`sessions:${session.profileId}`, rows => rows.map(row => row.id === session.id ? session : row)); return; }
  // Existing deployments may not have the targeted-write migration yet.
  if (result.error.code === "PGRST202") {
    await putSession(session);
    invalidateResources(`recent-sessions:${session.profileId}`); patchResource<Session[]>(`sessions:${session.profileId}`, rows => rows.map(row => row.id === session.id ? session : row));
    return;
  }
  throw Error(systemMessage("Nie udało się zapisać serii: {{v0}}",{v0: result.error.message}));
}

function remember<T extends { id: string }>(key: string, value: T) {
  patchResource<T[]>(key, rows => [...rows.filter(row => row.id !== value.id), value]);
}
export const cloudDb = {
  readRecent: async (id: string) => {
    const date = new Date(); date.setDate(date.getDate() - 90);
    const since = date.toISOString().slice(0,10);
    const [recentSessions, recentLogs, plans] = await Promise.all([
      cachedResource(`recent-sessions:${id}`, signal => sessions(id, signal, since)),
      cachedResource(`recent-logs:${id}`, signal => logs(id, signal, since)),
      cachedResource(`templates:${id}`, signal => templates(id, signal), 120000),
    ]);
    return { sessions: recentSessions.sort((a,b) => a.started.localeCompare(b.started) || a.id.localeCompare(b.id)), logs: recentLogs.sort((a,b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at)), templates: plans };
  },
  profiles: { toArray: async () => { const owner = (await client().auth.getSession()).data.session?.user.id ?? await userId(); return cachedResource(`profiles:${owner}`, signal => profiles(owner, signal), 120000); }, update: async (id: string, changes: ProfileSettings) => {
    const settings = profileSettingsSchema.parse(changes);
    const result = await client().rpc("save_profile_settings_with_archiving", { payload: { profileId: id, ...settings } });
    if (result.error?.code === "PGRST202") throw Error("Brak migracji archiwizacji obszarów. Zastosuj 20261118_rehab_site_archiving.sql w Supabase SQL Editor.");
    checked(result);
    invalidateResources("profiles:");
  } },
  templates: { where: (_field: string) => ({ equals: (id: string) => ({ toArray: () => cachedResource(`templates:${id}`, signal => templates(id, signal), 120000) }) }),
    put: async (value: WorkoutTemplate) => { await putTemplate(value); remember(`templates:${value.profileId}`, value); }, delete: async (id: string) => { checked(await client().from("workout_templates").delete().eq("id", id)); invalidateResources("templates:"); } },
  logs: { where: (_field: string) => ({ equals: (id: string) => ({ sortBy: async (_sort: string) => cachedResource(`logs:${id}`, signal => logs(id, signal)).then(rows => rows.sort((a,b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at) || a.id.localeCompare(b.id))) }) }),
    put: async (value: PainLog) => { await putLog(value); invalidateResources(`recent-logs:${value.profileId}`); remember(`logs:${value.profileId}`, value); }, delete: async (id: string) => { checked(await client().from("pain_logs").delete().eq("id", id)); invalidateResources("logs:"); invalidateResources("recent-logs:"); } },
  sessions: { where: (_field: string) => ({ equals: (id: string) => ({ sortBy: async (_sort: string) => cachedResource(`sessions:${id}`, signal => sessions(id, signal)).then(rows => rows.sort((a,b) => a.started.localeCompare(b.started) || a.id.localeCompare(b.id))) }) }),
    put: async (value: Session) => { await putSession(value); invalidateResources(`recent-sessions:${value.profileId}`); remember(`sessions:${value.profileId}`, value); }, add: async (value: Session) => { await putSession(value); invalidateResources(`recent-sessions:${value.profileId}`); remember(`sessions:${value.profileId}`, value); },
    delete: async (id: string) => { checked(await client().from("workout_sessions").delete().eq("id", id)); invalidateResources("sessions:"); invalidateResources("logs:"); invalidateResources("recent-sessions:"); invalidateResources("recent-logs:"); } },
};

export async function exportCloudBackup(profileId: string) {
  const profile = (await profiles()).find((row) => row.id === profileId);
  if (!profile) throw Error("Nie znaleziono profilu.");
  const strip = <T extends { profileId?: string }>(rows: T[]) => rows.map(({ profileId: _id, ...row }) => row);
  return { version: 6 as const, profileName: profile.name,
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
  const sessionIds = new Map(data.sessions.map((row) => [row.id, crypto.randomUUID()]));
  const payload = {
    profileSettings: data.profileSettings,
    templates: sourceTemplates.map((row) => ({ ...row, id: ids.get(row.id), profileId,
      entries: row.entries.map((entry) => ({ ...entry })) })),
    logs: remapMeasurementSessions(data.logs, sessionIds).map((row) => ({ ...row, id: crypto.randomUUID(), profileId })),
    sessions: data.sessions.map((row) => ({ ...row, id: sessionIds.get(row.id), profileId,
      templateId: row.templateId ? ids.get(row.templateId) ?? null : null,
      plan: sessionPlan(row).map((entry) => ({ ...entry,
        exerciseName: exerciseById(entry.exerciseId).name,
        unilateral: exerciseById(entry.exerciseId).unilateral,
      })),
    })),
  };
  const result = await client().rpc("replace_profile_data_analytics", { target_profile: profileId, payload });
  if (result.error?.code === "PGRST202") throw Error("Brak migracji powiązań analiz. Zastosuj 20261121_analytics_links.sql w Supabase SQL Editor.");
  checked(result);
  invalidateResources("profiles:"); invalidateResources(`sessions:${profileId}`); invalidateResources(`logs:${profileId}`); invalidateResources(`templates:${profileId}`); invalidateResources(`recent-sessions:${profileId}`); invalidateResources(`recent-logs:${profileId}`);
}
