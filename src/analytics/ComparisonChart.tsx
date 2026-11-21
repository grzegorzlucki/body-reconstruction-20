import { useMemo, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { type PainLog, type RehabSite, type Session } from "../domain";
import { locale, ui } from "../i18n/config";
import { formatNumber } from "../i18n/formatters";
import { overlayData, type TrainingMetric } from "./overlayData";

const colors = ["#245c4a", "#b74737", "#315ca1", "#805496", "#856215"];
const metrics = {
  sessions: "Liczba treningów",
  sets: "Wykonane serie",
  minutes: "Czas aktywności (min)",
};

export function ComparisonChart({
  from,
  to,
  logs,
  sessions,
  sites,
  exercise,
}: {
  from: string;
  to: string;
  logs: PainLog[];
  sessions: Session[];
  sites: RehabSite[];
  exercise: string;
}) {
  useTranslation();
  const [metric, setMetric] = useState<TrainingMetric>("sessions");
  const [showTraining, setShowTraining] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [choice, setChoice] = useState("");
  const rows = useMemo(
    () => overlayData(from, to, logs, sessions, exercise),
    [from, to, logs, sessions, exercise],
  );
  const available = sites.filter((site) =>
    rows.some((row) => row.pain.some((value) => value.siteId === site.id)),
  );
  const selected = rows.findIndex((row) => row.date === choice);
  const index = selected < 0 ? rows.length - 1 : selected;
  const current = rows[index];
  const max = Math.max(1, ...rows.map((row) => row.training[metric]));
  const x = (i: number) =>
    58 + (rows.length <= 1 ? 320 : (i * 640) / (rows.length - 1));
  const y = (value: number) => 240 - value * 18;
  const dateLabel = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(locale(), {
      day: "numeric",
      month: "short",
    });
  function select(event: PointerEvent<SVGSVGElement>) {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix || !rows.length) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    const next =
      rows.length <= 1
        ? 0
        : Math.round(((point.x - 58) / 640) * (rows.length - 1));
    setChoice(rows[Math.max(0, Math.min(rows.length - 1, next))].date);
  }
  return (
    <section
      className="panel comparison-chart"
      aria-label={ui("Nakładanie danych")}
    >
      <h2>{ui("Ból i treningi na jednym wykresie")}</h2>
      <div className="comparison-controls">
        <label>
          <input
            type="checkbox"
            checked={showTraining}
            onChange={(event) => setShowTraining(event.target.checked)}
          />
          {ui("Treningi")}
        </label>
        <label>
          {ui("Dane treningowe")}
          <select
            value={metric}
            onChange={(event) =>
              setMetric(event.target.value as TrainingMetric)
            }
          >
            {Object.entries(metrics).map(([value, label]) => (
              <option key={value} value={value}>
                {ui(label)}
              </option>
            ))}
          </select>
        </label>
        {available.map((site, i) => (
          <label key={site.id}>
            <input
              type="checkbox"
              checked={!hidden.has(site.id)}
              onChange={() =>
                setHidden((old) => {
                  const next = new Set(old);
                  if (next.has(site.id)) next.delete(site.id);
                  else next.add(site.id);
                  return next;
                })
              }
            />
            <span
              className="comparison-swatch"
              style={{ background: colors[i % colors.length] }}
            />
            {site.name}
          </label>
        ))}
      </div>
      <p className="footnote">
        {ui(
          "Lewa oś: ból 0–10 (mediana dnia). Prawa oś: wybrane dane treningowe. Brak pomiaru oznacza lukę.",
        )}
      </p>
      {current && (
        <>
          <div className="comparison-plot">
            <svg
              viewBox="0 0 760 285"
              role="slider"
              tabIndex={0}
              aria-label={ui("Porównanie bólu i treningów")}
              aria-valuemin={0}
              aria-valuemax={rows.length - 1}
              aria-valuenow={index}
              aria-valuetext={dateLabel(current.date)}
              onPointerMove={select}
              onPointerDown={select}
              onKeyDown={(event) => {
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? rows.length - 1
                      : event.key === "ArrowRight"
                        ? index + 1
                        : event.key === "ArrowLeft"
                          ? index - 1
                          : null;
                if (next === null) return;
                event.preventDefault();
                setChoice(
                  rows[Math.max(0, Math.min(rows.length - 1, next))].date,
                );
              }}
            >
              {[0, 2, 4, 6, 8, 10].map((value) => (
                <g key={value}>
                  <line
                    x1="58"
                    x2="698"
                    y1={y(value)}
                    y2={y(value)}
                    stroke="var(--color-border)"
                  />
                  <text x="44" y={y(value) + 4} textAnchor="end">
                    {value}
                  </text>
                  {showTraining && (
                    <text x="710" y={y(value) + 4}>
                      {formatNumber((value / 10) * max)}
                    </text>
                  )}
                </g>
              ))}
              {showTraining &&
                rows.map((row, i) => (
                  <rect
                    key={row.date}
                    x={x(i) - Math.min(12, 250 / rows.length)}
                    y={240 - (row.training[metric] / max) * 180}
                    width={Math.min(24, 500 / rows.length)}
                    height={(row.training[metric] / max) * 180}
                    fill="var(--color-success)"
                    opacity={index === i ? 0.65 : 0.25}
                  />
                ))}
              {available.map(
                (site, series) =>
                  !hidden.has(site.id) && (
                    <g key={site.id} stroke={colors[series % colors.length]}>
                      {rows.map((row, i) => {
                        const value = row.pain.find(
                          (v) => v.siteId === site.id,
                        )?.value;
                        if (value === undefined) return null;
                        const previous = rows[i - 1]?.pain.find(
                          (v) => v.siteId === site.id,
                        )?.value;
                        return (
                          <g key={row.date}>
                            {previous !== undefined && (
                              <line
                                x1={x(i - 1)}
                                y1={y(previous)}
                                x2={x(i)}
                                y2={y(value)}
                                strokeWidth="2"
                                strokeDasharray={series % 2 ? "6 3" : undefined}
                              />
                            )}
                            <circle
                              cx={x(i)}
                              cy={y(value)}
                              r={index === i ? 5 : 3}
                              fill={colors[series % colors.length]}
                            >
                              <title>
                                {site.name}: {value}/10 · {dateLabel(row.date)}
                              </title>
                            </circle>
                          </g>
                        );
                      })}
                    </g>
                  ),
              )}
              <line
                x1={x(index)}
                x2={x(index)}
                y1="60"
                y2="240"
                stroke="var(--color-text)"
                strokeDasharray="3 4"
              />
              {[0, Math.floor((rows.length - 1) / 2), rows.length - 1]
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((i) => (
                  <text key={i} x={x(i)} y="266" textAnchor="middle">
                    {dateLabel(rows[i].date)}
                  </text>
                ))}
            </svg>
          </div>
          <div className="comparison-readout" aria-live="polite">
            <strong>{dateLabel(current.date)}</strong>
            {available
              .filter((site) => !hidden.has(site.id))
              .map((site) => (
                <span key={site.id}>
                  {site.name}:{" "}
                  {current.pain.find((v) => v.siteId === site.id)?.value ??
                    ui("Brak danych")}{" "}
                  / 10
                </span>
              ))}
            {showTraining && (
              <span>
                {ui(metrics[metric])}: {formatNumber(current.training[metric])}
              </span>
            )}
          </div>
        </>
      )}
      <p className="footnote">
        {ui(
          "Serie i czas dotyczą wykonanej pracy; czas obejmuje tylko zakończone sesje. Trening jest przypisany do dnia rozpoczęcia.",
        )}
      </p>
      {rows.length === 366 && (
        <p>{ui("Wykres pokazuje pierwsze 366 dni. Zawęź okres.")}</p>
      )}
    </section>
  );
}
