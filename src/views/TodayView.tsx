import { sites, type PainLog, type Session } from "../domain";

export function TodayView({ active, sessions, today, hours, onWorkout, onDiary }: {
  active?: Session;
  sessions: Session[];
  today?: PainLog;
  hours: number;
  onWorkout: () => void;
  onDiary: () => void;
}) {
  const recent = sessions.filter((session) => session.ended &&
    Date.now() - new Date(session.ended).getTime() < 7 * 864e5).length;
  return <>
    <section className="heading">
      <p className="eyebrow">TWÓJ DZISIEJSZY KROK</p>
      <h1>{active ? "Wróć do treningu" : "Wracaj do ruchu."}<br /><em>W swoim tempie.</em></h1>
      <p>{active ? "Trening czeka na kolejną serię." : "Zapisz reakcję. Wykonaj plan. Daj sobie czas."}</p>
    </section>
    <section className="hero today-hero">
      <div>
        <span className="pill">{active ? "TRWAJĄCY TRENING" : "TWÓJ PLAN"}</span>
        <h2>{active?.planName ?? "Twój własny plan."}</h2>
        <p>{active ? "Kontynuuj zapis serii od miejsca, w którym skończyłeś." : `Plan treningu i monitor bólu · ${sites.join(" · ")}`}</p>
        <button type="button" className="light" onClick={onWorkout}>
          {active ? "Wznów trening" : "Przejdź do treningu"} <span aria-hidden="true">↗</span>
        </button>
      </div>
    </section>
    <div className="grid three">
      <article><p className="eyebrow">RYTM TYGODNIA</p><strong>{recent}<small> / 2 sesje</small></strong><p>Ukończone w ostatnich 7 dniach</p></article>
      <article><p className="eyebrow">DZISIEJSZY POMIAR</p><strong>{today ? "Zapisany" : "Brak wpisu"}</strong>
        <p>{today ? "Zobacz lub popraw oceny bólu" : "Zapisz, jak czują się ścięgna"}</p>
        <button type="button" className="text-button" onClick={onDiary}>{today ? "Zobacz wpis" : "Zapisz ból"} →</button></article>
      <article><p className="eyebrow">REGENERACJA</p><strong>{hours === Infinity ? "—" : `${Math.floor(hours)} h`}</strong><p>Czas od ostatniego treningu</p></article>
    </div>
    <section className="section-title"><h2>Jak czują się ścięgna?</h2>
      <button type="button" className="text-button" onClick={onDiary}>Dziennik →</button></section>
    <div className="grid three">{sites.map((site, index) => <article key={site}>
      <span className="site-mark">0{index + 1}</span><h3>{site}</h3>
      <strong>{today?.values[index] ?? "—"}<small> / 10</small></strong>
      <p>{today ? "Dzisiejsza ocena bólu" : "Brak pomiaru"}</p>
    </article>)}</div>
    <p className="footnote">Regularność jest ważniejsza od pośpiechu. Propozycje aplikacji wymagają Twojego zatwierdzenia.</p>
  </>;
}
