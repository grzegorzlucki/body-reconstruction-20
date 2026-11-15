import { supabase } from "./supabase";
import { backupSchema, defaultTemplate, exerciseById, sessionPlan, type PainLog, type Session, type WorkoutTemplate } from "./domain";
import type { Profile } from "./db";

type Row = Record<string, any>;
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
const siteIds = ["achilles", "pht", "quadriceps"];

async function profiles(): Promise<Profile[]> {
  const owner = await userId();
  let rows: Profile[];
  try {
    rows = checked(await client().from("profiles").select("id,name").eq("owner_user_id", owner));
  } catch (error) {
    throw Error(`Odczyt profili: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!rows.length) {
    const id = crypto.randomUUID();
    try {
      checked(await client().from("profiles").insert({ id, owner_user_id: owner, name: "Profil główny" }));
    } catch (error) {
      throw Error(`Tworzenie profilu: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      await putTemplate({ ...defaultTemplate(), id: crypto.randomUUID(), profileId: id });
    } catch (error) {
      throw Error(`Tworzenie planu startowego: ${error instanceof Error ? error.message : String(error)}`);
    }
    rows = [{ id, name: "Profil główny" }];
  }
  return rows;
}
async function createProfile(name: string): Promise<Profile> {
  const clean = name.trim();
  if (!clean || clean.length > 80) throw Error("Nazwa profilu musi mieć od 1 do 80 znaków.");
  const row = { id: crypto.randomUUID(), name: clean, owner_user_id: await userId() };
  checked(await client().from("profiles").insert(row));
  await putTemplate({ ...defaultTemplate(), id: crypto.randomUUID(), profileId: row.id });
  return { id: row.id, name: row.name };
}

async function templates(profileId: string): Promise<WorkoutTemplate[]> {
  const rows = checked(await client().from("workout_templates").select("id,name").eq("profile_id", profileId));
  if (!rows.length) return [];
  const entries = checked(await client().from("template_exercises").select("*").in("template_id", rows.map((r) => r.id)).order("position"));
  return rows.map((row) => ({ id: row.id, name: row.name, profileId,
    entries: entries.filter((e) => e.template_id === row.id).map((e) => ({
      exerciseId: e.exercise_id, sets: e.set_count, weight: Number(e.weight), reps: e.reps, note: e.note,
      ...(e.timer_config ? { timer: e.timer_config } : {}),
    })),
  }));
}
async function putTemplate(template: WorkoutTemplate) {
  const profileId = template.profileId;
  if (!profileId) throw Error("Brak profilu planu.");
  checked(await client().rpc("save_workout_template", { payload: { ...template, profileId } }));
}

async function logs(profileId: string): Promise<PainLog[]> {
  const rows = checked(await client().from("pain_logs").select("*").eq("profile_id", profileId).order("log_date"));
  if (!rows.length) return [];
  const values = checked(await client().from("pain_log_values").select("*").in("pain_log_id", rows.map((r) => r.id)));
  return rows.map((row) => ({ id: row.id, profileId, date: row.log_date,
    at: row.measured_at, context: row.context, note: row.note,
    values: siteIds.map((site) => values.find((v) => v.pain_log_id === row.id && v.site_id === site)?.value ?? 0),
  }));
}
async function putLog(log: PainLog) {
  if (!log.profileId) throw Error("Brak profilu pomiaru.");
  checked(await client().rpc("save_pain_log", { payload: log }));
}

async function sessions(profileId: string): Promise<Session[]> {
  const rows = checked(await client().from("workout_sessions").select("*").eq("profile_id", profileId).order("started_at"));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const plans = checked(await client().from("session_exercises").select("*").in("session_id", ids).order("position"));
  const sets = checked(await client().from("session_sets").select("*").in("session_id", ids));
  return rows.map((row) => ({
    id: row.id, profileId, started: row.started_at, ...(row.ended_at ? { ended: row.ended_at } : {}),
    note: row.note, ...(row.plan_name ? { planName: row.plan_name } : {}),
    ...(row.source_template_id ? { templateId: row.source_template_id } : {}),
    ...(row.decision ? { decision: row.decision } : {}),
    ...(row.rule_version ? { ruleVersion: row.rule_version } : {}),
    ...(row.edited_at ? { editedAt: row.edited_at } : {}),
    exerciseProgress: row.exercise_progress ?? [],
    plan: plans.filter((p) => p.session_id === row.id).map((p) => ({ exerciseId: p.exercise_id,
      sets: p.planned_sets, weight: Number(p.planned_weight), reps: p.planned_reps, note: p.note,
      ...(p.timer_config ? { timer: p.timer_config } : {}) })),
    sets: sets.filter((s) => s.session_id === row.id).map((s) => ({ exerciseId: s.exercise_id,
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

export const cloudDb = {
  profiles: { toArray: profiles, update: async (id: string, changes: { name: string }) => {
    checked(await client().from("profiles").update(changes).eq("id", id));
  } },
  templates: { where: (_field: string) => ({ equals: (id: string) => ({ toArray: () => templates(id) }) }),
    put: putTemplate, delete: async (id: string) => { checked(await client().from("workout_templates").delete().eq("id", id)); } },
  logs: { where: (_field: string) => ({ equals: (id: string) => ({ sortBy: async (_sort: string) => logs(id) }) }),
    put: putLog, delete: async (id: string) => { checked(await client().from("pain_logs").delete().eq("id", id)); } },
  sessions: { where: (_field: string) => ({ equals: (id: string) => ({ sortBy: async (_sort: string) => sessions(id) }) }),
    put: putSession, add: putSession,
    delete: async (id: string) => { checked(await client().from("workout_sessions").delete().eq("id", id)); } },
};
export { createProfile as createCloudProfile };

export async function exportCloudBackup(profileId: string) {
  const profile = (await profiles()).find((row) => row.id === profileId);
  if (!profile) throw Error("Nie znaleziono profilu.");
  const strip = <T extends { profileId?: string }>(rows: T[]) => rows.map(({ profileId: _id, ...row }) => row);
  return { version: 3 as const, profileName: profile.name, exportedAt: new Date().toISOString(),
    templates: strip(await templates(profileId)), logs: strip(await logs(profileId)), sessions: strip(await sessions(profileId)) };
}

export async function importCloudBackup(raw: unknown, profileId: string) {
  const data = backupSchema.parse(raw);
  const sourceTemplates = data.version === 1 ? [defaultTemplate()] : data.templates!;
  const ids = new Map(sourceTemplates.map((row) => [row.id, crypto.randomUUID()]));
  const payload = {
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
  checked(await client().rpc("replace_profile_data", { target_profile: profileId, payload }));
}
