import { useEffect, useState, type FormEvent, type Dispatch, type SetStateAction } from "react";
import type { AppRepository } from "./repository";
import { day, logSchema, type Injury, type PainContext, type PainLog, type RehabSite, type Session, type MeasurementPhase } from "../domain";

import { validateMeasurementLink } from "../analytics/metrics";

type ActionContext = {
  database: AppRepository; logs: PainLog[]; sessions: Session[]; profileId: string; cloud: boolean;
  sites: RehabSite[]; contexts: PainContext[]; injuries: Injury[]; defaultTime: string;
  action: (run: () => Promise<void>) => Promise<void>;
  setNotice: Dispatch<SetStateAction<string>>; confirmAction: (message: string) => Promise<boolean>;
};
export function usePainLogActions({ database, logs, sessions, profileId, cloud, sites, contexts, injuries, defaultTime,
  action, setNotice, confirmAction }: ActionContext) {
  const [date, setDate] = useState(day(new Date()));
  const [time, setTime] = useState(defaultTime);
  const [pain, setPain] = useState<Record<string, string>>({});
  const [context, setContext] = useState("");
  const [injuryIds, setInjuryIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  useEffect(() => setTime(defaultTime), [defaultTime]);
  const [editingId, setEditingId] = useState<string>();
  const [sessionId, setSessionId] = useState("");
  const [measurementPhase, setMeasurementPhase] = useState<MeasurementPhase>("daily");
  const [sourceAt, setSourceAt] = useState<string>();
  function newMeasurement(value = day(new Date()), linkedSession = "", phase: MeasurementPhase = "daily") {
    setEditingId(undefined); setDate(value); setPain({}); setContext(""); setNote(""); setInjuryIds([]);
    setSessionId(linkedSession); setMeasurementPhase(phase);
    const now = new Date();
    setTime(linkedSession ? now.toTimeString().slice(0, 8) : defaultTime);
    setSourceAt(linkedSession ? now.toISOString() : undefined);
  }
  function editDate(value: string) { newMeasurement(value); }
  function editLog(id: string) {
    const log = logs.find((row) => row.id === id);
    if (!log) return;
    const value = log.date;
    setEditingId(log.id); setSessionId(log.sessionId ?? ""); setMeasurementPhase(log.measurementPhase ?? "unspecified");
    setDate(value);
    setPain(Object.fromEntries((log?.values ?? []).map((item) => [item.siteId, String(item.value)])));
    setContext(log.context); setNote(log.note);
    setInjuryIds(log?.injuryIds ?? []);
    setTime(new Date(log.at).toTimeString().slice(0, 8)); setSourceAt(log.at);
  }
  async function savePain(event: FormEvent) {
    event.preventDefault();
    await action(async () => {
      const prior = logs.find((log) => log.id === editingId);
      const active = prior ? prior.values.map((value) => ({ id: value.siteId })) : sites.filter((site) => site.active && !site.archived);
      if (!active.length || active.some((site) => pain[site.id] === undefined || pain[site.id] === ""))
        throw Error("Uzupełnij ocenę każdego monitorowanego obszaru.");
      if (context && context !== prior?.context && !contexts.some((item) => item.active && item.value === context)) throw Error("Wybierz dostępny kontekst pomiaru.");
      if (injuryIds.some((id) => !injuries.some((injury) => injury.id === id))) throw Error("Wybrana kontuzja nie jest już dostępna.");
      const unchanged = sourceAt && day(sourceAt) === date && new Date(sourceAt).toTimeString().slice(0, 8) === time;
      const at = new Date(unchanged ? sourceAt : `${date}T${time.length === 5 ? time + ":00" : time}`);
      if (at.getTime() > Date.now()) throw Error("Nie zapisuj pomiaru z przyszłości.");
      if (editingId && !prior) throw Error("Edytowany pomiar już nie istnieje. Utwórz nowy.");
      const current = new Map((prior?.values ?? []).map((value) => [value.siteId, value.value]));
      for (const site of active) current.set(site.id, Number(pain[site.id]));
      const next = logSchema.parse({ id: prior?.id || crypto.randomUUID(), profileId, date, at: at.toISOString(),
        values: [...current].map(([siteId, value]) => ({ siteId, value })), injuryIds, context, note, sessionId: sessionId || undefined, measurementPhase });
      validateMeasurementLink(next, sessions);
      await database.logs.put(next);
      newMeasurement(date);
      setNotice(cloud ? "Pomiar zapisany na koncie." : "Pomiar zapisany na tym urządzeniu.");
    });
  }
  async function removePain() {
    await action(async () => {
      const current = logs.find((log) => log.id === editingId);
      if (current && await confirmAction("Usunąć ten pomiar?")) {
        await database.logs.delete(current.id); newMeasurement(date); setNotice("Pomiar usunięty.");
      }
    });
  }
  return { editingId, sessionId, measurementPhase, setSessionId, setMeasurementPhase, editLog, newMeasurement, date, time, pain, context, note, injuryIds, editDate, savePain, removePain,
    setTime, setPain, setContext, setNote, setInjuryIds };
}
