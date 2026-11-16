import { useState, type FormEvent, type Dispatch, type SetStateAction } from "react";
import type { AppRepository } from "./repository";
import { day, logSchema, type PainLog } from "../domain";

type ActionContext = {
  database: AppRepository;
  logs: PainLog[];
  profileId: string;
  cloud: boolean;
  action: (run: () => Promise<void>) => Promise<void>;
  setNotice: Dispatch<SetStateAction<string>>;
  confirmAction: (message: string) => Promise<boolean>;
};

export function usePainLogActions({ database, logs, profileId, cloud,
  action, setNotice, confirmAction }: ActionContext) {
  const [date, setDate] = useState(day(new Date()));
  const [time, setTime] = useState("08:00");
  const [pain, setPain] = useState(["", "", ""]);
  const [context, setContext] = useState("spacer");
  const [note, setNote] = useState("");

  function editDate(value: string) {
    setDate(value);
    const log = logs.find((row) => row.date === value);
    setPain(log ? log.values.map(String) : ["", "", ""]);
    setContext(log?.context || "spacer");
    setNote(log?.note || "");
    if (log) setTime(new Date(log.at).toTimeString().slice(0, 5));
  }

  async function savePain(event: FormEvent) {
    event.preventDefault();
    await action(async () => {
      if (pain.some((value) => value === "")) throw Error("Uzupełnij trzy oceny bólu.");
      const at = new Date(`${date}T${time}:00`);
      if (at.getTime() > Date.now()) throw Error("Nie zapisuj pomiaru z przyszłości.");
      const prior = logs.find((log) => log.date === date);
      const next = logSchema.parse({
        id: prior?.id || crypto.randomUUID(),
        profileId,
        date,
        at: at.toISOString(),
        values: pain.map(Number),
        context,
        note,
      });
      if (prior && !await confirmAction("Zastąpić wpis z tego dnia? Monitor bólu zostanie zaktualizowany.")) return;
      await database.logs.put(next);
      setNotice(cloud ? "Pomiar zapisany na koncie." : "Pomiar zapisany na tym urządzeniu.");
    });
  }

  async function removePain() {
    await action(async () => {
      const current = logs.find((log) => log.date === date);
      if (current && await confirmAction("Usunąć pomiar bólu z tego dnia?")) {
        await database.logs.delete(current.id);
        setPain(["", "", ""]);
        setNotice("Pomiar usunięty.");
      }
    });
  }

  return { date, time, pain, context, note, editDate, savePain, removePain,
    setTime, setPain, setContext, setNote };
}
