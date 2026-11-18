import { z } from "zod";
import { validTimer, type TimerSettings } from "./intervalTimer";
export const accountIdentitySchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę profilu.").max(80),
  timeZone: z.string().min(1).max(100).refine((value) => {
    try { new Intl.DateTimeFormat("pl-PL", { timeZone: value }); return true; } catch { return false; }
  }, "Wybierz poprawną strefę czasową."),
});
export const defaultRehabSites: RehabSite[] = [
  { id: "achilles", name: "Achilles", bodyArea: "Staw skokowy", position: 0, active: true, archived: false },
  { id: "pht", name: "PHT", bodyArea: "Tył uda", position: 1, active: true, archived: false },
  { id: "quadriceps", name: "Czworogłowy", bodyArea: "Przód uda", position: 2, active: true, archived: false },
];
export const defaultPainContexts: PainContext[] = [
  { value: "spacer", label: "Spacer", position: 0, active: true },
  { value: "cwiczenie", label: "Ćwiczenie", position: 1, active: true },
  { value: "spoczynek", label: "Spoczynek", position: 2, active: true },
  { value: "inne", label: "Inne", position: 3, active: true },
];
export const rehabSiteSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(100),
  bodyArea: z.string().trim().min(1).max(100),
  position: z.number().int().min(0).max(100),
  active: z.boolean(),
  archived: z.boolean().default(false),
});
export type RehabSite = z.infer<typeof rehabSiteSchema>;
export const painContextSchema = z.object({
  value: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(100),
  position: z.number().int().min(0).max(100),
  active: z.boolean(),
});
export type PainContext = z.infer<typeof painContextSchema>;
export const injurySchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(100),
  side: z.enum(["left", "right", "both", "unspecified"]),
  startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resolvedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["active", "paused", "resolved"]),
  siteIds: z.array(z.string().min(1).max(80)).min(1, "Przypisz co najmniej jeden monitorowany obszar do każdej kontuzji.").max(50),
  note: z.string().max(1000),
  position: z.number().int().min(0).max(100),
});
export type Injury = z.infer<typeof injurySchema>;
export const profileSettingsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  weeklyGoal: z.number().int().min(0).max(14),
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  rehabSites: z.array(rehabSiteSchema).min(1).max(50),
  painContexts: z.array(painContextSchema).max(30),
  injuries: z.array(injurySchema).max(50).default([]),
}).superRefine((settings, ctx) => {
  if (new Set(settings.rehabSites.map((site) => site.id)).size !== settings.rehabSites.length)
    ctx.addIssue({ code: "custom", message: "Powtórzony identyfikator obszaru rehabilitacji" });
  if (new Set(settings.rehabSites.map((site) => site.name.toLocaleLowerCase())).size !== settings.rehabSites.length)
    ctx.addIssue({ code: "custom", message: "Nazwy obszarów rehabilitacji muszą być unikalne" });
  const editableSites = settings.rehabSites.filter((site) => !site.archived);
  if (new Set(editableSites.map((site) => site.position)).size !== editableSites.length)
    ctx.addIssue({ code: "custom", message: "Pozycje obszarów rehabilitacji muszą być unikalne" });
  if (new Set(settings.painContexts.map((context) => context.value)).size !== settings.painContexts.length)
    ctx.addIssue({ code: "custom", message: "Powtórzony kontekst pomiaru" });
  if (new Set(settings.painContexts.map((context) => context.position)).size !== settings.painContexts.length)
    ctx.addIssue({ code: "custom", message: "Pozycje kontekstów muszą być unikalne" });
  if (new Set(settings.painContexts.map((context) => context.label.toLocaleLowerCase())).size !== settings.painContexts.length)
    ctx.addIssue({ code: "custom", message: "Nazwy kontekstów muszą być unikalne" });
  if (!editableSites.length || !editableSites.some((site) => site.active))
    ctx.addIssue({ code: "custom", message: "Wybierz co najmniej jeden obszar do monitorowania" });
  if (settings.rehabSites.some((site) => site.archived && site.active))
    ctx.addIssue({ code: "custom", message: "Usunięty obszar nie może być aktywny" });
  if (new Set(settings.injuries.map((injury) => injury.id)).size !== settings.injuries.length)
    ctx.addIssue({ code: "custom", message: "Powtórzony identyfikator kontuzji" });
  for (const injury of settings.injuries) {
    if (new Set(injury.siteIds).size !== injury.siteIds.length)
      ctx.addIssue({ code: "custom", message: "Obszar nie może być przypisany do kontuzji więcej niż raz" });
    if (injury.siteIds.some((id) => !settings.rehabSites.some((site) => site.id === id)))
      ctx.addIssue({ code: "custom", message: "Kontuzja wskazuje nieznany obszar monitorowania" });
    if (injury.resolvedOn && injury.resolvedOn < injury.startedOn)
      ctx.addIssue({ code: "custom", message: "Data zakończenia nie może poprzedzać daty rozpoczęcia" });
  }
});
export type ProfileSettings = z.infer<typeof profileSettingsSchema>;
import {
  exercises,
  exerciseCatalog,
  exerciseById,
  type Exercise,
} from "./catalog";
export {
  exercises,
  exerciseCatalog,
  exerciseById,
  type Exercise,
} from "./catalog";
export const doseSchema = z.object({
  weight: z.number().min(0).max(500),
  reps: z.number().int().min(0).max(50),
});
export type Dose = z.infer<typeof doseSchema>;
export const exerciseIdSchema = z
  .string()
  .refine(
    (id) => exerciseCatalog.some((e) => e.id === id),
    "Nieznane ćwiczenie",
  );
