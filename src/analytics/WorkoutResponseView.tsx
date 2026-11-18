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
  if (!match) return <>Brak pomiaru</>;
  const comparable = baseline && baseline.log.context === match.log.context;
  return (
    <>
      <strong>{match.value}/10</strong>
      <small>
        {new Date(match.log.at).toLocaleString("pl-PL")} ·{" "}
        {match.elapsedHours.toFixed(1)} h
      </small>
      <small>
        {match.source === "confirmed"
          ? "Powiązanie zapisane"
          : "Kandydat czasowy — niepotwierdzony"}
      </small>
      {match.interveningSession && (
        <small>Inny trening przed tym pomiarem</small>
      )}
      {baseline && (
        <small>
          {comparable
            ? `Różnica: ${match.value - baseline.value > 0 ? "+" : ""}${match.value - baseline.value} pkt`
            : "Inny kontekst — bez porównania"}
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
  if (!session)
    return <p>Wybierz trening z listy. Brak sesji w wybranym zakresie.</p>;
  const dose = sessionDose(session);
  return (
    <section className="panel">
      <h2>
        {session.planName ?? "Trening"} ·{" "}
        {new Date(session.started).toLocaleString("pl-PL")}
      </h2>
      <p>
        {dose.status} · {dose.completed}/{dose.planned} serii ·{" "}
        {dose.repetitions} powtórzeń (z obu stron).
      </p>
      {session.note && <p>{session.note}</p>}
      <details>
        <summary>Ćwiczenia i wykonana dawka</summary>
        {sessionPlan(session).map((entry) => {
          const exerciseDose = sessionDose(session, entry.exerciseId);
          return (
            <p key={entry.exerciseId}>
              {exerciseById(entry.exerciseId).name}: {exerciseDose.completed}/
              {exerciseDose.planned} serii · {exerciseDose.repetitions}{" "}
              powtórzeń{entry.note ? ` · ${entry.note}` : ""}
            </p>
          );
        })}
      </details>
      <div
        className="table-scroll"
        role="region"
        aria-label="Reakcja po treningu — tabela przewijana"
        tabIndex={0}
      >
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Obszar</th>
              <th>Przed</th>
              <th>Po</th>
              <th>Około 24 h</th>
              <th>Około 48 h</th>
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
                          Sprawdź / powiąż pomiar
                        </button>
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
          Dodaj pomiar do tego treningu
        </button>
      </div>
      <p className="footnote">
        Przed: do 24 h przed startem. Po: tylko jawnie powiązany raport. Okna
        kontrolne: 18–30 i 42–54 h od końca. To reguły organizacji danych, nie
        progi medyczne. Brak pomiaru nie oznacza braku bólu.
      </p>
    </section>
  );
}
