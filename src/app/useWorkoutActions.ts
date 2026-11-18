import type { Dispatch, SetStateAction } from "react";
import type { AppRepository } from "./repository";
import { completedGroups, day, exerciseById, logSchema, newSession, replaceSessionExercise, sessionSchema, templateSchema, visibleSets,
  type RehabSite, type Session, type WorkoutTemplate } from "../domain";
import { saveCloudSessionSets } from "../cloudDb";

type ActionContext = {
  database: AppRepository;
  cloud: boolean;
  profileId: string;
  active?: Session;
  sessions: Session[];
  templates: WorkoutTemplate[];
  sites: RehabSite[];
  workout: WorkoutTemplate;
  workoutDirty: boolean;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
  setWorkout: Dispatch<SetStateAction<WorkoutTemplate>>;
  setWorkoutDirty: Dispatch<SetStateAction<boolean>>;
  action: (run: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  confirmAction: (message: string) => Promise<boolean>;
};

export function useWorkoutActions({ database, cloud, profileId, active, sessions, sites,
  templates, workout, workoutDirty, busy, setBusy, setError, setNotice,
  setSessions, setWorkout, setWorkoutDirty, action, refresh, confirmAction }: ActionContext) {
  async function begin(selectedWorkout: WorkoutTemplate = workout) {
    await action(async () => {
      const selected = templateSchema.parse(selectedWorkout);
      await database.sessions.add(
        sessionSchema.parse({ ...newSession({}, new Date().toISOString(), selected), profileId }),
      );
    });
  }
  async function savePreparedWorkout(asNew: boolean) {
    const existing = templates.some((template) => template.id === workout.id);
    if (!asNew && !existing) return;
    await action(async () => {
      const next = templateSchema.parse({
        ...workout,
        id: asNew ? crypto.randomUUID() : workout.id,
        profileId,
      });
      await database.templates.put(next);
      setWorkout(structuredClone(next));
      setWorkoutDirty(false);
      setNotice(asNew ? "Nowy plan zapisany w profilu." : "Zmiany planu zapisane w profilu.");
    });
  }
  async function updateTraining(next: Session) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const validated = sessionSchema.parse(next);
      const previous = sessions.find((row) => row.id === validated.id);
      const sameRows = previous?.sets.length === validated.sets.length &&
        validated.sets.every((row, index) => {
          const old = previous!.sets[index];
          return old.exerciseId === row.exerciseId && old.side === row.side && old.index === row.index;
        });
      const changed = sameRows ? validated.sets.filter((row, index) => {
        const old = previous!.sets[index];
        return old.weight !== row.weight || old.reps !== row.reps || old.done !== row.done;
      }) : [];
      if (cloud && sameRows && changed.length > 0 && changed.length <= 2)
        await saveCloudSessionSets(validated, changed);
      else
        await database.sessions.put(validated);
      setSessions((stored) => stored.map((row) => row.id === validated.id ? validated : row));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się zapisać serii.");
    } finally {
      setBusy(false);
    }
  }
  async function finishExercise(exerciseId: string, status: "completed" | "finishedEarly" | "stopped") {
    if (!active || busy) return;
    const next = sessionSchema.parse({ ...active,
      exerciseProgress: [
        ...(active.exerciseProgress ?? []).filter((row) => row.exerciseId !== exerciseId),
        { exerciseId, status },
      ],
    });
    setBusy(true);
    try {
      await database.sessions.put(next);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się zapisać stanu ćwiczenia.");
      throw cause;
    } finally { setBusy(false); }
  }
  async function replaceActiveExercise(from: string, to: string) {
    if (!active) return;
    await action(async () => {
      if (active.sets.some((row) => row.exerciseId === from && row.done) &&
        !await confirmAction("Zamiana usunie wykonane serie tego ćwiczenia z bieżącego treningu. Kontynuować?")) return;
      await database.sessions.put(replaceSessionExercise(active, from, to));
    });
  }
  async function finishWorkout(pain?: Record<string, string>) {
    if (!active || busy) return;
    const measuredSites = sites.filter((site) => site.active);
    if (pain && (measuredSites.length === 0 || measuredSites.some((site) =>
      pain[site.id] === undefined || pain[site.id] === ""))) {
      setError("Oceń ból we wszystkich monitorowanych obszarach albo wyłącz zapis pomiaru.");
      return;
    }
    const completed = completedGroups(active);
    const planned = visibleSets(active).length;
    const unfinishedIds = [...new Set(active.sets.filter((row) => !row.done || row.reps < 1)
      .map((row) => row.exerciseId))];
    if (unfinishedIds.length) {
      const names = unfinishedIds.map((id) => exerciseById(id).name).join(", ");
      const message = completed === 0
        ? `Nie wykonano żadnej serii. Zapisać pusty trening jako zakończony? Możesz też wybrać „Odrzuć trening”. Brakujące ćwiczenia: ${names}.`
        : `Wykonano ${completed} z ${planned} serii. Zapisać trening z niewykonanymi seriami? Brakujące ćwiczenia: ${names}.`;
      if (!await confirmAction(message)) return;
    }
    await action(async () => {
      const ended = new Date().toISOString();
      const next = sessionSchema.parse({ ...active, ended,
        exerciseProgress: [
          ...(active.exerciseProgress ?? []).filter((row) => !unfinishedIds.includes(row.exerciseId)),
          ...unfinishedIds.map((exerciseId) => ({ exerciseId, status: "finishedEarly" as const })),
        ],
      });
      await database.sessions.put(next);
      if (pain) {
        const log = logSchema.parse({ id: active.id, profileId, date: day(ended), at: ended,
          values: measuredSites.map((site) => ({ siteId: site.id, value: Number(pain[site.id]) })),
          injuryIds: [], context: "", note: "Pomiar po treningu" });
        try { await database.logs.put(log); }
        catch (cause) {
          throw Error(`Trening zapisany, ale pomiar bólu nie został zapisany. Dodaj go w Dzienniku. ${cause instanceof Error ? cause.message : ""}`);
        }
      }
      setNotice(pain ? "Trening i pomiar bólu zapisane." : "Trening ukończony. Zapisz reakcję następnego ranka.");
    });
  }
  async function discardWorkout() {
    if (!active) return;
    await action(async () => {
      if (await confirmAction("Usunąć rozpoczęty trening i jego serie?"))
        await database.sessions.delete(active.id);
    });
  }
  async function loadWorkout(template: WorkoutTemplate) {
    if (workoutDirty && !await confirmAction("Odrzucić niezapisane zmiany przygotowania treningu?")) return;
    setWorkout(structuredClone(template));
    setWorkoutDirty(false);
  }
  function changeWorkout(template: WorkoutTemplate) {
    setWorkout(template);
    setWorkoutDirty(true);
  }
  return { begin, savePreparedWorkout, updateTraining, finishExercise,
    replaceActiveExercise, finishWorkout, discardWorkout, loadWorkout, changeWorkout };
}