export const exerciseTimerSchema = z.object({
  prepare: z.number().int().min(0).max(3600),
  move1: z.number().int().min(0).max(3600),
  hold: z.number().int().min(0).max(3600),
  move2: z.number().int().min(0).max(3600),
  rest: z.number().int().min(0).max(3600),
  sound: z.boolean(),
  unilateral: z.boolean().optional(),
  sidePrepare: z.number().int().min(0).max(3600).optional(),
  firstSide: z.enum(["L", "P"]).optional(),
}).refine((value) => value.move1 + value.hold + value.move2 > 0, "Co najmniej jedna faza ruchu musi trwać dłużej niż 0 sekund");
export type ExerciseTimer = z.infer<typeof exerciseTimerSchema>;
export function timerForEntry(entry: PlanEntry): TimerSettings | null {
  if (!entry.timer || entry.reps < 1) return null;
  const settings = { ...entry.timer, sets: entry.sets, reps: entry.reps };
  return validTimer(settings) ? settings : null;
}
export const planEntrySchema = z.object({
  exerciseId: exerciseIdSchema,
  sets: z.number().int().min(1).max(10),
  weight: z.number().min(0).max(500),
  reps: z.number().int().min(0).max(50),
  note: z.string().max(1000),
  timer: exerciseTimerSchema.optional(),
}).refine((entry) => !entry.timer || entry.reps >= 1, "Zegar wymaga co najmniej jednego powtórzenia");
export const planEntriesSchema = z
  .array(planEntrySchema)
  .min(1)
  .max(30)
  .refine(
    (entries) =>
      new Set(entries.map((e) => e.exerciseId)).size === entries.length,
    "Ćwiczenie może wystąpić w planie tylko raz",
  );
export const templateSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  entries: planEntriesSchema,
});
export type PlanEntry = z.infer<typeof planEntrySchema>;
export type WorkoutTemplate = z.infer<typeof templateSchema>;
export function defaultTemplate(): WorkoutTemplate {
  return {
    id: "original-plan",
    name: "Plan początkowy",
    entries: exercises.map((e) => ({
      exerciseId: e.id,
      sets: 3,
      weight: e.weight,
      reps: e.reps,
      note: "",
    })),
  };
}
const painSchema = z.number().int().min(0).max(10);
const legacyPainValuesSchema = z.array(painSchema).length(3).transform((values) =>
  values.map((value, index) => ({ siteId: defaultRehabSites[index].id, value })));
