import { useTranslation } from "react-i18next";
import { ui, locale } from "../i18n/config";
import { formatNumber } from "../i18n/formatters";
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
  useTranslation();
  const [limit, setLimit] = useState(50);
  const all = [...allSessions]
    .filter((s) => s.ended && sessionDose(s).performed)
    .sort((a, b) => a.ended!.localeCompare(b.ended!));
  const weeks = weeklyDose(sessions, exerciseId);
  return (
    <section className="panel">
      <h2>{ui("Dawka i regularność")}</h2>
      <p>
         {ui("Liczymy tylko serie oznaczone jako wykonane z co najmniej jednym powtórzeniem. Para L/P jest jedną serią; powtórzenia obejmują obie strony.")} </p>
      <details>
        <summary>{ui("Podsumowanie tygodni ·")} {weeks.length}</summary>
        {weeks.map((week) => (
          <p key={week.week}>
             {ui("Tydzień od")} {week.week}: {week.sets}  {ui("serii ·")} {week.repetitions}{" "}
             {ui("powtórzeń ·")} {week.sessions}  {ui("sesji z pracą")} </p>
        ))}
        <p className="footnote">
           {ui("Pierwszy i ostatni tydzień mogą obejmować tylko część tygodnia z wybranego zakresu. Uwzględniamy także wykonaną pracę sesji w toku.")} </p>
      </details>
      {!sessions.length ? (
        <p>{ui("Brak treningów dla tych filtrów.")}</p>
      ) : (
        <div
          className="table-scroll"
          role="region"
          aria-label={ui("Wykonana dawka treningu")}
          tabIndex={0}
        >
          <table className="analytics-table">
            <thead>
              <tr>
                <th>{ui("Sesja")}</th>
                <th>{ui("Status / serie")}</th>
                <th>{ui("Powtórzenia")}</th>
                {exerciseId && <th>{ui("Ciężar × powtórzenia")}</th>}
                <th>{ui("Odstęp / czas sesji")}</th>
                <th>{ui("Ocena około 24 h")}</th>
                <th>{ui("Powód zakończenia")}</th>
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
                        {session.activityName || session.planName || ui("Trening")}
                      </button>
                      <small>
                        {new Date(session.started).toLocaleString(locale())}
                      </small>
                    </th>
                    <td>
                      {ui(dose.status)}
                      <small>
                        {dose.completed}/{dose.planned}
                      </small>
                    </td>
                    <td>{dose.repetitions}</td>
                    {exerciseId && <td>{dose.volume == null ? "—" : formatNumber(dose.volume, 0)} {ui("kg·powt.")}</td>}
                    <td>
                      {previous
                        ? ui("{{v0}} h przerwy", { v0: formatNumber((Date.parse(session.started) - Date.parse(previous.ended!)) / 3600000) })
                        : ui("Brak poprzedniej sesji")}
                      <small>
                        {dose.durationMinutes === null
                          ? ui("W toku")
                          : ui("{{v0}} min czasu sesji", { v0: Math.round(dose.durationMinutes) })}
                      </small>
                    </td>
                    <td>
                      {!siteId
                        ? ui("Wybierz obszar")
                        : paired
                          ? ui("{{v0}}/10 · {{v1}} pkt względem przed", {v0: match!.value, v1: match!.value - baseline!.value})
                          : ui("Brak porównywalnej, potwierdzonej pary")}
                    </td>
                    <td>
                      {ui(reasons[session.completionReason ?? "unspecified"])}
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
           {ui("Pokaż kolejne 50 sesji")} </button>
      )}
      {exerciseId && (
        <p>
           {ui("Objętość dotyczy tylko ćwiczenia:")} {ui(exerciseById(exerciseId).name)}{ui(". Porównuj ten sam wariant i sprzęt; pokazujemy wyłącznie zapisany ciężar dodatkowy.")} </p>
      )}
      <p className="footnote">
         {ui("Czas sesji zawiera pauzy i pozostawienie aplikacji otwartej. Ból może wpływać na zmniejszenie dawki. Samo następstwo w czasie nie dowodzi przyczyny.")} </p>
    </section>
  );
}
