import { exerciseById, type PainLog, type Session } from "../domain";
import { useState } from "react";
import { sessionDose, weeklyDose } from "./metrics";
import { matchSessionMeasurements } from "./matching";

const reasons = {
  unspecified: "Nie podano",
  pain: "Ból",
  fatigue: "Zmęczenie",
  time: "Brak czasu",
  other: "Inny",
};
export function TrainingDoseView({
  sessions,
  allSessions,
  logs,
  siteId,
  exerciseId,
  context,
  onSelect,
}: {
  sessions: Session[];
  allSessions: Session[];
  logs: PainLog[];
  siteId: string;
  exerciseId: string;
  context?: string;
  onSelect: (id: string) => void;
}) {
  const [limit, setLimit] = useState(50);
  const all = [...allSessions]
    .filter((s) => s.ended && sessionDose(s).performedRows > 0)
    .sort((a, b) => a.ended!.localeCompare(b.ended!));
  const weeks = weeklyDose(sessions, exerciseId);
  return (
    <section className="panel">
      <h2>Dawka i regularność</h2>
      <p>
        Liczymy tylko serie oznaczone jako wykonane z co najmniej jednym
        powtórzeniem. Para L/P jest jedną serią; powtórzenia obejmują obie
        strony.
      </p>
      <details>
        <summary>Podsumowanie tygodni · {weeks.length}</summary>
        {weeks.map((week) => (
          <p key={week.week}>
            Tydzień od {week.week}: {week.sets} serii · {week.repetitions}{" "}
            powtórzeń · {week.sessions} sesji z pracą
          </p>
        ))}
        <p className="footnote">
          Pierwszy i ostatni tydzień mogą obejmować tylko część tygodnia z
          wybranego zakresu. Uwzględniamy także wykonaną pracę sesji w toku.
        </p>
      </details>
      {!sessions.length ? (
        <p>Brak treningów dla tych filtrów.</p>
      ) : (
        <div
          className="table-scroll"
          role="region"
          aria-label="Wykonana dawka treningu"
          tabIndex={0}
        >
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Sesja</th>
                <th>Status / serie</th>
                <th>Powtórzenia</th>
                {exerciseId && <th>Ciężar × powtórzenia</th>}
                <th>Odstęp / czas sesji</th>
                <th>Ocena około 24 h</th>
                <th>Powód zakończenia</th>
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, limit).map((session) => {
                const dose = sessionDose(session, exerciseId),
                  previous = all
                    .filter(
                      (s) =>
                        s.id !== session.id &&
                        Date.parse(s.ended!) <= Date.parse(session.started),
                    )
                    .at(-1);
                const response = siteId
                  ? matchSessionMeasurements(
                      session,
                      logs,
                      allSessions,
                      siteId,
                      context,
                    )
                  : null;
                const match = response?.h24,
                  baseline = response?.pre;
                const paired =
                  match?.source === "confirmed" &&
                  baseline?.source === "confirmed" &&
                  !match.interveningSession &&
                  !baseline.interveningSession &&
                  match.log.context === baseline.log.context;
                return (
                  <tr key={session.id}>
                    <th scope="row">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onSelect(session.id)}
                      >
                        {session.planName ?? "Trening"}
                      </button>
                      <small>
                        {new Date(session.started).toLocaleString("pl-PL")}
                      </small>
                    </th>
                    <td>
                      {dose.status}
                      <small>
                        {dose.completed}/{dose.planned}
                      </small>
                    </td>
                    <td>{dose.repetitions}</td>
                    {exerciseId && <td>{dose.volume?.toFixed(0)} kg·powt.</td>}
                    <td>
                      {previous
                        ? `${((Date.parse(session.started) - Date.parse(previous.ended!)) / 3600000).toFixed(1)} h przerwy`
                        : "Brak poprzedniej sesji"}
                      <small>
                        {dose.durationMinutes === null
                          ? "W toku"
                          : `${Math.round(dose.durationMinutes)} min czasu sesji`}
                      </small>
                    </td>
                    <td>
                      {!siteId
                        ? "Wybierz obszar"
                        : paired
                          ? `${match!.value}/10 · ${match!.value - baseline!.value} pkt względem przed`
                          : "Brak porównywalnej, potwierdzonej pary"}
                    </td>
                    <td>
                      {reasons[session.completionReason ?? "unspecified"]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {sessions.length > limit && (
        <button
          type="button"
          className="secondary"
          onClick={() => setLimit(limit + 50)}
        >
          Pokaż kolejne 50 sesji
        </button>
      )}
      {exerciseId && (
        <p>
          Objętość dotyczy tylko ćwiczenia: {exerciseById(exerciseId).name}.
          Porównuj ten sam wariant i sprzęt; pokazujemy wyłącznie zapisany
          ciężar dodatkowy.
        </p>
      )}
      <p className="footnote">
        Czas sesji zawiera pauzy i pozostawienie aplikacji otwartej. Ból może
        wpływać na zmniejszenie dawki. Samo następstwo w czasie nie dowodzi
        przyczyny.
      </p>
    </section>
  );
}