const painValuesSchema = z.union([
  z.array(z.object({ siteId: z.string().min(1).max(80), value: painSchema })).max(50),
  legacyPainValuesSchema,
]);
export const measurementPhases = ["unspecified", "daily", "pre", "during", "post", "followup"] as const;
export type MeasurementPhase = typeof measurementPhases[number];
export const measurementPhaseLabels: Record<MeasurementPhase, string> = {
  unspecified: "Nie określono", daily: "Pomiar dzienny", pre: "Przed treningiem",
  during: "W trakcie treningu", post: "Po treningu", followup: "Pomiar kontrolny",
};
export const logSchema = z.object({
  id: z.string(),
  profileId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  at: z.string().datetime(),
  values: painValuesSchema,
  injuryIds: z.array(z.string().min(1).max(80)).max(50).optional(),
  sessionId: z.string().optional(),
  measurementPhase: z.enum(measurementPhases).optional(),
  context: z.string().max(100),
  note: z.string().max(2000),
}).superRefine((log, ctx) => {
  if (new Set(log.values.map((item) => item.siteId)).size !== log.values.length)
    ctx.addIssue({ code: "custom", message: "Duplicate tracked area in diary entry" });
  if (new Set(log.injuryIds ?? []).size !== (log.injuryIds ?? []).length)
    ctx.addIssue({ code: "custom", message: "Duplicate injury link in diary entry" });
});
export type PainLog = z.infer<typeof logSchema>;
export const setSchema = z.object({
  exerciseId: exerciseIdSchema,
  side: z.enum(["L", "P", "both"]),
  index: z.number().int().min(0).max(9),
  weight: z.number().min(0).max(500),
  reps: z.number().int().min(0).max(50),
  done: z.boolean(),
});
export type SetLog = z.infer<typeof setSchema>;
export const sessionSchema = z
  .object({
    id: z.string(),
    profileId: z.string().optional(),
    started: z.string().datetime(),
    ended: z.string().datetime().optional(),
    completionReason: z.enum(["unspecified", "pain", "fatigue", "time", "other"]).optional(),
    sets: z.array(setSchema).min(1).max(600),
    plan: planEntriesSchema.optional(),
    planName: z.string().max(80).optional(),
    templateId: z.string().optional(),
    note: z.string().max(2000),
    exerciseProgress: z.array(z.object({
      exerciseId: exerciseIdSchema,
      status: z.enum(["completed", "finishedEarly", "stopped"]),
    })).optional(),
    prescribed: z
      .array(z.object({ exerciseId: z.string(), dose: doseSchema }))
      .optional(),
    decision: z.string().max(20000).optional(),
    ruleVersion: z.string().optional(),
    editedAt: z.string().datetime().optional(),
  })
  .superRefine((s, ctx) => {
    const entries = s.plan ?? defaultTemplate().entries;
    const expected = entries.flatMap((entry) => {
      const e = exerciseById(entry.exerciseId);
      if (!e) return [];
      return (e.unilateral ? ["L", "P"] : ["both"]).flatMap((side) =>
        Array.from(
          { length: entry.sets },
          (_, index) => `${e.id}/${side}/${index}`,
        ),
      );
    });
    const keys = s.sets.map((x) => `${x.exerciseId}/${x.side}/${x.index}`);
    if (
      keys.length !== expected.length ||
      new Set(keys).size !== keys.length ||
      keys.some((key) => !expected.includes(key))
    )
      ctx.addIssue({ code: "custom", message: "Nieprawidłowy zestaw serii" });
    if (s.ended && s.sets.some((x) => (!x.done || x.reps < 1) &&
      !s.exerciseProgress?.some((p) => p.exerciseId === x.exerciseId &&
        (p.status === "stopped" || p.status === "finishedEarly"))))
      ctx.addIssue({ code: "custom", message: "Niekompletny trening" });
    if (s.ended && s.ended < s.started)
      ctx.addIssue({
        code: "custom",
        message: "Koniec treningu jest wcześniejszy niż początek",
      });
  });
export type Session = z.infer<typeof sessionSchema>;
// Zachowujemy zapis L/P dla zgodności ze starszymi kopiami. Formularz edytuje parę naraz.
export function visibleSets(session: Session) {
  return session.sets.filter((s) => s.side !== "P");
}
export function updatePairedSet(
  session: Session,
  row: SetLog,
  patch: Partial<SetLog>,
): Session {
  return {
    ...session,
    sets: session.sets.map((s) =>
      s.exerciseId === row.exerciseId && s.index === row.index
        ? { ...s, ...patch }
        : s,
    ),
  };
}
export function completedGroups(session: Session) {
  return visibleSets(session).filter((row) =>
    session.sets
      .filter((s) => s.exerciseId === row.exerciseId && s.index === row.index)
      .every((s) => s.done && s.reps > 0),
  ).length;
}
export function validateHistoricalSession(
  raw: unknown,
  sessions: Session[],
  now = new Date(),
): Session {
  const s = sessionSchema.parse(raw);
  if (
    !s.ended ||
    new Date(s.ended).getTime() > now.getTime() ||
    new Date(s.started).getTime() > now.getTime()
  )
    throw Error(
      "Wpisz rzeczywisty początek i koniec treningu, bez dat z przyszłości.",
    );
  if (s.started >= s.ended)
    throw Error("Koniec treningu musi być późniejszy niż początek.");
  if (
    sessions.some(
      (other) =>
        other.id !== s.id &&
        new Date(s.started).getTime() <
          new Date(other.ended || now).getTime() &&
        new Date(s.ended!).getTime() > new Date(other.started).getTime(),
    )
  )
    throw Error(
      "Godziny pokrywają się z innym treningiem. Popraw datę lub godzinę.",
    );
  return s;
}
export const backupSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
    profileName: z.string().trim().min(1).max(80).optional(),
    profileSettings: profileSettingsSchema.optional(),
    templates: z.array(templateSchema).max(200).optional(),
    exportedAt: z.string().datetime(),
    logs: z.array(logSchema).max(30000),
    sessions: z.array(sessionSchema).max(10000),
  })
  .superRefine((data, ctx) => {
    if (data.version >= 4 && !data.profileSettings)
      ctx.addIssue({ code: "custom", message: "Missing profile settings" });
    if (data.version !== 1 && !data.templates)
      ctx.addIssue({ code: "custom", message: "Brak planów w kopii" });
    if (
      data.templates &&
      new Set(data.templates.map((t) => t.id)).size !== data.templates.length
    )
      ctx.addIssue({ code: "custom", message: "Powtórzone plany" });
    for (const records of [data.logs, data.sessions])
      if (new Set(records.map((x) => x.id)).size !== records.length)
        ctx.addIssue({ code: "custom", message: "Powtórzone identyfikatory" });
    if (data.sessions.filter((x) => !x.ended).length > 1)
      ctx.addIssue({
        code: "custom",
        message: "Więcej niż jeden aktywny trening",
      });
  });
