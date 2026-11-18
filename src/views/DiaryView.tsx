import { useState, type FormEvent } from "react";
import { day, measurementPhases, measurementPhaseLabels, type MeasurementPhase, type Session, type Injury, type PainContext, type PainLog, type RehabSite } from "../domain";
import { PainSlider } from "../PainSlider";

export function DiaryView({ editingId, sessionId, measurementPhase, sessions, onSession, onPhase, onEdit, onNew, date, time, pain, context, note, logs, sites, contexts, injuries, injuryIds, busy,
  onDate, onTime, onPain, onContext, onInjuries, onNote, onSave, onRemove }: {
  editingId?: string; sessionId: string; measurementPhase: MeasurementPhase; sessions: Session[];
  onSession: (id: string) => void; onPhase: (phase: MeasurementPhase) => void;
  onEdit: (id: string) => void; onNew: () => void;
  date: string; time: string; pain: Record<string, string>; context: string; note: string;
  logs: PainLog[]; sites: RehabSite[]; contexts: PainContext[]; injuries: Injury[]; injuryIds: string[]; busy: boolean;
  onDate: (date: string) => void; onTime: (time: string) => void;
  onPain: (siteId: string, value: string) => void; onContext: (context: string) => void;
  onInjuries: (ids: string[]) => void;
  onNote: (note: string) => void; onSave: (event: FormEvent) => void; onRemove: () => void;
}) {
  const editingLog = logs.find((log) => log.id === editingId);
  const activeSites = editingLog ? editingLog.values.map((value) => sites.find((site) => site.id === value.siteId) ?? {
    id: value.siteId, name: value.siteId, bodyArea: "Obszar historyczny", position: 0, active: false, archived: true,
  }) : sites.filter((site) => site.active && !site.archived);
  const [missingRatings, setMissingRatings] = useState(false);
  const activeContexts = contexts.filter((item) => item.active);
  return <>
    <h1>Dziennik</h1>
    <p className="intro">Zapisz reakcję bólową dla obszarów skonfigurowanych w profilu.</p>
    <section className="panel" aria-label="Pomiary wybranego dnia">
      <div className="section-title"><h2>{editingId ? "Edycja pomiaru" : "Nowy pomiar"}</h2>
        <button type="button" className="secondary" disabled={busy} onClick={onNew}>Nowy pomiar</button></div>
      <p>Możesz zapisać kilka pomiarów dziennie. Zmiana daty rozpoczyna nowy wpis.</p>
      {logs.filter((log) => log.date === date).sort((a,b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)).map((log) => <div className="history-row" key={log.id}>
        <span>{new Date(log.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })} · {measurementPhaseLabels[log.measurementPhase ?? "unspecified"]}</span>
        <button type="button" className="secondary" disabled={busy} onClick={() => onEdit(log.id)}>Edytuj ten pomiar</button>
      </div>)}
    </section>
    <form onSubmit={(event) => {
      const missing = activeSites.some((site) => !pain[site.id] && pain[site.id] !== "0");
      setMissingRatings(missing);
      if (missing) {
        event.preventDefault();
        event.currentTarget.querySelector<HTMLInputElement>('[data-pain-unrated="true"]')?.focus();
        return;
      }
      onSave(event);
    }} className="panel">
      <div className="grid two date-time-fields">
        <label>Dzień<input name="painDate" required type="date" max={day(new Date())} value={date} onChange={(event) => onDate(event.target.value)} /></label>
        <label>Godzina pomiaru<input name="painTime" required type="time" step="1" value={time} onChange={(event) => onTime(event.target.value)} /></label>
      </div>
      <div className="grid two date-time-fields">
        <label>Rodzaj pomiaru<select value={measurementPhase} onChange={(e) => onPhase(e.target.value as MeasurementPhase)}>
          {measurementPhases.map((phase) => <option key={phase} value={phase}>{measurementPhaseLabels[phase]}</option>)}
        </select></label>
        <label>Powiązany trening (opcjonalnie)<select value={sessionId} onChange={(e) => onSession(e.target.value)}>
          <option value="">Bez powiązania</option>
          {[...sessions].sort((a,b) => b.started.localeCompare(a.started)).map((session) => <option key={session.id} value={session.id}>
            {session.planName ?? "Trening"} · {new Date(session.started).toLocaleString("pl-PL")}</option>)}
        </select></label>
      </div>
      {missingRatings && <p className="alert" role="alert">Oceń każdy monitorowany obszar. Brak bólu oznacz jako 0.</p>}
      {activeSites.map((site) => <PainSlider key={site.id} name={site.name} detail={site.bodyArea}
        value={pain[site.id] ?? ""} disabled={busy} onChange={(value) => { setMissingRatings(false); onPain(site.id, value); }} />)}
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
          {context && !activeContexts.some((item) => item.value === context) && <option value={context}>{contexts.find((item) => item.value === context)?.label ?? context} (archiwalny)</option>}
          {activeContexts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label>Notatka (opcjonalnie)<textarea name="painNote" maxLength={2000} value={note}
        onChange={(event) => onNote(event.target.value)} placeholder="Dodatkowe informacje" /></label>
      <div className="actions"><button disabled={busy}>Zapisz pomiar</button>
        {editingId && <button type="button" className="secondary" disabled={busy} onClick={onRemove}>Usuń pomiar</button>}
      </div>
    </form>
  </>;
}
