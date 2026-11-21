import { day, type PainLog, type Session } from "../domain";
import { ui, locale } from "../i18n/config";
import { useState } from "react";
export function PeriodExplorer({
  from,
  to,
  logs,
  sessions,
  onRange,
}: {
  from: string;
  to: string;
  logs: PainLog[];
  sessions: Session[];
  onRange: (from: string, to: string) => void;
}) {
  const [choice, setSelected] = useState(day(new Date()));
  const selected = choice < from || choice > to ? from : choice;
  const reports = logs
    .filter((log) => log.date === selected)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const workouts = sessions.filter((s) => day(s.started) === selected);
  const days: string[] = [];
  const date = new Date(from + "T12:00:00");
  while (day(date) <= to && days.length < 366) {
    days.push(day(date));
    date.setDate(date.getDate() + 1);
  }
  const counts = days.map(
    (date) =>
      sessions.filter(
        (s) =>
          day(s.started) === date &&
          (s.activityType === "external" || s.sets.some((row) => row.done && row.reps > 0)),
      ).length,
  );
  const max = Math.max(1, ...counts);
  const time = (value: string) =>
    new Date(value).toLocaleTimeString(locale(), {
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <section className="panel period-explorer">
      <h2>{ui("Okres i szczegóły dnia")}</h2>
      <div className="actions">
        {[7, 30, 90].map((length) => (
          <button
            className="secondary"
            key={length}
            onClick={() => {
              const start = new Date();
              start.setDate(start.getDate() - length + 1);
              onRange(day(start), day(new Date()));
            }}
          >
            {length} {ui("dni")}
          </button>
        ))}
        <button
          className="secondary"
          onClick={() => onRange(selected, selected)}
        >
          {ui("Tylko wybrany dzień")}
        </button>
      </div>
      <h3>{ui("Treningi w wybranym okresie")}</h3>
      <p>{ui("Wybierz słupek dnia, aby zobaczyć godziny i pomiary.")}</p>
      <div className="period-days">
        {days.map((date, i) => (
          <button
            key={date}
            className="period-day"
            aria-pressed={selected === date}
            aria-label={`${date}: ${counts[i]} ${ui("Treningi")}`}
            onClick={() => setSelected(date)}
          >
            <span className="period-bar">
              <i style={{ height: `${(counts[i] / max) * 100}%` }} />
            </span>
            <small>{date.slice(5)}</small>
            <strong>{counts[i]}</strong>
          </button>
        ))}
      </div>
      {days.length === 366 && (
        <p>{ui("Wykres pokazuje pierwsze 366 dni. Zawęź okres.")}</p>
      )}
      <label>
        {ui("Szczegóły dnia")}
        <input
          type="date"
          min={from}
          max={to}
          value={selected}
          onChange={(event) => {
            if (event.target.value) setSelected(event.target.value);
          }}
        />
      </label>
      <h3>{ui("Treningi")}</h3>
      {!workouts.length && <p>{ui("Brak treningu.")}</p>}
      {workouts.map((s) => (
        <p key={s.id}>
          <strong>
            {time(s.started)}
            {s.ended ? ` – ${time(s.ended)}` : ""}
          </strong>{" "}
          · {s.activityName || s.planName || ui("Trening")} ·{" "}
          {ui(s.ended ? "Trening ukończony" : "Trening w trakcie")}
        </p>
      ))}
      <h3>{ui("Pomiary bólu")}</h3>
      {!reports.length && <p>{ui("Brak wpisu bólu.")}</p>}
      <div className="period-hours" aria-label={ui("Godziny pomiarów bólu")}>
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={hour}>
            <span>{hour.toString().padStart(2, "0")}:00</span>
            {reports
              .filter((log) => new Date(log.at).getHours() === hour)
              .map((log) => (
                <article key={log.id}>
                  <strong>{time(log.at)}</strong>
                  <p>
                    {log.values
                      .map((value) => `${value.siteId}: ${value.value}/10`)
                      .join(" · ")}
                  </p>
                  {log.note && <p>{log.note}</p>}
                </article>
              ))}
          </div>
        ))}
      </div>
      <p>
        {ui(
          "Zbieżność czasowa treningu i bólu nie oznacza związku przyczynowego.",
        )}
      </p>
    </section>
  );
}
