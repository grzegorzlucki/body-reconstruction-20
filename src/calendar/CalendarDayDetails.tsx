import type { Ref } from "react";
import {
  day,
  type Session,
  type RehabSite,
  type PainContext,
  type Injury,
} from "../domain";
import { ui, locale } from "../i18n/config";
import type { CalendarRecords } from "./calendarData";
import { CalendarWorkoutCard } from "./CalendarWorkoutCard";
import { CalendarPainCard } from "./CalendarPainCard";
export function CalendarDayDetails({
  date,
  records,
  allSessions,
  sites,
  contexts,
  injuries,
  headingRef,
  onClose,
  onDay,
  onTraining,
  onEdit,
  onResume,
  onPain,
  onEditLog,
}: {
  date: string;
  records?: CalendarRecords;
  allSessions: Session[];
  sites: RehabSite[];
  contexts: PainContext[];
  injuries: Injury[];
  headingRef: Ref<HTMLHeadingElement>;
  onClose: () => void;
  onDay: (date: string) => void;
  onTraining: (date: string) => void;
  onEdit: (session: Session) => void;
  onResume: (session: Session) => void;
  onPain: (date: string) => void;
  onEditLog: (id: string) => void;
}) {
  const sessions = records?.sessions ?? [],
    logs = records?.logs ?? [],
    future = date > day(new Date());
  function move(delta: number) {
    const next = new Date(date + "T12:00:00");
    next.setDate(next.getDate() + delta);
    onDay(day(next));
  }
  return (
    <section
      className="calendar-details"
      aria-labelledby="calendar-day-heading"
    >
      <header className="panel calendar-details-header">
        <h2 id="calendar-day-heading" tabIndex={-1} ref={headingRef}>
          {new Date(date + "T12:00:00").toLocaleDateString(locale(), {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h2>
        <p role="status">
          {ui("Treningi: {{v0}} · Pomiary: {{v1}}", {
            v0: sessions.length,
            v1: logs.length,
          })}
        </p>
        <div className="actions">
          <button
            className="secondary"
            aria-label={ui("Poprzedni dzień")}
            onClick={() => move(-1)}
          >
            ←
          </button>
          <button
            className="secondary"
            aria-label={ui("Następny dzień")}
            onClick={() => move(1)}
          >
            →
          </button>
          <button className="text-button" onClick={onClose}>
            {ui("Wróć do kalendarza")}
          </button>
        </div>
      </header>
      <section className="panel" aria-labelledby="calendar-workouts-heading">
        <div className="section-title">
          <h3 id="calendar-workouts-heading">{ui("Treningi")}</h3>
          <button
            className="secondary"
            disabled={future}
            onClick={() => onTraining(date)}
          >
            {ui("Dodaj trening")}
          </button>
        </div>
        {!sessions.length && <p>{ui("Brak treningu.")}</p>}
        {sessions.map((session) => (
          <CalendarWorkoutCard
            key={session.id}
            session={session}
            onEdit={onEdit}
            onResume={onResume}
          />
        ))}
      </section>
      <section className="panel" aria-labelledby="calendar-pain-heading">
        <div className="section-title">
          <h3 id="calendar-pain-heading">{ui("Pomiary bólu")}</h3>
          <button
            className="secondary"
            disabled={future}
            onClick={() => onPain(date)}
          >
            {ui("Dodaj pomiar")}
          </button>
        </div>
        {!logs.length && <p>{ui("Brak wpisu bólu.")}</p>}
        {logs.map((log) => (
          <CalendarPainCard
            key={log.id}
            log={log}
            sites={sites}
            contexts={contexts}
            injuries={injuries}
            sessions={allSessions}
            onEdit={onEditLog}
          />
        ))}
      </section>
    </section>
  );
}
