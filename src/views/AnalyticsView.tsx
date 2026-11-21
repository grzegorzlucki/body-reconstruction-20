import { formatNumber } from "../i18n/formatters";
import { PeriodExplorer } from "../analytics/PeriodExplorer";
import { useTranslation } from "react-i18next";
import { ui, locale } from "../i18n/config";
import { useMemo, useState } from "react";
import { summarizeAnalytics } from "../analytics";
import { PainCharts } from "../PainCharts";
import {
  day,
  exerciseCatalog,
  measurementPhases,
  measurementPhaseLabels,
  type MeasurementPhase,
  type Injury,
  type PainContext,
  type PainLog,
  type RehabSite,
  type Session,
} from "../domain";
import { dailyMeasurements, sessionDose } from "../analytics/metrics";
import {
  useAnalyticsNavigation,
  analyticsViews,
} from "../analytics/useAnalyticsNavigation";
import { WorkoutResponseView } from "../analytics/WorkoutResponseView";
import { AreaAnalysisView } from "../analytics/AreaAnalysisView";
import { TrainingDoseView } from "../analytics/TrainingDoseView";

const screens = {
  overview: "Przegląd",
  timeline: "Oś czasu",
  response: "Reakcja po treningu",
  dose: "Dawka i regularność",
  areas: "Obszary i kontuzje",
};
const dateLabel = (value: string) => new Date(value).toLocaleString(locale());
const valueLabel = (value: number | null) =>
  value === null ? ui("Brak danych") : `${formatNumber(value)} / 10`;

