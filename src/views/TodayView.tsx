import { type PainLog, type RehabSite, type Session } from "../domain";

export function TodayView({ active, sessions, today, hours, sites, weeklyGoal, onWorkout, onDiary }: {
  active?: Session; sessions: Session[]; today?: PainLog; hours: number; sites: RehabSite[];
  weeklyGoal: number; onWorkout: () => void; onDiary: () => void;
}) {
  const recent = sessions.filter((session) => session.ended && Date.now() - new Date(session.ended).getTime() < 7 * 864e5).length;
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
    <section className="section-title"><h2>Monitorowane obszary</h2><button type="button" className="text-button" onClick={onDiary}>Dziennik →</button></section>
    <div className="grid three">{activeSites.map((site, index) => <article key={site.id}><span className="site-mark">{String(index + 1).padStart(2, "0")}</span><h3>{site.name}</h3><p>{site.bodyArea}</p>
      <strong>{today?.values.find((value) => value.siteId === site.id)?.value ?? "—"}<small> / 10</small></strong><p>{today ? "Dzisiejsza ocena bólu" : "Brak pomiaru"}</p></article>)}</div>
  </>;
}
