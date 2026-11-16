import type { FormEvent } from "react";
import { day, sites, type PainLog } from "../domain";

export function DiaryView({ date, time, pain, context, note, logs, busy,
  onDate, onTime, onPain, onContext, onNote, onSave, onRemove }: {
  date: string;
  time: string;
  pain: string[];
  context: string;
  note: string;
  logs: PainLog[];
  busy: boolean;
  onDate: (date: string) => void;
  onTime: (time: string) => void;
  onPain: (index: number, value: string) => void;
  onContext: (context: string) => void;
  onNote: (note: string) => void;
  onSave: (event: FormEvent) => void;
  onRemove: () => void;
}) {
  return <>
    <h1>Poranny check-in</h1>
    <p className="intro">Raz dziennie, najlepiej o 08:00. Oceniaj osobno każdą okolicę.</p>
    <form onSubmit={onSave} className="panel">
      <div className="grid two">
        <label>Dzień
          <input name="painDate" required type="date" max={day(new Date())}
            value={date} onChange={(event) => onDate(event.target.value)} />
        </label>
        <label>Godzina pomiaru
          <input name="painTime" required type="time" value={time}
            onChange={(event) => onTime(event.target.value)} />
        </label>
      </div>
      {sites.map((site, index) => <label className="pain-row" key={site}>
        <span>{site}</span>
        <select name={`pain-${site}`} required value={pain[index]}
          onChange={(event) => onPain(index, event.target.value)}>
          <option value="">Wybierz 0–10</option>
          {Array.from({ length: 11 }, (_, value) =>
            <option key={value} value={value}>{value} / 10</option>)}
        </select>
      </label>)}
      <label>Kontekst pomiaru
        <select name="painContext" value={context} onChange={(event) => onContext(event.target.value)}>
          <option value="spacer">Spacer</option>
          <option value="ćwiczenie">Ćwiczenie</option>
          <option value="spoczynek">Spoczynek</option>
          <option value="inne">Inne</option>
          <option value="">Nie podano</option>
        </select>
      </label>
      <label>Notatka (opcjonalnie)
        <textarea name="painNote" maxLength={2000} value={note}
          onChange={(event) => onNote(event.target.value)}
          placeholder="Np. dłuższy spacer, zmiana czynności, sztywność…" />
      </label>
      <div className="actions">
        <button disabled={busy}>Zapisz pomiar</button>
        {logs.some((log) => log.date === date) && <button type="button" className="secondary"
          disabled={busy} onClick={onRemove}>Usuń pomiar</button>}
      </div>
      <p className="footnote">Stała godzina nie oznacza 24 godzin od treningu. Przy większym skoku zapisz dodatkową informację w notatce i sprawdź czas utrzymywania się reakcji.</p>
    </form>
  </>;
}
