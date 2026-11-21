import { useTranslation } from "react-i18next";
import { ui, locale } from "../i18n/config";
import { useState, type FormEvent } from "react";
import { day, measurementPhases, measurementPhaseLabels, type MeasurementPhase, type Session, type Injury, type PainContext, type PainLog, type RehabSite } from "../domain";
import { PainSlider } from "../PainSlider";
import { diarySessions } from "../diarySessions";

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
  useTranslation();
  const editingLog = logs.find((log) => log.id === editingId);
  const activeSites = editingLog ? editingLog.values.map((value) => sites.find((site) => site.id === value.siteId) ?? {
    id: value.siteId, name: value.siteId, bodyArea: "Obszar historyczny", position: 0, active: false, archived: true,
  }) : sites.filter((site) => site.active && !site.archived);
  const [missingRatings, setMissingRatings] = useState(false);
  const activeContexts = contexts.filter((item) => item.active);
  return <>
    <h1>{ui("Dziennik")}</h1>
    <p className="intro">{ui("Zapisz reakcję bólową dla obszarów skonfigurowanych w profilu.")}</p>
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
      <div className="section-title"><h2>{editingId ? ui("Edycja pomiaru") : ui("Nowy pomiar")}</h2>{editingId && <button type="button" className="secondary" disabled={busy} onClick={onNew}>{ui("Nowy pomiar")}</button>}</div>
      <div className="grid two date-time-fields">
        <label>{ui("Dzień")}<input name="painDate" required type="date" max={day(new Date())} value={date} onChange={(event) => onDate(event.target.value)} /></label>
        <label>{ui("Godzina pomiaru")}<input name="painTime" required type="time" step="1" value={time} onChange={(event) => onTime(event.target.value)} /></label>
      </div>
      <div className="grid two date-time-fields">
        <label>{ui("Rodzaj pomiaru")}<select value={measurementPhase} onChange={(e) => onPhase(e.target.value as MeasurementPhase)}>
          {measurementPhases.map((phase) => <option key={phase} value={phase}>{ui(measurementPhaseLabels[phase])}</option>)}
        </select></label>
        <label>{ui("Powiązany trening (opcjonalnie)")}<select value={sessionId} onChange={(e) => onSession(e.target.value)}>
          <option value="">{ui("Bez powiązania")}</option>
          {diarySessions(sessions,sessionId).map((session) => <option key={session.id} value={session.id}>
            {session.activityName || session.planName || ui("Trening")} · {new Date(session.started).toLocaleString(locale())}{!diarySessions([session],"").length ? " · " + ui("Powiązanie historyczne") : ""}</option>)}
        </select></label>
      </div>
      {missingRatings && <p className="alert" role="alert">{ui("Oceń każdy monitorowany obszar. Brak bólu oznacz jako 0.")}</p>}
      {!activeSites.length && <p role="status">{ui("Brak aktywnych obszarów. Włącz monitorowanie w ustawieniach profilu.")}</p>}
      {activeSites.map((site) => <PainSlider key={site.id} name={site.name} detail={site.bodyArea}
        value={pain[site.id] ?? ""} disabled={busy} onChange={(value) => { setMissingRatings(false); onPain(site.id, value); }} />)}
      <fieldset className="diary-injuries">
        <legend>{ui("Powiąż raport z kontuzją (opcjonalnie)")}</legend>
        {!injuries.length && <p>{ui("Dodaj kontuzję w Ustawieniach profilu, aby móc przypisywać do niej raporty.")}</p>}
        {injuries.filter((injury) => injury.status !== "resolved" || injuryIds.includes(injury.id)).map((injury) =>
          <label key={injury.id} className="profile-config-toggle">
            <input type="checkbox" checked={injuryIds.includes(injury.id)}
              onChange={(event) => onInjuries(event.target.checked
                ? [...injuryIds, injury.id] : injuryIds.filter((id) => id !== injury.id))} />
            {injury.name} · {injury.siteIds.map((id) => sites.find((site) => site.id === id)?.name ?? id).join(", ")}
            {injury.status === "resolved" ? " " + ui("(zakończona)") : injury.status === "paused" ? " (wstrzymana)" : ""}
          </label>)}
      </fieldset>
      <label>{ui("Kontekst pomiaru")} <select value={context} onChange={(event) => onContext(event.target.value)}>
          <option value="">{ui("Nie podano")}</option>
          {context && !activeContexts.some((item) => item.value === context) && <option value={context}>{contexts.find((item) => item.value === context)?.label ?? context} {ui("(archiwalny)")}</option>}
          {activeContexts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label>{ui("Notatka (opcjonalnie)")}<textarea name="painNote" maxLength={2000} value={note}
        onChange={(event) => onNote(event.target.value)} placeholder={ui("Dodatkowe informacje")} /></label>
      <div className="actions"><button disabled={busy || !activeSites.length}>{ui("Zapisz pomiar")}</button>
        {editingId && <button type="button" className="secondary" disabled={busy} onClick={onRemove}>{ui("Usuń pomiar")}</button>}
      </div>
    </form>
    <section className="panel" aria-label={ui("Pomiary wybranego dnia")}>
      <h2>{ui("Pomiary")}</h2>
      <p>{ui("Możesz zapisać kilka pomiarów dziennie. Zmiana daty rozpoczyna nowy wpis.")}</p>
      {logs.filter((log) => log.date === date).sort((a,b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)).map((log) => <div className="history-row" key={log.id}>
        <span>{new Date(log.at).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })} · {ui(measurementPhaseLabels[log.measurementPhase ?? "unspecified"])}</span>
        <button type="button" className="secondary" disabled={busy} onClick={() => onEdit(log.id)}>{ui("Edytuj ten pomiar")}</button>
      </div>)}
    </section>

  </>;
}
