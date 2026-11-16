import { useEffect, useState, type FormEvent, type Dispatch, type SetStateAction } from "react";
import type { AppRepository } from "./repository";
import { day, logSchema, type PainContext, type PainLog, type RehabSite } from "../domain";

type ActionContext = {
  database: AppRepository; logs: PainLog[]; profileId: string; cloud: boolean;
  sites: RehabSite[]; contexts: PainContext[]; defaultTime: string;
  action: (run: () => Promise<void>) => Promise<void>;
  setNotice: Dispatch<SetStateAction<string>>; confirmAction: (message: string) => Promise<boolean>;
};
export function usePainLogActions({ database, logs, profileId, cloud, sites, contexts, defaultTime,
  action, setNotice, confirmAction }: ActionContext) {
  const [date, setDate] = useState(day(new Date()));
  const [time, setTime] = useState(defaultTime);
  const [pain, setPain] = useState<Record<string, string>>({});
  const [context, setContext] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => setTime(defaultTime), [defaultTime]);
  function editDate(value: string) {
    setDate(value);
    const log = logs.filter((row) => row.date === value).sort((a, b) => b.at.localeCompare(a.at))[0];
    setPain(Object.fromEntries((log?.values ?? []).map((item) => [item.siteId, String(item.value)])));
    setContext(log?.context && contexts.some((item) => item.active && item.value === log.context) ? log.context : ""); setNote(log?.note || "");
    setTime(log ? new Date(log.at).toTimeString().slice(0, 5) : defaultTime);
  }
  async function savePain(event: FormEvent) {
    event.preventDefault();
    await action(async () => {
      const active = sites.filter((site) => site.active);
      if (!active.length || active.some((site) => pain[site.id] === undefined || pain[site.id] === ""))
        throw Error("Uzupełnij ocenę każdego monitorowanego obszaru.");
      if (context && !contexts.some((item) => item.active && item.value === context)) throw Error("Wybierz dost?pny kontekst pomiaru.");
      const at = new Date(`${date}T${time}:00`);
      if (at.getTime() > Date.now()) throw Error("Nie zapisuj pomiaru z przyszłości.");
      const prior = logs.filter((log) => log.date === date).sort((a, b) => b.at.localeCompare(a.at))[0];
      const current = new Map((prior?.values ?? []).map((value) => [value.siteId, value.value]));
      for (const site of active) current.set(site.id, Number(pain[site.id]));
      const next = logSchema.parse({ id: prior?.id || crypto.randomUUID(), profileId, date, at: at.toISOString(),
        values: [...current].map(([siteId, value]) => ({ siteId, value })), context, note });
      if (prior && !await confirmAction("Zastąpić najnowszy wpis z tego dnia?")) return;
      await database.logs.put(next);
      setNotice(cloud ? "Pomiar zapisany na koncie." : "Pomiar zapisany na tym urządzeniu.");
    });
  }
  async function removePain() {
    await action(async () => {
      const current = logs.filter((log) => log.date === date).sort((a, b) => b.at.localeCompare(a.at))[0];
      if (current && await confirmAction("Usunąć najnowszy pomiar z tego dnia?")) {
        await database.logs.delete(current.id); setPain({}); setNotice("Pomiar usunięty.");
      }
    });
  }
  return { date, time, pain, context, note, editDate, savePain, removePain, setTime, setPain, setContext, setNote };
}
