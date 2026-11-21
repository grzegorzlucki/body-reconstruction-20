import {
  completedGroups,
  visibleSets,
  sessionExercises,
  type Session,
} from "../domain";
import { ui, locale } from "../i18n/config";
export const calendarTime = (date: string) =>
  new Date(date).toLocaleTimeString(locale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
export function CalendarWorkoutCard({
  session: s,
  onEdit,
  onResume,
}: {
  session: Session;
  onEdit: (s: Session) => void;
  onResume: (s: Session) => void;
}) {
  const early = s.exerciseProgress?.some(
    (p) => p.status === "finishedEarly" || p.status === "stopped",
  );
  const reasons: Record<string, string> = {
    pain: "Ból",
    fatigue: "Zmęczenie",
    time: "Brak czasu",
    other: "Inny powód",
    unspecified: "Nie określono",
  };
  return (
    <article className="calendar-record">
    <h4>{s.activityName || s.planName || ui("Plan początkowy")}</h4>
      <p>
        {ui(
          !s.ended
            ? "Trening w trakcie"
            : early
              ? "Trening zakończony wcześniej"
              : "Trening ukończony",
        )}
      </p>
      <p>
        {calendarTime(s.started)}
        {s.ended && (
          <>
            {" "}
            – {calendarTime(s.ended)} ·{" "}
            {Math.round((Date.parse(s.ended) - Date.parse(s.started)) / 60000)}{" "}
            min
          </>
        )}
      </p>
      {s.activityType !== "external" && <><p>
        {ui("Wykonane serie: {{v0}} / {{v1}}", {
          v0: completedGroups(s),
          v1: visibleSets(s).length,
        })}
      </p>
      <details>
        <summary>{ui("Ćwiczenia i serie")}</summary>
        {sessionExercises(s).map((exercise) => (
          <div key={exercise.id} className="calendar-exercise">
            <strong>{ui(exercise.name)}</strong>
            <ul>
              {s.sets
                .filter((row) => row.exerciseId === exercise.id)
                .map((row) => (
                  <li key={`${row.side}-${row.index}`}>
                    {ui("Seria")} {row.index + 1} ·{" "}
                    {ui(
                      row.side === "L"
                        ? "Lewa strona"
                        : row.side === "P"
                          ? "Prawa strona"
                          : "Obie strony",
                    )}{" "}
                    · {row.weight} kg · {row.reps} {ui("powt.")} ·{" "}
                    {ui(row.done ? "Wykonano" : "Nie wykonano")}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </details></>}
      {s.activityType === "external" && <p>{s.templateId ? `${ui("Aktywność zaliczana do celu")} · ${s.planName ?? ""}` : ui("Aktywność poza celem treningowym")}</p>}
      {s.note && <p className="calendar-note">{s.note}</p>}
      {s.completionReason && s.completionReason !== "unspecified" && (
        <p>
          {ui("Powód zakończenia")}: {ui(reasons[s.completionReason])}
        </p>
      )}
      <button
        className="text-button"
        onClick={() => (s.ended ? onEdit(s) : onResume(s))}
      >
        {ui(s.ended ? "Edytuj trening" : "Wznów trening")}
      </button>
    </article>
  );
}
