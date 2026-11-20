import { useMemo, type ReactNode } from "react";
import { locale, ui } from "../i18n/config";
import {
  day,
  type Injury,
  type PainLog,
  type RehabSite,
  type Session,
} from "../domain";
import { painLevelColor } from "../PainSlider";
import { dashboardData } from "./dashboardData";

function MetricIcon({
  kind,
}: {
  kind: "workout" | "diary" | "sets" | "clock";
}) {
  const paths = {
    workout: "M6 4v16M18 4v16M3 8v8M21 8v8M6 12h12",
    diary: "M9 5H5v16h14V5h-4M9 3h6v4H9zM8 12h8M8 16h5",
    sets: "M5 20V12M12 20V4M19 20V8",
    clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}
function Ring({ value, total }: { value: number; total: number }) {
  const fraction = Math.min(1, Math.max(0, value / Math.max(1, total)));
  return (
    <div className="dashboard-ring">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ring-track" cx="50" cy="50" r="40" />
        <circle
          className="ring-value"
          cx="50"
          cy="50"
          r="40"
          pathLength="100"
          strokeDasharray={`${fraction * 100} 100`}
          opacity={fraction === 0 ? 0 : 1}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div>
        <strong>{value}</strong>
        <span>/ {total}</span>
      </div>
    </div>
  );
}
function Sparkline({ values }: { values: (number | null)[] }) {
  return (
    <svg
      viewBox="0 0 240 70"
      className="dashboard-sparkline"
      aria-hidden="true"
    >
      {[0, 5, 10].map((value) => (
        <line
          key={value}
          x1="10"
          x2="230"
          y1={60 - value * 5}
          y2={60 - value * 5}
          className="spark-grid"
        />
      ))}
      {values.map((value, i) => {
        if (value === null) return null;
        const x = 10 + i * (220 / 6),
          y = 60 - value * 5,
          previous = i > 0 ? values[i - 1] : null;
        return (
          <g key={i}>
            {previous !== null && (
              <line
                x1={10 + (i - 1) * (220 / 6)}
                y1={60 - previous * 5}
                x2={x}
                y2={y}
                className="spark-line"
              />
            )}
            <circle cx={x} cy={y} r="3.5" fill={painLevelColor(value)} />
          </g>
        );
      })}
    </svg>
  );
}
const shortDate = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString(locale(), {
    day: "numeric",
    month: "short",
  });

export function TodayDashboard({
  sessions,
  logs,
  sites,
  injuries,
  weeklyGoal,
  onAnalytics,
  onDiary,
  children,
}: {
  sessions: Session[];
  logs: PainLog[];
  sites: RehabSite[];
  injuries: Injury[];
  weeklyGoal: number;
  onAnalytics: (id?: string) => void;
  onDiary: () => void;
  children?: ReactNode;
}) {
  const currentDay = day(new Date());
  const data = useMemo(
    () => dashboardData(sessions, logs),
    [sessions, logs, currentDay],
  );
  const tracked = sites.filter((site) => site.active && !site.archived);
  const sets = data.sets.reduce((sum, count) => sum + count, 0),
    maximum = Math.max(1, ...data.sets);
  const elapsed = data.last
    ? Math.max(
        0,
        Math.floor((Date.now() - Date.parse(data.last.ended!)) / 3600000),
      )
    : null;
  return (
    <section className="today-dashboard" aria-labelledby="dashboard-heading">
      <div className="dashboard-section-heading">
        <div>
          <h2 id="dashboard-heading">{ui("Twój tydzień w skrócie")}</h2>
          <p>
            {shortDate(data.days[0])} – {shortDate(data.days[6])}
          </p>
        </div>
        <button className="text-button" onClick={() => onAnalytics()}>
          {ui("Zobacz analizy →")}
        </button>
      </div>
      <div className="dashboard-metrics">
        <article className="dashboard-metric">
          <span className="dashboard-icon">
            <MetricIcon kind="workout" />
          </span>
          <h3>{ui("Cel treningowy")}</h3>
          <Ring value={data.recent.length} total={weeklyGoal} />
          <p>{ui("Treningi w ostatnich 7 dniach")}</p>
        </article>
        <article className="dashboard-metric">
          <span className="dashboard-icon diary">
            <MetricIcon kind="diary" />
          </span>
          <h3>{ui("Regularność pomiarów")}</h3>
          <Ring value={data.diaryDays} total={7} />
          <p>{ui("Dni z pomiarem bólu")}</p>
        </article>
        <article className="dashboard-metric">
          <span className="dashboard-icon sets">
            <MetricIcon kind="sets" />
          </span>
          <h3>{ui("Wykonane serie")}</h3>
          <strong className="dashboard-number">{sets}</strong>
          <div className="dashboard-bars" aria-hidden="true">
            {data.sets.map((count, index) => (
              <span key={index}>
                <i
                  style={{
                    height: `${count ? Math.max(8, (count / maximum) * 100) : 0}%`,
                  }}
                />
              </span>
            ))}
          </div>
          <p>{ui("Rzeczywista aktywność · 7 dni")}</p>
          <span className="sr-only">
            {data.days
              .map((date, i) => `${shortDate(date)}: ${data.sets[i]}`)
              .join("; ")}
          </span>
        </article>
        <article className="dashboard-metric">
          <span className="dashboard-icon clock">
            <MetricIcon kind="clock" />
          </span>
          <h3>{ui("Ostatni trening")}</h3>
          <strong className="dashboard-number">
            {elapsed === null
              ? "—"
              : elapsed < 24
                ? `${elapsed} h`
                : ui("{{v0}} dni", { v0: Math.floor(elapsed / 24) })}
          </strong>
          <p>
            {data.last
              ? data.last.planName || ui("Trening")
              : ui("Jeszcze bez treningów.")}
          </p>
          <small>{ui("Czas od zakończenia")}</small>
        </article>
      </div>
      {children}
      <div className="dashboard-section-heading dashboard-areas-heading">
        <div>
          <h2>{ui("Monitorowane obszary")}</h2>
          <p>{ui("Ból w ostatnich 7 dniach · dzienne mediany")}</p>
        </div>
        <button className="text-button" onClick={onDiary}>
          {ui("Dziennik →")}
        </button>
      </div>
      {tracked.length ? (
        <div className="dashboard-areas">
          {tracked.map((site) => {
            const values = data.days.map(
              (date) =>
                data.daily
                  .find((log) => log.date === date)
                  ?.values.find((value) => value.siteId === site.id)?.value ??
                null,
            );
            const latest = [...data.reports]
              .filter((log) =>
                log.values.some((value) => value.siteId === site.id),
              )
              .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
            const score = latest?.values.find(
              (value) => value.siteId === site.id,
            )?.value;
            return (
              <article key={site.id} className="dashboard-area">
                <div className="dashboard-area-top">
                  <div>
                    <h3>{site.name}</h3>
                    <p>{site.bodyArea}</p>
                  </div>
                  <div
                    className="dashboard-pain-score"
                    style={{
                      borderColor:
                        score === undefined ? undefined : painLevelColor(score),
                    }}
                  >
                    <strong>{score ?? "—"}</strong>
                    <span>/10</span>
                  </div>
                </div>
                <p className="dashboard-latest">
                  {latest
                    ? ui("Ostatni pomiar: {{v0}}", {
                        v0: `${shortDate(latest.date)}, ${new Date(latest.at).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}`,
                      })
                    : ui("Brak pomiarów w tym tygodniu")}
                </p>
                {latest ? (
                  <>
                    <Sparkline values={values} />
                    <div className="dashboard-chart-dates" aria-hidden="true">
                      <span>{shortDate(data.days[0])}</span>
                      <span>{shortDate(data.days[6])}</span>
                    </div>
                    <span className="sr-only">
                      {values
                        .map(
                          (value, i) =>
                            `${shortDate(data.days[i])}: ${value === null ? ui("Brak pomiaru") : `${value}/10`}`,
                        )
                        .join("; ")}
                    </span>
                  </>
                ) : (
                  <div className="dashboard-chart-empty">
                    {ui("Dodaj pomiar, aby zobaczyć wykres.")}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p>{ui("Dodaj monitorowane obszary w ustawieniach profilu.")}</p>
      )}
      <p className="dashboard-footnote">
        {ui("Luki na wykresie oznaczają brak pomiaru.")}{" "}
        {ui("Aktywne kontuzje: {{v0}}", {
          v0: injuries.filter((injury) => injury.status === "active").length,
        })}
      </p>
      {data.last && (
        <div className="dashboard-followup">
          <p>
            {ui("Po ostatnim treningu:")}{" "}
            <strong>
              {logs.some(
                (log) =>
                  log.sessionId === data.last!.id &&
                  log.measurementPhase === "post",
              )
                ? ui("pomiar zapisany")
                : ui("brak powiązanego pomiaru")}
            </strong>
          </p>
          <button
            className="text-button"
            onClick={() => onAnalytics(data.last?.id)}
          >
            {ui("Reakcja po ostatnim treningu →")}
          </button>
        </div>
      )}
    </section>
  );
}
