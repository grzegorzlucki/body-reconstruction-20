import { useTranslation } from "react-i18next";
import { ui, locale } from "./i18n/config";
import { useState } from "react";
import { day, type Session, type PainLog, type RehabSite } from "./domain";
export function Calendar({
  sessions,
  logs,
  onTraining,
  onEdit,
  onPain,
  sites,
}: {
  sessions: Session[];
  logs: PainLog[];
  sites: RehabSite[];
  onTraining: (date: string) => void;
  onEdit: (s: Session) => void;
  onPain: (date: string) => void;
}) {
  useTranslation();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12),
  );
  const [selected, setSelected] = useState(day(new Date()));
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12),
    offset = (first.getDay() + 6) % 7;
  const days = Array.from(
    { length: 42 },
    (_, i) =>
      new Date(month.getFullYear(), month.getMonth(), 1 - offset + i, 12),
  );
  const selectedSessions = sessions.filter((s) => day(s.started) === selected),
    pain = logs.filter((l) => l.date === selected).sort((a, b) => b.at.localeCompare(a.at))[0],
    future = selected > day(new Date());
  function move(delta: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1, 12));
  }
  return (
    <>
      <h1>{ui("Kalendarz")}</h1>
      <p className="intro">
         {ui("Trening i monitoring bólu w jednym widoku. Wybierz dzień, aby dodać lub poprawić wpis.")} </p>
      <section className="panel">
        <div className="section-title">
          <button
            className="secondary"
            aria-label={ui("Poprzedni miesiąc")}
            onClick={() => move(-1)}
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
            onClick={() => move(1)}
          >
            →
          </button>
        </div>
        <div className="calendar-grid">
          {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((d) => (
            <span className="weekday" key={d}>
              {ui(d)}
            </span>
          ))}
          {days.map((d) => {
            const key = day(d),
              training = sessions.some(
                (s) => s.ended && day(s.started) === key,
              ),
              active = sessions.some((s) => !s.ended && day(s.started) === key),
              logged = logs.some((l) => l.date === key);
            return (
              <button
                key={key}
                data-date={key}
                aria-pressed={selected === key}
                aria-label={`${key}${training ? ui(", trening") : ""}${active ? ui(", trening w trakcie") : ""}${logged ? ui(", pomiar bólu") : ""}`}
                className={`calendar-day ${d.getMonth() !== month.getMonth() ? "muted" : ""} ${selected === key ? "chosen" : ""} ${key === day(new Date()) ? "today" : ""}`}
                onClick={() => setSelected(key)}
              >
                <span>{d.getDate()}</span>
                <span className="calendar-dots">
                  {training && <i className="training-dot" />}
                  {active && <i className="active-dot" />}
                  {logged && <i className="pain-dot" />}
                </span>
              </button>
            );
          })}
        </div>
        <p className="calendar-legend">
          <span>
            <i className="training-dot" />  {ui("Trening")} </span>
          <span>
            <i className="pain-dot" />  {ui("Wpis bólu")} </span>
          <span>
            <i className="active-dot" />  {ui("Trening w trakcie")} </span>
        </p>
      </section>
      <section className="panel">
        <h2>
          {new Date(selected + "T12:00:00").toLocaleDateString(locale(), {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h2>
        {selectedSessions.length ? (
          selectedSessions.map((s) => (
            <div className="history-row" key={s.id}>
              <p>
                {s.ended ? ui("Trening ukończony") : ui("Trening w trakcie")} ·{" "}
                {new Date(s.started).toLocaleTimeString(locale(), {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <button className="text-button" onClick={() => onEdit(s)}>
                {s.ended ? ui("Edytuj trening") : ui("Wznów trening")}
              </button>
            </div>
          ))
        ) : (
          <p>{ui("Brak treningu.")}</p>
        )}
        <p>
          {pain
            ? ui("Ból: {{v0}}", {v0: pain.values.map((value) => `${sites.find((site) => site.id === value.siteId)?.name ?? value.siteId} ${value.value}/10`).join(" \u00b7 ")})
            : ui("Brak wpisu bólu.")}
        </p>
        <div className="actions">
          <button disabled={future} onClick={() => onTraining(selected)}>
             {ui("Dodaj trening w tym dniu")} </button>
          <button
            className="secondary"
            disabled={future}
            onClick={() => onPain(selected)}
          >
            {pain ? ui("Edytuj ból") : ui("Dodaj ból")}
          </button>
        </div>
      </section>
    </>
  );
}
