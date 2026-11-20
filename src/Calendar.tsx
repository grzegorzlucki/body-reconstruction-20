import { useTranslation } from "react-i18next";
import { useMemo, useRef, useState } from "react";
import { ui, locale } from "./i18n/config";
import {
  day,
  type Session,
  type PainLog,
  type RehabSite,
  type PainContext,
  type Injury,
} from "./domain";
import { CalendarDayDetails } from "./calendar/CalendarDayDetails";
import { calendarData } from "./calendar/calendarData";

export function Calendar({
  sessions,
  logs,
  sites,
  contexts,
  injuries,
  onTraining,
  onEdit,
  onResume,
  onPain,
  onEditLog,
}: {
  sessions: Session[];
  logs: PainLog[];
  sites: RehabSite[];
  contexts: PainContext[];
  injuries: Injury[];
  onTraining: (date: string) => void;
  onEdit: (session: Session) => void;
  onResume: (session: Session) => void;
  onPain: (date: string) => void;
  onEditLog: (id: string) => void;
}) {
  useTranslation();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const calendar = useRef<HTMLElement>(null);
  const details = useRef<HTMLHeadingElement>(null);
  const data = useMemo(() => calendarData(sessions, logs), [sessions, logs]);
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const days = Array.from(
    { length: 42 },
    (_, i) =>
      new Date(month.getFullYear(), month.getMonth(), 1 - offset + i, 12),
  );
  function select(date: string) {
    const parsed = new Date(date + "T12:00:00");
    setMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1, 12));
    setSelected(date);
    requestAnimationFrame(() => {
      details.current?.focus({ preventScroll: true });
      if (matchMedia("(max-width: 700px)").matches)
        details.current?.scrollIntoView({
          block: "start",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
    });
  }
  function close() {
    const previous = selected;
    setSelected(null);
    requestAnimationFrame(() =>
      calendar.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${previous}"]`)
        ?.focus(),
    );
  }
  return (
    <>
      <h1>{ui("Kalendarz")}</h1>
      <p className="intro">
        {ui(
          "Trening i monitoring bólu w jednym widoku. Wybierz dzień, aby dodać lub poprawić wpis.",
        )}
      </p>
      <div className={`calendar-layout ${selected ? "has-selection" : ""}`}>
        <section
          className="panel calendar-month"
          ref={calendar}
          aria-label={ui("Kalendarz")}
        >
          <div className="calendar-month-header">
            <button
              className="secondary"
              aria-label={ui("Poprzedni miesiąc")}
              onClick={() => {
                setMonth(
                  new Date(month.getFullYear(), month.getMonth() - 1, 1, 12),
                );
                setSelected(null);
              }}
            >
              ←
            </button>
            <h2 aria-live="polite">
              {month.toLocaleDateString(locale(), {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              className="secondary"
              aria-label={ui("Następny miesiąc")}
              onClick={() => {
                setMonth(
                  new Date(month.getFullYear(), month.getMonth() + 1, 1, 12),
                );
                setSelected(null);
              }}
            >
              →
            </button>
          </div>
          <div
            className="calendar-grid"
            onKeyDown={(event) => {
              const target = event.target as HTMLElement;
              const date =
                target.closest<HTMLButtonElement>("[data-date]")?.dataset.date;
              const delta = (
                {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -7,
                  ArrowDown: 7,
                } as Record<string, number>
              )[event.key];
              if (!date || delta === undefined) return;
              event.preventDefault();
              const next = new Date(date + "T12:00:00");
              next.setDate(next.getDate() + delta);
              const key = day(next);
              const nextButton = calendar.current?.querySelector<HTMLButtonElement>(`[data-date="${key}"]`);
              if (nextButton) {
                nextButton.focus();
                return;
              } else {
                setMonth(new Date(next.getFullYear(), next.getMonth(), 1, 12));
                setSelected(null);
              }
              requestAnimationFrame(() =>
                calendar.current
                  ?.querySelector<HTMLButtonElement>(`[data-date="${key}"]`)
                  ?.focus(),
              );
            }}
          >
            {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((label) => (
              <span className="weekday" key={label}>
                {ui(label)}
              </span>
            ))}
            {days.map((date) => {
              const key = day(date),
                records = data.get(key);
              const training = records?.sessions.some((s) => !!s.ended),
                active = records?.sessions.some((s) => !s.ended),
                pain = !!records?.logs.length;
              return (
                <button
                  key={key}
                  data-date={key}
                  aria-pressed={selected === key}
                  aria-current={key === day(new Date()) ? "date" : undefined}
                  aria-label={`${date.toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" })}${training ? ui(", trening") : ""}${active ? ui(", trening w trakcie") : ""}${pain ? ui(", pomiar bólu") : ""}`}
                  className={`calendar-day ${date.getMonth() !== month.getMonth() ? "muted" : ""} ${selected === key ? "chosen" : ""} ${key === day(new Date()) ? "today" : ""}`}
                  onClick={() => select(key)}
                >
                  <span>{date.getDate()}</span>
                  <span className="calendar-dots" aria-hidden="true">
                    {training && <i className="training-dot" />}
                    {active && <i className="active-dot" />}
                    {pain && <i className="pain-dot" />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="calendar-legend">
            <span>
              <i className="training-dot" />
              {ui("Trening")}
            </span>
            <span>
              <i className="pain-dot" />
              {ui("Wpis bólu")}
            </span>
            <span>
              <i className="active-dot" />
              {ui("Trening w trakcie")}
            </span>
          </p>
          {!selected && <p>{ui("Wybierz dzień, aby zobaczyć szczegóły.")}</p>}
        </section>
        {selected && (
          <CalendarDayDetails
            date={selected}
            records={data.get(selected)}
            allSessions={sessions}
            sites={sites}
            contexts={contexts}
            injuries={injuries}
            headingRef={details}
            onClose={close}
            onDay={select}
            onTraining={onTraining}
            onEdit={onEdit}
            onResume={onResume}
            onPain={onPain}
            onEditLog={onEditLog}
          />
        )}
      </div>
    </>
  );
}
