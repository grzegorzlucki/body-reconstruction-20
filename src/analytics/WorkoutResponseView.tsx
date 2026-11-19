import { useTranslation } from "react-i18next";
import { ui, locale } from "../i18n/config";
import { formatNumber } from "../i18n/formatters";
import {
  exerciseById,
  sessionPlan,
  type MeasurementPhase,
  type PainLog,
  type RehabSite,
  type Session,
} from "../domain";
import { matchSessionMeasurements, type MatchedMeasurement } from "./matching";
import { sessionDose } from "./metrics";

export function MeasurementReading({
  match,
  baseline,
}: {
  match: MatchedMeasurement | null;
  baseline?: MatchedMeasurement | null;
}) {
  useTranslation();
  if (!match) return <>{ui("Brak pomiaru")}</>;
  const comparable = baseline && baseline.log.context === match.log.context;
  return (
    <>
      <strong>{match.value}/10</strong>
      <small>
        {new Date(match.log.at).toLocaleString(locale())} ·{" "}
        {formatNumber(match.elapsedHours)} h
      </small>
      <small>
        {match.source === "confirmed"
          ? ui("Powiązanie zapisane")
          : ui("Kandydat czasowy — niepotwierdzony")}
      </small>
      {match.interveningSession && (
        <small>{ui("Inny trening przed tym pomiarem")}</small>
      )}
      {baseline && (
        <small>
          {comparable
            ? ui("Różnica: {{v0}}{{v1}} pkt", {v0: match.value - baseline.value > 0 ? "+" : "", v1: match.value - baseline.value})
            : ui("Inny kontekst — bez porównania")}
        </small>
      )}
    </>
  );
}

export function WorkoutResponseView({
  session,
  sessions,
  logs,
  sites,
  context,
  onAdd,
  onEdit,
}: {
  session?: Session;
  sessions: Session[];
  logs: PainLog[];
  sites: RehabSite[];
  context?: string;
  onAdd: (id: string, phase: MeasurementPhase) => void;
  onEdit: (id: string) => void;
}) {
  useTranslation();
  if (!session)
    return <p>{ui("Wybierz trening z listy. Brak sesji w wybranym zakresie.")}</p>;
  const dose = sessionDose(session);
  return (
    <section className="panel">
      <h2>
        {session.planName ?? "Trening"} ·{" "}
        {new Date(session.started).toLocaleString(locale())}
      </h2>
      <p>
        {ui(dose.status)} · {dose.completed}/{dose.planned}  {ui("serii ·")}{" "}
        {dose.repetitions}  {ui("powtórzeń (z obu stron).")} </p>
      {session.note && <p>{session.note}</p>}
      <details>
        <summary>{ui("Ćwiczenia i wykonana dawka")}</summary>
        {sessionPlan(session).map((entry) => {
          const exerciseDose = sessionDose(session, entry.exerciseId);
          return (
            <p key={entry.exerciseId}>
              {exerciseById(entry.exerciseId).name}: {exerciseDose.completed}/
              {exerciseDose.planned}  {ui("serii ·")} {exerciseDose.repetitions}{" "}
               {ui("powtórzeń")}{entry.note ? ` · ${entry.note}` : ""}
            </p>
          );
        })}
      </details>
      <div
        className="table-scroll"
        role="region"
        aria-label={ui("Reakcja po treningu — tabela przewijana")}
        tabIndex={0}
      >
        <table className="analytics-table">
          <thead>
            <tr>
              <th>{ui("Obszar")}</th>
              <th>{ui("Przed")}</th>
              <th>{ui("Po")}</th>
              <th>{ui("Około 24 h")}</th>
              <th>{ui("Około 48 h")}</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => {
              const response = matchSessionMeasurements(
                session,
                logs,
                sessions,
                site.id,
                context,
              );
              return (
                <tr key={site.id}>
                  <th scope="row">{site.name}</th>
                  {(["pre", "post", "h24", "h48"] as const).map((phase) => (
                    <td key={phase}>
                      <MeasurementReading
                        match={response[phase]}
                        baseline={phase === "pre" ? undefined : response.pre}
                      />
                      {response[phase] && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => onEdit(response[phase]!.log.id)}
                        >
                           {ui("Sprawdź / powiąż pomiar")} </button>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <button
          type="button"
          onClick={() =>
            onAdd(session.id, session.ended ? "followup" : "during")
          }
        >
           {ui("Dodaj pomiar do tego treningu")} </button>
      </div>
      <p className="footnote">
         {ui("Przed: do 24 h przed startem. Po: tylko jawnie powiązany raport. Okna kontrolne: 18–30 i 42–54 h od końca. To reguły organizacji danych, nie progi medyczne. Brak pomiaru nie oznacza braku bólu.")} </p>
    </section>
  );
}
