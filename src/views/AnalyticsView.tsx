import { useMemo, useState } from "react";
import { filterLogsByInjury, summarizeAnalytics } from "../analytics";
import { PainCharts } from "../PainCharts";
import type { Injury, PainContext, PainLog, RehabSite, Session } from "../domain";

const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
const valueLabel = (value: number | null) => value === null ? "—" : `${value.toFixed(1)} / 10`;

export function AnalyticsView({ logs, sessions, sites, contexts, injuries }: {
  logs: PainLog[]; sessions: Session[]; sites: RehabSite[]; contexts: PainContext[]; injuries: Injury[];
}) {
  const [days, setDays] = useState(30);
  const [siteId, setSiteId] = useState("");
  const [injuryId, setInjuryId] = useState("");
  const summary = useMemo(() => summarizeAnalytics(logs, sessions, sites, contexts, days), [logs, sessions, sites, contexts, days]);
  const injuryLogs = useMemo(() => filterLogsByInjury(summary.logs, injuryId), [summary.logs, injuryId]);
  const previousInjuryLogs = useMemo(() => filterLogsByInjury(summary.previousLogs, injuryId), [summary.previousLogs, injuryId]);
  const scopedSummary = useMemo(() => injuryId
    ? summarizeAnalytics([...injuryLogs, ...previousInjuryLogs], sessions, sites, contexts, days)
    : summary, [injuryId, injuryLogs, previousInjuryLogs, sessions, sites, contexts, days, summary]);
  const visibleLogs = siteId ? injuryLogs.flatMap((log) => {
    const values = log.values.filter((value) => value.siteId === siteId);
    return values.length ? [{ ...log, values }] : [];
  }) : injuryLogs;
  const visibleSites = sites.filter((site) => (!siteId || site.id === siteId) && visibleLogs.some((log) => log.values.some((value) => value.siteId === site.id)));
  const visibleStats = scopedSummary.siteStats.filter(({ site }) => !siteId || site.id === siteId);
  const selectedInjury = injuries.find((injury) => injury.id === injuryId);
  const contextCounts = new Map<string, number>();
  for (const log of visibleLogs) if (log.context) contextCounts.set(log.context, (contextCounts.get(log.context) ?? 0) + 1);
  const contextsSummary = [...contextCounts].map(([value, count]) => ({ value, context: contexts.find((item) => item.value === value), count }))
    .sort((a, b) => b.count - a.count);

  return <>
    <h1>Analizy</h1>
    <p className="intro">Przeglądaj zapisane pomiary i treningi w wybranym okresie. Statystyki opisują wpisane dane, nie diagnozują przyczyn bólu.</p>
    <section className="panel analytics-filters" aria-label="Filtry analiz">
      <label>Zakres czasu
        <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
          <option value={7}>Ostatnie 7 dni</option><option value={30}>Ostatnie 30 dni</option>
          <option value={90}>Ostatnie 90 dni</option><option value={365}>Ostatni rok</option>
        </select>
      </label>
      <label>Kontuzja
        <select value={injuryId} onChange={(event) => setInjuryId(event.target.value)}>
          <option value="">Wszystkie kontuzje i raporty</option>
          {injuries.map((injury) => <option key={injury.id} value={injury.id}>{injury.name}{injury.status === "resolved" ? " · zakończona" : ""}</option>)}
        </select>
      </label>
      <label>Ścięgno lub obszar
        <select value={siteId} onChange={(event) => setSiteId(event.target.value)}>
          <option value="">Wszystkie obszary</option>
          {sites.map((site) => <option key={site.id} value={site.id}>{site.name} · {site.bodyArea}</option>)}
        </select>
      </label>
    </section>
    <p className="footnote">Okres: {dateLabel(summary.start)} – {dateLabel(summary.end)}. Dla porównania używany jest poprzedni okres o tej samej długości.</p>

    <div className="grid three analytics-summary">
      <article><p className="eyebrow">TRENINGI PROFILU</p><strong>{summary.completedSessions}</strong><p>Ukończone w tym okresie</p></article>
      <article><p className="eyebrow">RAPORTY</p><strong>{visibleLogs.length}</strong><p>Wpisy w {new Set(visibleLogs.map((log) => log.date)).size} dniach</p></article>
      <article><p className="eyebrow">AKTYWNE KONTUZJE</p><strong>{selectedInjury ? Number(selectedInjury.status === "active") : injuries.filter((injury) => injury.status === "active").length}</strong><p>{selectedInjury ? selectedInjury.name : "W całym profilu"}</p></article>
    </div>

    <section className="panel">
      <h2>Pomiary według obszaru</h2>
      {!visibleStats.length ? <p>Brak pomiarów dla wybranych filtrów i zakresu. Zapisane wartości nie są uzupełniane szacunkami.</p> :
        <div className="table-scroll" role="region" aria-label="Pomiary bólu według obszaru — tabela przewijana" tabIndex={0}><table className="analytics-table">
          <thead><tr><th scope="col">Obszar</th><th scope="col">Ostatni</th><th scope="col">Średnia</th><th scope="col">Poprzedni okres</th><th scope="col">Liczba ocen</th></tr></thead>
          <tbody>{visibleStats.map(({ site, average, previousAverage, last, count }) => {
            const delta = average !== null && previousAverage !== null ? average - previousAverage : null;
            return <tr key={site.id}><th scope="row">{site.name}<small>{site.bodyArea}</small></th>
              <td>{valueLabel(last)}</td><td>{valueLabel(average)}</td>
              <td>{valueLabel(previousAverage)}{delta !== null && <small>{delta > 0 ? "+" : ""}{delta.toFixed(1)} pkt</small>}</td>
              <td>{count}</td></tr>;
          })}</tbody>
        </table></div>}
        <p className="footnote">Średnia jest liczona z dostępnych ocen w każdym okresie. Spadek wyniku oznacza niższą zgłoszoną ocenę bólu, nie ocenę medyczną.</p>
      </section>

    {visibleLogs.length > 0 && <section className="panel"><PainCharts logs={visibleLogs} sites={visibleSites} /></section>}

    <section className="panel">
      <h2>Kontekst raportów</h2>
        {!contextsSummary.length ? <p>Brak raportów z wybranym kontekstem.</p> :
        <ul className="analytics-contexts">{contextsSummary.map(({ value, context, count }) => <li key={value}>
          <span>{context?.label ?? "Inny lub dawny kontekst"}</span><strong>{count}</strong></li>)}</ul>}
    </section>

    <section className="panel">
      <h2>Raporty</h2>
        {!visibleLogs.length ? <p>Brak raportów w wybranym okresie.</p> :
        <div className="analytics-report-list">{[...visibleLogs].sort((a, b) => b.at.localeCompare(a.at)).map((log) => (
          <article className="history-row" key={log.id}>
            <div><strong>{dateLabel(log.date)} · {new Date(log.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</strong>
              <p>{log.values.map((value) => `${sites.find((site) => site.id === value.siteId)?.name ?? value.siteId}: ${value.value}/10`).join(" · ")}</p>
              <small>{(contexts.find((context) => context.value === log.context)?.label ?? log.context) || "Bez kontekstu"}
                {log.injuryIds?.length ? ` · ${log.injuryIds.map((id) => injuries.find((injury) => injury.id === id)?.name ?? id).join(", ")}` : ""}
                {log.note ? ` · ${log.note}` : ""}</small>
            </div>
          </article>
        ))}</div>}
    </section>
  </>;
}
