import { useTranslation } from "react-i18next";
import { ui } from "./i18n/config";
import { ExercisePicker } from "./Plans";
import { SetNumberInput } from "./SetNumberInput";
import { ExerciseTimer } from "./ExerciseTimer";
import {
  sessionExercises,
  sessionPlan,
  visibleSets,
  updatePairedSet,
  type Session,
  type SetLog,
} from "./domain";
export function SessionFields({
  session,
  disabled = false,
  onChange,
  onReplace,
  onTimerFinish,
  confirmAction,
}: {
  session: Session;
  disabled?: boolean;
  onChange: (next: Session) => void;
  onReplace?: (from: string, to: string) => void;
  onTimerFinish?: (exerciseId: string, status: "completed" | "finishedEarly" | "stopped") => Promise<void>;
  confirmAction: (message: string) => Promise<boolean>;
}) {
  useTranslation();
  return (
    <>
      {sessionExercises(session).map((e) => (
        <section className="panel" key={e.id}>
          <h2>{ui(e.name)}</h2>
          {sessionPlan(session).find((entry) => entry.exerciseId === e.id)
            ?.note && (
            <p className="reason">
              {
                sessionPlan(session).find((entry) => entry.exerciseId === e.id)
                  ?.note
              }
            </p>
          )}
          {onReplace && !disabled && (
            <ExercisePicker
              label={ui("Zamień: {{v0}}", {v0: ui(e.name)})}
              excluded={sessionExercises(session).map((e) => e.id)}
              onPick={(id) => onReplace(e.id, id)}
            />
          )}
          <p>
            {ui(e.detail)}
            {e.unilateral ? " " + ui("· jeden wpis dotyczy obu nóg") : ""}
          </p>
          {onTimerFinish && sessionPlan(session).find((entry) => entry.exerciseId === e.id)?.timer &&
            <ExerciseTimer entry={sessionPlan(session).find((entry) => entry.exerciseId === e.id)!}
              savedStatus={session.exerciseProgress?.find((row) => row.exerciseId === e.id)?.status}
              disabled={disabled} onFinish={(status) => onTimerFinish(e.id, status)}
              confirmAction={confirmAction} />}
          {onTimerFinish && !sessionPlan(session).find((entry) => entry.exerciseId === e.id)?.timer &&
            (session.exerciseProgress?.some((row) => row.exerciseId === e.id && (row.status === "finishedEarly" || row.status === "stopped"))
              ? <p className="notice" role="status">{ui("Ćwiczenie zakończone wcześniej.")}</p>
              : <button type="button" className="secondary" disabled={disabled}
                  onClick={async () => {
                    if (await confirmAction("Zakończyć to ćwiczenie wcześniej? Niewykonane serie pozostaną niezaznaczone."))
                      try { await onTimerFinish(e.id, "finishedEarly"); }
                      catch { /* Save error is displayed by the workout action. */ }
                  }}>{ui("Zakończ ćwiczenie wcześniej")}</button>)}
          {visibleSets(session)
            .filter((s) => s.exerciseId === e.id)
            .map((row) => {
              const pair = session.sets.filter(
                (s) => s.exerciseId === row.exerciseId && s.index === row.index,
              );
              const differs = pair.some(
                (s) =>
                  s.reps !== row.reps ||
                  s.weight !== row.weight ||
                  s.done !== row.done,
              );
              const change = (patch: Partial<SetLog>) =>
                onChange(updatePairedSet(session, row, patch));
              return (
                <div key={row.index}>
                  {differs && (
                    <p className="notice">
                       {ui("Stary zapis ma różne wartości dla nóg:")}{" "}
                      {pair
                        .map((s) => `${s.side}: ${s.weight} kg × ${s.reps}`)
                        .join(" / ")}
                       {ui(". Zmiana pola zastosuje je do obu nóg.")} </p>
                  )}
                  <div
                    className={
                      "set-row " + (pair.every((s) => s.done) ? "done" : "")
                    }
                  >
                    <label>
                      <input
                        type="checkbox"
                        aria-label={ui("{{v0}} seria {{v1}} wykonana",{v0: ui(e.name), v1: row.index + 1})}
                        checked={pair.every((s) => s.done)}
                        disabled={disabled}
                        onChange={(ev) => change({ done: ev.target.checked })}
                      />
                       {ui("Seria")} {row.index + 1}
                      {e.unilateral ? " " + ui("· L+P") : ""}
                    </label>
                    <label>
                      kg
                      <SetNumberInput
                        aria-label={ui("{{v0}} seria {{v1}} ciężar", {v0: ui(e.name), v1: row.index + 1})}
                        type="number"
                        min="0"
                        max="500"
                        step="0.5"
                        value={row.weight}
                        disabled={disabled}
                        onValueChange={(weight) => change({ weight })}
                      />
                    </label>
                    <label>
                      {ui("powt.")}<SetNumberInput
                        aria-label={ui("{{v0}} seria {{v1}} powtórzenia", {v0: ui(e.name), v1: row.index + 1})}
                        type="number"
                        min="0"
                        max="50"
                        value={row.reps}
                        disabled={disabled}
                        onValueChange={(reps) => change({ reps })}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
        </section>
      ))}
    </>
  );
}
