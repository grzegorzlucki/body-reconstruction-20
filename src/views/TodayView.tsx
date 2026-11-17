import { day, type Injury, type PainLog, type RehabSite, type Session } from "../domain";

export function TodayView({ active, sessions, logs, today, hours, sites, injuries, weeklyGoal, onWorkout, onDiary, onAnalytics }: {
  active?: Session; sessions: Session[]; logs: PainLog[]; today?: PainLog; hours: number; sites: RehabSite[]; injuries: Injury[];
  weeklyGoal: number; onWorkout: () => void; onDiary: () => void; onAnalytics: () => void;
}) {
  const recent = sessions.filter((session) => session.ended && Date.now() - new Date(session.ended).getTime() < 7 * 864e5).length;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6);
  const reportCount = logs.filter((log) => log.date >= day(cutoff) && log.date <= day(new Date())).length;
  const activeSites = sites.filter((site) => site.active);
  return <>
    <section className="heading"><p className="eyebrow">TWÓJ DZISIEJSZY KROK</p>
      <h1>{active ? "Wróć do treningu" : "Wracaj do ruchu."}<br /><em>W swoim tempie.</em></h1>
      <p>{active ? "Trening czeka na kolejną serię." : "Zapisz reakcję. Wykonaj plan. Daj sobie czas."}</p>
    </section>
    <section className="hero today-hero"><div><span className="pill">{active ? "TRWAJĄCY TRENING" : "TWÓJ PLAN"}</span>
      <h2>{active?.planName ?? "Twój własny plan."}</h2>
      <p>{active ? "Kontynuuj zapis serii od miejsca, w którym skończyłeś." : `Plan treningu i monitor bólu · ${activeSites.map((site) => site.name).join(" · ")}`}</p>
      <button type="button" className="light" onClick={onWorkout}>{active ? "Wznów trening" : "Przejdź do treningu"}</button>
    </div></section>
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
      <strong>{today?.values.find((value) => value.siteId === site.id)?.value ?? "—"}<small> / 10</small></strong><p>{today ? "Dzisiejsza ocena bólu" : "Brak pomiaru"}</p></article>)}</div>
  </>;
}
