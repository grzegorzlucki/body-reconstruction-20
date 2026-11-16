import type { FormEvent } from "react";
import { day, type PainContext, type PainLog, type RehabSite } from "../domain";

export function DiaryView({ date, time, pain, context, note, logs, sites, contexts, busy,
  onDate, onTime, onPain, onContext, onNote, onSave, onRemove }: {
  date: string; time: string; pain: Record<string, string>; context: string; note: string;
  logs: PainLog[]; sites: RehabSite[]; contexts: PainContext[]; busy: boolean;
  onDate: (date: string) => void; onTime: (time: string) => void;
  onPain: (siteId: string, value: string) => void; onContext: (context: string) => void;
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
      {activeSites.map((site) => <label className="pain-row" key={site.id}>
        <span>{site.name}<small> · {site.bodyArea}</small></span>
        <select required value={pain[site.id] ?? ""} onChange={(event) => onPain(site.id, event.target.value)}>
          <option value="">Wybierz 0–10</option>
          {Array.from({ length: 11 }, (_, value) => <option key={value} value={value}>{value} / 10</option>)}
        </select>
      </label>)}
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
