import {
  measurementPhaseLabels,
  type PainLog,
  type RehabSite,
  type PainContext,
  type Injury,
  type Session,
} from "../domain";
import { ui } from "../i18n/config";
import { calendarTime } from "./CalendarWorkoutCard";
import { painLevelColor } from "../PainSlider";
export function CalendarPainCard({
  log,
  sites,
  contexts,
  injuries,
  sessions,
  onEdit,
}: {
  log: PainLog;
  sites: RehabSite[];
  contexts: PainContext[];
  injuries: Injury[];
  sessions: Session[];
  onEdit: (id: string) => void;
}) {
  const linked = sessions.find((s) => s.id === log.sessionId);
  return (
    <article className="calendar-record">
      <h4>
        {calendarTime(log.at)} ·{" "}
        {ui(measurementPhaseLabels[log.measurementPhase ?? "unspecified"])}
      </h4>
      <p>
        {contexts.find((c) => c.value === log.context)?.label ||
          log.context ||
          ui("Bez kontekstu")}
      </p>
      <ul className="calendar-pain-values">
        {log.values.map((value) => (
          <li key={value.siteId}>
            <span>
              {sites.find((site) => site.id === value.siteId)?.name ??
                value.siteId}
            </span>
            <span
              className="calendar-pain-meter"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={value.value}
              aria-label={
                sites.find((site) => site.id === value.siteId)?.name ??
                value.siteId
              }
            >
              <span
                style={{
                  width: `${value.value * 10}%`,
                  background: painLevelColor(value.value),
                }}
              />
            </span>
            <strong>{value.value}/10</strong>
          </li>
        ))}
      </ul>
      {!!log.injuryIds?.length && (
        <p>
          {log.injuryIds
            .map((id) => injuries.find((i) => i.id === id)?.name ?? id)
            .join(", ")}
        </p>
      )}
      {log.sessionId && (
        <p>
          {ui("Powiązany trening")}: {linked?.activityName || linked?.planName || ui("Trening")}
        </p>
      )}
      {log.note && <p className="calendar-note">{log.note}</p>}
      <button className="text-button" onClick={() => onEdit(log.id)}>
        {ui("Edytuj ten pomiar")}
      </button>
    </article>
  );
}
