import type { FormEvent } from "react";
import { day, type Injury, type PainContext, type PainLog, type RehabSite } from "../domain";
import { PainSlider } from "../PainSlider";

export function DiaryView({ date, time, pain, context, note, logs, sites, contexts, injuries, injuryIds, busy,
  onDate, onTime, onPain, onContext, onInjuries, onNote, onSave, onRemove }: {
  date: string; time: string; pain: Record<string, string>; context: string; note: string;
  logs: PainLog[]; sites: RehabSite[]; contexts: PainContext[]; injuries: Injury[]; injuryIds: string[]; busy: boolean;
  onDate: (date: string) => void; onTime: (time: string) => void;
  onPain: (siteId: string, value: string) => void; onContext: (context: string) => void;
  onInjuries: (ids: string[]) => void;
  onNote: (note: string) => void; onSave: (event: FormEvent) => void; onRemove: () => void;
}) {
  const activeSites = sites.filter((site) => site.active);
  const activeContexts = contexts.filter((item) => item.active);
  return <>
    <h1>Dziennik</h1>
    <p className="intro">Zapisz reakcję bólową dla obszarów skonfigurowanych w profilu.</p>
    <form onSubmit={onSave} className="panel">
      <div className="grid two">
        <label>Dzień<input name="painDate" required type="date" max={day(new Date())} value={date} onChange={(event) => onDate(event.target.value)} /></label>
        <label>Godzina pomiaru<input name="painTime" required type="time" value={time} onChange={(event) => onTime(event.target.value)} /></label>
      </div>
      {activeSites.map((site) => <PainSlider key={site.id} name={site.name} detail={site.bodyArea}
        value={pain[site.id] ?? ""} onChange={(value) => onPain(site.id, value)} />)}
      <fieldset className="diary-injuries">
        <legend>Powiąż raport z kontuzją (opcjonalnie)</legend>
        {!injuries.length && <p>Dodaj kontuzję w Ustawieniach profilu, aby móc przypisywać do niej raporty.</p>}
        {injuries.filter((injury) => injury.status !== "resolved" || injuryIds.includes(injury.id)).map((injury) =>
          <label key={injury.id} className="profile-config-toggle">
            <input type="checkbox" checked={injuryIds.includes(injury.id)}
              onChange={(event) => onInjuries(event.target.checked
                ? [...injuryIds, injury.id] : injuryIds.filter((id) => id !== injury.id))} />
            {injury.name} · {injury.siteIds.map((id) => sites.find((site) => site.id === id)?.name ?? id).join(", ")}
            {injury.status === "resolved" ? " (zakończona)" : injury.status === "paused" ? " (wstrzymana)" : ""}
          </label>)}
      </fieldset>
      <label>Kontekst pomiaru
        <select value={context} onChange={(event) => onContext(event.target.value)}>
          <option value="">Nie podano</option>
          {activeContexts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label>Notatka (opcjonalnie)<textarea name="painNote" maxLength={2000} value={note}
        onChange={(event) => onNote(event.target.value)} placeholder="Dodatkowe informacje" /></label>
      <div className="actions"><button disabled={busy}>Zapisz pomiar</button>
        {logs.some((log) => log.date === date) && <button type="button" className="secondary" disabled={busy} onClick={onRemove}>Usuń pomiar</button>}
      </div>
    </form>
  </>;
}
