import { useTranslation } from "react-i18next";
import { countLabel, ui } from "../i18n/config";
import { completedGroups, visibleSets, day, type Injury, type PainLog, type RehabSite, type Session } from "../domain";
import { sessionDose } from "../analytics/metrics";

export function TodayView({ active, sessions, logs, today, hours, sites, injuries, weeklyGoal, profileName, busy, onFinish, onWorkout, onDiary, onAnalytics }: {
  active?: Session; sessions: Session[]; logs: PainLog[]; today?: PainLog; hours: number; sites: RehabSite[]; injuries: Injury[];
  weeklyGoal: number; profileName?: string; busy: boolean; onFinish: () => void; onWorkout: () => void; onDiary: () => void; onAnalytics: (sessionId?: string) => void;
}) {
  useTranslation();
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6);
  const recentSessions = sessions.filter((session) => session.ended && day(session.started) >= day(cutoff) && day(session.started) <= day(new Date()) && sessionDose(session).performedRows > 0);
  const recent = recentSessions.length;
  const recentLogs = logs.filter((log) => log.date >= day(cutoff) && log.date <= day(new Date()));
  const reportCount = recentLogs.length;
  const diaryDays = new Set(recentLogs.map((log) => log.date)).size;
  const performedSets = recentSessions.reduce((sum, session) => sum + sessionDose(session).completed, 0);
  const last = [...sessions].filter((s) => s.ended && sessionDose(s).performedRows > 0).sort((a,b) => b.started.localeCompare(a.started))[0];
  const activeSites = sites.filter((site) => site.active);
  return <>
    <section className="heading today-heading">
      <p className="eyebrow">{ui("Dzisiaj")}</p>
      <h1>{profileName?.trim() ? ui("Cześć, {{v0}}!", {v0: profileName.trim()}) : ui("Cześć!")}</h1>
      <p>{active ? ui("Kontynuuj trening lub zapisz, jak się czujesz.") : ui("Twój plan i pomiary w jednym miejscu. W swoim tempie.")}</p>
    </section>
    <div className="today-primary-grid">
    <section className="hero today-hero"><div><span className="pill">{active ? ui("TRWAJĄCY TRENING") : ui("TWÓJ PLAN")}</span>
      <h2>{active?.planName ?? ui("Twój własny plan.")}</h2>
      <p>{active ? ui("Kontynuuj zapis serii od miejsca, w którym skończyłeś.") : ui("Plan treningu i monitor bólu · {{v0}}", {v0: activeSites.map((site) => site.name).join(" · ")})}</p>
      {active && <p className="workout-progress">{ui("Wykonano")}{completedGroups(active)} {ui("z")}{visibleSets(active).length}  {ui("serii")}</p>}
      <div className="actions">
        <button type="button" className="light" disabled={busy} onClick={onWorkout}>{active ? ui("Wznów trening") : ui("Przejdź do treningu")}</button>
        {active && <button type="button" className="secondary" disabled={busy} onClick={onFinish}>{ui("Zakończ trening")}</button>}
      </div>
      {active && <p>{ui("Możesz zakończyć trening także z mniejszą liczbą wykonanych serii.")}</p>}
    </div></section>
    <section className="panel today-diary-action" aria-label={ui("Dzisiejszy pomiar bólu")}>
      <div><h2>{today ? ui("Dzisiejszy pomiar zapisany") : ui("Jak się dziś czujesz?")}</h2>
        <p>{today ? ui("Przejrzyj zapisane oceny lub dodaj kolejny pomiar.") : ui("Oceń ból w monitorowanych obszarach.")}</p></div>
      <button type="button" className="secondary" onClick={onDiary}>{today ? ui("Zobacz pomiar bólu") : ui("Zapisz pomiar bólu")}</button>
    </section>
    </div>
    <div className="grid three"><article><p className="eyebrow">{ui("RYTM TYGODNIA")}</p><strong>{recent}<small> / {weeklyGoal} {ui("sesje")}</small></strong><p>{ui("Ukończone w ostatnich 7 dniach")}</p></article>
      <article><p className="eyebrow">{ui("POMIARY W TYGODNIU")}</p><strong>{reportCount}</strong><p>{ui("Zapisane raporty w ostatnich 7 dniach")}</p></article>
      <article><p className="eyebrow">{ui("OSTATNI TRENING")}</p><strong>{hours === Infinity ? "—" : `${Math.floor(hours)} h`}</strong><p>{ui("Czas od ostatniego treningu")}</p></article></div>
    <section className="home-analytics-summary" aria-label={ui("Podsumowanie analiz")}>
      <div><p className="eyebrow">{ui("OSTATNIE 7 DNI")}</p><strong>{countLabel("reports", reportCount)}</strong>
        <span>{diaryDays}{ui("/7 dni z pomiarami · Wykonane serie:")} {performedSets}  {ui("· Aktywne kontuzje:")} {injuries.filter((injury) => injury.status === "active").length}</span>
        {last && <span>{ui("Po ostatnim treningu:")} {logs.some((log) => log.sessionId === last.id && log.measurementPhase === "post") ? ui("pomiar zapisany") : ui("brak powiązanego pomiaru")}</span>}</div>
      <button type="button" className="secondary" onClick={() => onAnalytics(last?.id)}>{last ? ui("Reakcja po ostatnim treningu →") : ui("Zobacz analizy →")}</button>
    </section>
    <section className="section-title"><h2>{ui("Monitorowane obszary")}</h2><button type="button" className="text-button" onClick={onDiary}>{ui("Dziennik →")}</button></section>
    <div className="grid three">{activeSites.map((site, index) => <article key={site.id}><span className="site-mark">{String(index + 1).padStart(2, "0")}</span><h3>{site.name}</h3><p>{site.bodyArea}</p>
      <strong>{today?.values.find((value) => value.siteId === site.id)?.value ?? "—"}<small> / 10</small></strong><p>{today?.values.some((value) => value.siteId === site.id) ? ui("Dzisiejsza ocena bólu") : ui("Brak pomiaru")}</p></article>)}</div>
  </>;
}