export function day(at: string | Date) {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Calendar days follow the same local date convention as the morning diary.
export function painMonitor(session: Session, logs: PainLog[]) {
  return [0, 1, 2].map((offset) => {
    const date = new Date(session.started);
    date.setDate(date.getDate() + offset);
    const dateKey = day(date);
    const log = logs
      .filter((entry) => entry.date === dateKey &&
        (offset !== 0 || new Date(entry.at).getTime() <= new Date(session.started).getTime()))
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    return { date: dateKey, log };
  });
}
export function newSession(
  doses: Record<string, Dose>,
  at = new Date().toISOString(),
  template?: WorkoutTemplate,
): Session {
  const plan = template
    ? planEntriesSchema.parse(template.entries)
    : defaultTemplate().entries.map((e) => ({ ...e, ...doses[e.exerciseId] }));
  return {
    id: crypto.randomUUID(),
    started: at,
    note: "",
    ruleVersion: "0.2-manual",
    ...(template
      ? {
          plan: structuredClone(plan),
          planName: template.name,
          templateId: template.id,
        }
      : {}),
    prescribed: plan.map((e) => ({
      exerciseId: e.exerciseId,
      dose: { weight: e.weight, reps: e.reps },
    })),
    sets: plan.flatMap((entry) =>
      (exerciseById(entry.exerciseId).unilateral
        ? (["L", "P"] as const)
        : (["both"] as const)
      ).flatMap((side) =>
        Array.from({ length: entry.sets }, (_, index) => ({
          exerciseId: entry.exerciseId,
          side,
          index,
          weight: entry.weight,
          reps: entry.reps,
          done: false,
        })),
      ),
    ),
  };
}
export function sessionExercises(session: Session) {
  return (session.plan?.map((entry) => entry.exerciseId) ??
    [...new Set(session.sets.map((s) => s.exerciseId))]).map(exerciseById);
}
export function sessionPlan(session: Session): PlanEntry[] {
  return (
    session.plan ??
    sessionExercises(session).map((e) => {
      const rows = visibleSets(session).filter((s) => s.exerciseId === e.id);
      return {
        exerciseId: e.id,
        sets: rows.length,
        weight: rows[0].weight,
        reps: rows[0].reps,
        note: "",
      };
    })
  );
}
export function replaceSessionExercise(
  session: Session,
  from: string,
  to: string,
): Session {
  if (session.sets.some((s) => s.exerciseId === to))
    throw Error("To ćwiczenie jest już w treningu.");
  const plan = sessionPlan(session).map((e) =>
    e.exerciseId === from
      ? { ...e, exerciseId: to, weight: 0, reps: 0, note: "", timer: undefined }
      : e,
  );
  const replacement = newSession({}, session.started, {
    id: session.templateId ?? "custom",
    name: session.planName ?? "Trening",
    entries: plan,
  });
  return {
    ...session,
    plan,
    exerciseProgress: session.exerciseProgress?.filter((row) => row.exerciseId !== from),
    prescribed: replacement.prescribed,
    sets: plan.flatMap((entry) =>
      entry.exerciseId === to
        ? replacement.sets.filter((s) => s.exerciseId === to)
        : session.sets.filter((s) => s.exerciseId === entry.exerciseId),
    ),
  };
}
