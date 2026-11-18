import { useEffect, useMemo, useRef, useState } from "react";
import { formatTimer, timerPosition, timerSideLabel, totalSeconds } from "./intervalTimer";
import { timerForEntry, type PlanEntry, type Session } from "./domain";

type FinishStatus = NonNullable<Session["exerciseProgress"]>[number]["status"];

export function ExerciseTimer({ entry, savedStatus, disabled, onFinish, confirmAction }: {
  entry: PlanEntry;
  savedStatus?: FinishStatus;
  disabled: boolean;
  onFinish: (status: FinishStatus) => Promise<void>;
  confirmAction: (message: string) => Promise<boolean>;
}) {
  const settings = useMemo(() => timerForEntry(entry), [entry.timer, entry.sets, entry.reps]);
  const [state, setState] = useState<"idle" | "running" | "paused" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState("");
  const anchor = useRef(0);
  const base = useRef(0);
  const lastBeat = useRef(-1);
  const finishing = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const total = settings ? totalSeconds(settings) : 0;
  const position = settings ? timerPosition(settings, elapsed) : null;

  useEffect(() => {
    if (state !== "running" || !settings) return;
    const tick = () => {
      const next = Math.min(total, base.current + (performance.now() - anchor.current) / 1000);
      setElapsed(next);
      const beat = Math.floor(next);
      if (settings.sound && beat !== lastBeat.current && audio.current?.state === "running") {
        lastBeat.current = beat;
        const oscillator = audio.current.createOscillator();
        oscillator.frequency.value = next >= total ? 880 : 660;
        oscillator.connect(audio.current.destination);
        oscillator.start();
        oscillator.stop(audio.current.currentTime + 0.06);
      }
      if (next >= total && !finishing.current) {
        finishing.current = true;
        setState("done");
        void onFinish("completed").catch((error: unknown) => {
          finishing.current = false;
          setMessage(error instanceof Error ? error.message : "Nie udało się zapisać stanu ćwiczenia.");
        });
      }
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [state, total, settings, onFinish]);
  useEffect(() => () => { void audio.current?.close(); }, []);

  if (!settings) return <p role="alert">Ustaw powtórzenia i poprawne czasy zegara w planie.</p>;
  if (savedStatus) return <p className="notice" role="status">{savedStatus === "completed" ? "Zegar ukończony" : savedStatus === "finishedEarly" ? "Ćwiczenie zakończone wcześniej" : "Ćwiczenie przerwane"}</p>;

  async function finish(status: FinishStatus) {
    if (finishing.current) return;
    if (status !== "completed") {
      const question = status === "finishedEarly" ? "Zakończyć to ćwiczenie wcześniej? Niewykonane serie pozostaną niezaznaczone." : "Przerwać to ćwiczenie? Niewykonane serie pozostaną niezaznaczone.";
      if (!await confirmAction(question)) return;
    }
    finishing.current = true;
    try { await onFinish(status); }
    catch (error) {
      finishing.current = false;
      setMessage(error instanceof Error ? error.message : "Nie udało się zapisać stanu ćwiczenia.");
    }
  }
  function start() {
    if (settings?.sound) {
      audio.current ??= new AudioContext();
      void audio.current.resume().catch(() => setMessage("Dźwięk jest niedostępny. Zegar działa dalej."));
    }
    anchor.current = performance.now();
    setState("running");
  }
  return <div className="exercise-timer panel">
    <h3>Zegar HSR</h3>
    {message && <p role="alert">{message}</p>}
    <strong>{position?.phase}</strong>
    {settings.unilateral && <p className="timer-side" role="status">{timerSideLabel(position?.side)}</p>}
    <div className="timer-clock" role="timer" aria-label="Pozostały czas fazy">{formatTimer(position?.remaining ?? 0)}</div>
    <p>Seria {position?.set}/{settings.sets} · Powtórzenie {position?.rep}/{settings.reps}</p>
    <progress aria-label="Postęp ćwiczenia" max={total} value={elapsed} />
    <div className="actions">
      {state === "idle" && <button type="button" disabled={disabled} onClick={start}>Uruchom zegar</button>}
      {state === "running" && <button type="button" disabled={disabled} onClick={() => {
        base.current = Math.min(total, base.current + (performance.now() - anchor.current) / 1000);
        setElapsed(base.current);
        setState("paused");
      }}>Pauza</button>}
      {state === "paused" && <button type="button" disabled={disabled} onClick={start}>Wznów</button>}
      {(state === "running" || state === "paused") && <>
        <button type="button" className="secondary" disabled={disabled} onClick={() => void finish("finishedEarly")}>Zakończ wcześniej</button>
        <button type="button" className="secondary" disabled={disabled} onClick={() => void finish("stopped")}>Przerwij ćwiczenie</button>
      </>}
      {state === "done" && <button type="button" disabled={disabled || finishing.current} onClick={() => void finish("completed")}>Zapisz ukończenie zegara</button>}
    </div>
  </div>;
}
