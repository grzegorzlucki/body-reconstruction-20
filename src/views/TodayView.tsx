import { completedGroups, visibleSets, day, type Injury, type PainLog, type RehabSite, type Session } from "../domain";

export function TodayView({ active, sessions, logs, today, hours, sites, injuries, weeklyGoal, busy, onFinish, onWorkout, onDiary, onAnalytics }: {
  active?: Session; sessions: Session[]; logs: PainLog[]; today?: PainLog; hours: number; sites: RehabSite[]; injuries: Injury[];
  weeklyGoal: number; busy: boolean; onFinish: () => void; onWorkout: () => void; onDiary: () => void; onAnalytics: () => void;
}) {
  const recent = sessions.filter((session) => session.ended && Date.now() - new Date(session.ended).getTime() < 7 * 864e5).length;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6);
  const reportCount = logs.filter((log) => log.date >= day(cutoff) && log.date <= day(new Date())).length;
  const activeSites = sites.filter((site) => site.active);
  return <>
    <section className="heading today-heading">
      <h1>Dzisiaj</h1>
      <p>{active ? "Kontynuuj trening lub zapisz, jak się czujesz." : "Twój plan i pomiary w jednym miejscu. W swoim tempie."}</p>
    </section>
    <section className="hero today-hero"><div><span className="pill">{active ? "TRWAJĄCY TRENING" : "TWÓJ PLAN"}</span>
      <h2>{active?.planName ?? "Twój własny plan."}</h2>
      <p>{active ? "Kontynuuj zapis serii od miejsca, w którym skończyłeś." : `Plan treningu i monitor bólu · ${activeSites.map((site) => site.name).join(" · ")}`}</p>
      {active && <p className="workout-progress">Wykonano {completedGroups(active)} z {visibleSets(active).length} serii</p>}
      <div className="actions">
        <button type="button" className="light" disabled={busy} onClick={onWorkout}>{active ? "Wznów trening" : "Przejdź do treningu"}</button>
        {active && <button type="button" className="secondary" disabled={busy} onClick={onFinish}>Zakończ trening</button>}
      </div>
      {active && <p>Możesz zakończyć trening także z mniejszą liczbą wykonanych serii.</p>}
    </div></section>
    <section className="panel today-diary-action" aria-label="Dzisiejszy pomiar bólu">
      <div><h2>{today ? "Dzisiejszy pomiar zapisany" : "Jak się dziś czujesz?"}</h2>
        <p>{today ? "Możesz sprawdzić lub poprawić swoje oceny." : "Oceń ból w monitorowanych obszarach."}</p></div>
      <button type="button" className="secondary" onClick={onDiary}>{today ? "Zobacz pomiar bólu" : "Zapisz pomiar bólu"}</button>
    </section>
    <div className="grid three"><article><p className="eyebrow">RYTM TYGODNIA</p><strong>{recent}<small> / {weeklyGoal} sesje</small></strong><p>Ukończone w ostatnich 7 dniach</p></article>
      <article><p className="eyebrow">DZISIEJSZY POMIAR</p><strong>{today ? "Zapisany" : "Brak wpisu"}</strong><p>{today ? "Zobacz lub popraw oceny bólu" : "Zapisz, jak się czujesz"}</p><button type="button" className="text-button" onClick={onDiary}>{today ? "Zobacz wpis" : "Zapisz pomiar"} →</button></article>
      <article><p className="eyebrow">REGENERACJA</p><strong>{hours === Infinity ? "—" : `${Math.floor(hours)} h`}</strong><p>Czas od ostatniego treningu</p></article></div>
    <section className="home-analytics-summary" aria-label="Podsumowanie analiz">
      <div><p className="eyebrow">OSTATNIE 7 DNI</p><strong>{reportCount} raportów</strong>
        <span>Aktywne kontuzje: {injuries.filter((injury) => injury.status === "active").length} · Treningi: {recent}</span></div>
      <button type="button" className="secondary" onClick={onAnalytics}>Zobacz analizy →</button>
    </section>
    <section className="section-title"><h2>Monitorowane obszary</h2><button type="button" className="text-button" onClick={onDiary}>Dziennik →</button></section>
    <div className="grid three">{activeSites.map((site, index) => <article key={site.id}><span className="site-mark">{String(index + 1).padStart(2, "0")}</span><h3>{site.name}</h3><p>{site.bodyArea}</p>
      <strong>{today?.values.find((value) => value.siteId === site.id)?.value ?? "—"}<small> / 10</small></strong><p>{today?.values.some((value) => value.siteId === site.id) ? "Dzisiejsza ocena bólu" : "Brak pomiaru"}</p></article>)}</div>
  </>;
}