export function AnalyticsView({
  logs,
  sessions,
  sites,
  contexts,
  injuries,
  onEditLog,
  onAddMeasurement,
}: {
  logs: PainLog[];
  sessions: Session[];
  sites: RehabSite[];
  contexts: PainContext[];
  injuries: Injury[];
  onEditLog: (id: string) => void;
  onAddMeasurement: (id: string, phase: MeasurementPhase) => void;
}) {
  useTranslation();
  const { filters: f, update } = useAnalyticsNavigation();
  const [reportLimit, setReportLimit] = useState(50);
  const [raw, setRaw] = useState(false);
  const validRange = f.from <= f.to;
  const days = Math.max(
    1,
    Math.round((Date.parse(f.to) - Date.parse(f.from)) / 86400000) + 1,
  );
  const filteredLogs = useMemo(
    () =>
      logs.flatMap((log) => {
        if (
          (f.injury && !log.injuryIds?.includes(f.injury)) ||
          (f.context !== "*" && log.context !== f.context) ||
          (f.phase && (log.measurementPhase ?? "unspecified") !== f.phase)
        )
          return [];
        const values = log.values.filter(
          (value) => !f.site || value.siteId === f.site,
        );
        return values.length ? [{ ...log, values }] : [];
      }),
    [logs, f.injury, f.context, f.phase, f.site],
  );
  // Session filters never infer an injury or area from timing alone.
  const scopedSessions = useMemo(() => {
    const linked = new Set(
      filteredLogs.filter((log) => log.sessionId).map((log) => log.sessionId),
    );
    return sessions.filter(
      (s) =>
        day(s.started) >= f.from &&
        day(s.started) <= f.to &&
        (!f.plan || (s.planName ?? "Trening") === f.plan) &&
        (!f.exercise || s.sets.some((r) => r.exerciseId === f.exercise)) &&
        (!(f.site || f.injury || f.context !== "*" || f.phase) ||
          linked.has(s.id)),
    );
  }, [
    sessions,
    filteredLogs,
    f.from,
    f.to,
    f.plan,
    f.exercise,
    f.site,
    f.injury,
    f.context,
    f.phase,
  ]);
  const planScopedLogs = useMemo(() => {
    if (!f.plan && !f.exercise) return filteredLogs;
    const ids = new Set(
      sessions
        .filter(
          (s) =>
            (!f.plan || (s.planName ?? "Trening") === f.plan) &&
            (!f.exercise ||
              s.sets.some((row) => row.exerciseId === f.exercise)),
        )
        .map((s) => s.id),
    );
    return filteredLogs.filter(
      (log) => log.sessionId && ids.has(log.sessionId),
    );
  }, [filteredLogs, sessions, f.plan, f.exercise]);
  const summary = useMemo(
    () =>
      summarizeAnalytics(
        planScopedLogs,
        scopedSessions,
        sites,
        contexts,
        days,
        new Date(`${f.to}T12:00:00`),
      ),
    [planScopedLogs, scopedSessions, sites, contexts, days, f.to],
  );
  const visibleLogs = validRange ? summary.logs : [];
  const daily = useMemo(() => dailyMeasurements(visibleLogs), [visibleLogs]);
  const siteById = new Map(sites.map((site) => [site.id, site]));
  const contextById = new Map(
    contexts.map((context) => [context.value, context]),
  );
  const visibleSites = sites.filter((site) => !f.site || site.id === f.site);
  const selected =
    scopedSessions.find((s) => s.id === f.session) ??
    [...scopedSessions].sort((a, b) => b.started.localeCompare(a.started))[0];
  const doses = scopedSessions.map((s) => sessionDose(s, f.exercise));
  const performed = doses.reduce((sum, dose) => sum + dose.completed, 0);
  const reports = [...visibleLogs].sort((a, b) => b.at.localeCompare(a.at));
  const timeline = [
    ...scopedSessions.map((s) => ({
      id: `session:${s.id}`,
      at: s.started,
      session: s,
      log: null,
    })),
    ...visibleLogs.map((log) => ({
      id: `log:${log.id}`,
      at: log.at,
      session: null,
      log,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const chooseSession = (id: string) =>
    update({ screen: "response", session: id });
  return (
    <>
      <h1>{ui("Analizy")}</h1>
      <p className="intro">
         {ui("Porównuj swoje pomiary z wykonaną pracą. Zależność czasowa nie wskazuje przyczyny bólu.")} </p>
      <nav className="analytics-tabs" aria-label={ui("Widoki analiz")}>
        {analyticsViews.map((screen) => (
          <button
            type="button"
            key={screen}
            className={f.screen === screen ? "" : "secondary"}
            aria-current={f.screen === screen ? "page" : undefined}
            onClick={() => update({ screen })}
          >
            {ui(screens[screen])}
          </button>
        ))}
      </nav>
      <details className="panel analytics-filter-disclosure">
        <summary>
           {ui("Filtry ·")} {f.from} – {f.to}
          {f.site ? " " + ui("· wybrany obszar") : ""}
        </summary>
        <div className="actions">
          {[7, 30, 90, 365].map((period) => (
            <button
              type="button"
              className="secondary"
              key={period}
              onClick={() => {
                const start = new Date();
                start.setDate(start.getDate() - period + 1);
                update({ from: day(start), to: day(new Date()) });
              }}
            >
              {period} {ui("dni")}</button>
          ))}
        </div>
        <div className="grid two analytics-filters">
          <label>
             {ui("Od")} <input
              type="date"
              value={f.from}
              onChange={(e) => {
                if (e.target.value) update({ from: e.target.value });
              }}
            />
          </label>
          <label>
             {ui("Do")} <input
              type="date"
              value={f.to}
              onChange={(e) => {
                if (e.target.value) update({ to: e.target.value });
              }}
            />
          </label>
          <label>
             {ui("Obszar")} <select
              value={f.site}
              onChange={(e) => update({ site: e.target.value })}
            >
              <option value="">{ui("Wszystkie obszary")}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.archived ? " " + ui("· archiwalny") : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
             {ui("Kontuzja")} <select
              value={f.injury}
              onChange={(e) => update({ injury: e.target.value })}
            >
              <option value="">{ui("Wszystkie")}</option>
              {injuries.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label>
             {ui("Kontekst")} <select
              value={f.context}
              onChange={(e) => update({ context: e.target.value })}
            >
              <option value="*">{ui("Wszystkie konteksty (mieszane)")}</option>
              <option value="">{ui("Bez kontekstu")}</option>
              {[
                ...new Set([
                  ...contexts.map((c) => c.value),
                  ...logs.map((l) => l.context).filter(Boolean),
                ]),
              ].map((value) => (
                <option key={value} value={value}>
                  {contexts.find((c) => c.value === value)?.label ?? value}
                </option>
              ))}
            </select>
          </label>
          <label>
             {ui("Faza pomiaru")} <select
              value={f.phase}
              onChange={(e) => update({ phase: e.target.value })}
            >
              <option value="">{ui("Wszystkie fazy")}</option>
              {measurementPhases.map((phase) => (
                <option key={phase} value={phase}>
                  {ui(measurementPhaseLabels[phase])}
                </option>
              ))}
            </select>
          </label>
          <label>
             {ui("Plan (nazwa w zapisanej sesji)")} <select
              value={f.plan}
              onChange={(e) => update({ plan: e.target.value })}
            >
              <option value="">{ui("Wszystkie")}</option>
              {[...new Set(sessions.map((s) => s.planName ?? "Trening"))].map(
                (name) => (
                  <option key={name}>{name}</option>
                ),
              )}
            </select>
          </label>
          <label>
             {ui("Ćwiczenie")} <select
              value={f.exercise}
              onChange={(e) => update({ exercise: e.target.value })}
            >
              <option value="">{ui("Wszystkie")}</option>
              {exerciseCatalog.map((e) => (
                <option key={e.id} value={e.id}>
                  {ui(e.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
      {validRange && <PeriodExplorer from={f.from} to={f.to} logs={visibleLogs} sessions={scopedSessions} onRange={(from, to) => update({ from, to })} />}
      {!validRange ? (
        <p role="alert">{ui("Data „Od” musi poprzedzać datę „Do”.")}</p>
      ) : (
        <>
          <p className="footnote">
            {f.from} – {f.to} · {days} {ui("dni. Daty według kalendarza urządzenia. Pomiary kontrolne mogą pochodzić spoza zakresu sesji. Filtry obszaru/kontuzji/kontekstu/fazy obejmują wyłącznie jawnie powiązane sesje; plan i ćwiczenie obejmują tylko powiązane raporty.")}</p>
          {f.context === "*" && (
            <p className="notice">
               {ui("Wyświetlasz różne konteksty. Wybierz jeden kontekst, aby porównywać podobne pomiary.")} </p>
          )}
          {f.screen === "overview" && (
            <>
              <div className="grid three analytics-summary">
                <article>
                  <h2>{ui("Wykonane serie")}</h2>
                  <strong>{performed}</strong>
                  <p>
                    {summary.completedSessions}  {ui("zakończonych sesji z pracą ·")}{" "}
                    {doses.filter((d) => d.status === "Pusty").length}  {ui("pustych ·")}{" "}
                    {doses.filter((d) => d.status === "W toku").length}  {ui("w toku")} </p>
                </article>
                <article>
                  <h2>{ui("Pomiary")}</h2>
                  <strong>{visibleLogs.length}</strong>
                  <p>
                    {summary.diaryDays}/{days}  {ui("dni ·")}{" "}
                    {Math.round((summary.diaryDays / days) * 100)}{ui("% pokrycia")} </p>
                </article>
                <article>
                  <h2>{ui("Sesje częściowe")}</h2>
                  <strong>
                    {doses.filter((d) => d.status === "Częściowy").length}
                  </strong>
                  <p>
                    {ui("z")}{scopedSessions.filter((s) => s.ended).length}{" "}
                     {ui("zakończonych sesji w zakresie")} </p>
                </article>
              </div>
              <section className="panel">
                <h2>{ui("Oceny według obszaru")}</h2>
                {!summary.siteStats.length ? (
                  <p>{ui("Brak ocen w tym i poprzednim okresie.")}</p>
                ) : (
                  <div
                    className="table-scroll"
                    role="region"
                    aria-label={ui("Statystyki obszarów")}
                    tabIndex={0}
                  >
                    <table className="analytics-table">
                      <thead>
                        <tr>
                          <th>{ui("Obszar")}</th>
                          <th>{ui("Ostatnia ocena")}</th>
                          <th>{ui("Średnia dziennych median")}</th>
                          <th>{ui("Poprzedni okres / różnica")}</th>
                          <th>{ui("Pomiary / dni")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.siteStats.map(
                          ({
                            site,
                            average,
                            previousAverage,
                            last,
                            count,
                            previousCount,
                            days: measuredDays,
                            previousDays,
                          }) => (
                            <tr key={site.id}>
                              <th scope="row">{site.name}</th>
                              <td>{valueLabel(last)}</td>
                              <td>{valueLabel(average)}</td>
                              <td>
                                {valueLabel(previousAverage)}
                                <small>
                                  {previousCount}  {ui("pomiarów /")} {previousDays} {ui("dni")}</small>
                                {average !== null &&
                                  previousAverage !== null && (
                                    <small>
                                      {average - previousAverage > 0 ? "+" : ""}
                                      {formatNumber(average - previousAverage)}{" "}
                                      {ui("pkt")}</small>
                                  )}
                              </td>
                              <td>
                                {count} / {measuredDays}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="footnote">
                   {ui("Każdy dzień z oceną ma taką samą wagę. Braki nie są zerami. Poprzedni okres ma tę samą długość i filtry.")} </p>
              </section>
              <section className="panel">
                <h2>{ui("Ostatnie sesje")}</h2>
                {!scopedSessions.length && (
                  <p>{ui("Brak powiązanych sesji w tym zakresie.")}</p>
                )}
                {[...scopedSessions]
                  .sort((a, b) => b.started.localeCompare(a.started))
                  .slice(0, 10)
                  .map((s) => (
                    <div className="history-row" key={s.id}>
                      <span>
                        {s.planName ?? "Trening"} · {dateLabel(s.started)} ·{" "}
                        {sessionDose(s).status}
                      </span>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => chooseSession(s.id)}
                      >
                         {ui("Zobacz reakcję")} </button>
                    </div>
                  ))}
              </section>
            </>
          )}
          {f.screen === "timeline" && (
            <>
              <label className="profile-config-toggle">
                <input
                  type="checkbox"
                  checked={raw}
                  onChange={(e) => setRaw(e.target.checked)}
                />
                 {ui("Wszystkie pomiary zamiast dziennych median")} </label>
              <p>
                {raw ? ui("Surowe pomiary") : ui("Jedna mediana na dzień i obszar")}{ui(". Luki nie są uzupełniane. Pełny wybrany zakres.")} </p>
              <PainCharts
                logs={raw ? visibleLogs : daily}
                sites={visibleSites}
                limit={null}
                daily={!raw}
              />
              <section className="panel">
                <h2>{ui("Wspólna oś czasu · dane tekstowe")}</h2>
                {timeline.slice(0, reportLimit).map((event) => (
                  <article className="history-row" key={event.id}>
                    <div>
                      <strong>{dateLabel(event.at)}</strong>
                      <p>
                        {event.session
                          ? `${event.session.planName ?? "Trening"} · ${sessionDose(event.session).status}`
                          : event
                              .log!.values.map(
                                (v) =>
                                  `${siteById.get(v.siteId)?.name ?? v.siteId}: ${v.value}/10`,
                              )
                              .join(" · ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        event.session
                          ? chooseSession(event.session.id)
                          : onEditLog(event.log!.id)
                      }
                    >
                       {ui("Szczegóły")} </button>
                  </article>
                ))}
                {timeline.length > reportLimit && (
                  <button
                    type="button"
                    onClick={() => setReportLimit(reportLimit + 50)}
                  >
                     {ui("Pokaż kolejne 50 zdarzeń")} </button>
                )}
              </section>
            </>
          )}
          {f.screen === "response" && (
            <>
              <label>
                {ui("Sesja")}<select
                  value={selected?.id ?? ""}
                  onChange={(e) => update({ session: e.target.value })}
                >
                  <option value="" disabled>
                     {ui("Wybierz trening")} </option>
                  {[...scopedSessions]
                    .sort((a, b) => b.started.localeCompare(a.started))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.planName ?? "Trening"} · {dateLabel(s.started)}
                      </option>
                    ))}
                </select>
              </label>
              <WorkoutResponseView
                session={selected}
                sessions={sessions}
                logs={filteredLogs}
                sites={visibleSites}
                context={f.context === "*" ? undefined : f.context}
                onAdd={onAddMeasurement}
                onEdit={onEditLog}
              />
            </>
          )}
          {f.screen === "dose" && (
            <TrainingDoseView
              sessions={[...scopedSessions].sort((a, b) =>
                b.started.localeCompare(a.started),
              )}
              allSessions={sessions}
              logs={filteredLogs}
              siteId={f.site}
              exerciseId={f.exercise}
              context={f.context === "*" ? undefined : f.context}
              onSelect={chooseSession}
            />
          )}
          {f.screen === "areas" && (
            <AreaAnalysisView
              sites={visibleSites}
              injuries={injuries}
              logs={visibleLogs}
              contexts={contexts}
              injuryId={f.injury}
              onTimeline={(site) => update({ site, screen: "timeline" })}
            />
          )}
          <section className="panel">
            <h2>{ui("Raporty ·")} {reports.length}</h2>
            {!reports.length && <p>{ui("Brak pomiarów dla wybranych filtrów.")}</p>}
            {reports.slice(0, reportLimit).map((log) => (
              <article className="history-row" key={log.id}>
                <div>
                  <strong>{dateLabel(log.at)}</strong>
                  <p>
                    {log.values
                      .map(
                        (v) =>
                          `${siteById.get(v.siteId)?.name ?? v.siteId}: ${v.value}/10`,
                      )
                      .join(" · ")}
                  </p>
                  <small>
                    {
                      ui(measurementPhaseLabels[
                        log.measurementPhase ?? "unspecified"
                      ])
                    }{" "}
                    ·{" "}
                    {contextById.get(log.context)?.label ??
                      (log.context || "Bez kontekstu")}{" "}
                    ·{" "}
                    {log.sessionId
                      ? ui("Powiązany z treningiem")
                      : ui("Bez powiązania")}
                  </small>
                  {log.note && <p>{log.note}</p>}
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onEditLog(log.id)}
                >
                   {ui("Edytuj ten pomiar")} </button>
              </article>
            ))}
            {reports.length > reportLimit && (
              <button
                type="button"
                onClick={() => setReportLimit(reportLimit + 50)}
              >
                 {ui("Pokaż kolejne 50 raportów")} </button>
            )}
          </section>
        </>
      )}
    </>
  );
}
