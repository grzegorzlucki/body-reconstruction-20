import { useTranslation } from "react-i18next";
import { ui } from "./i18n/config";
import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { UnilateralTimerFields } from "./UnilateralTimerFields";
import {
  formatTimer,
  timerDefaults,
  timerFields,
  timerPosition,
  timerSideLabel,
  totalSeconds,
  validTimer,
  type TimerSettings,
} from "./intervalTimer";
const storageKey = (profileId: string) => `body-reconstruction-hsr-timer-v1:${profileId}`;
function loadSettings(profileId: string): TimerSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(profileId)) ||
      (profileId === "default-profile" ? localStorage.getItem("body-reconstruction-hsr-timer-v1") : null) || "null");
    if (saved && validTimer(saved)) return { ...timerDefaults, ...saved };
  } catch {
    /* Use defaults if storage is unavailable or corrupt. */
  }
  return { ...timerDefaults };
}
export function IntervalTimer({ visible, profileId = "default-profile", confirmAction }: {
  visible: boolean;
  profileId?: string;
  confirmAction: (message: string) => Promise<boolean>;
}) {
  useTranslation();
  const [settings, setSettings] = useState(() => loadSettings(profileId));
  const [remoteReady, setRemoteReady] = useState(!supabase);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "done">(
    "idle",
  );
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState("");
  const anchor = useRef(0),
    offset = useRef(0),
    lastBeat = useRef(-1);
  const audio = useRef<AudioContext | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const total = totalSeconds(settings);
  const position = validTimer(settings)
    ? timerPosition(settings, elapsed)
    : null;
  const active = status === "running" || status === "paused";
  useEffect(() => {
    if (!supabase || !visible || active) return;
    if (settingsDirty) { setRemoteReady(true); return; }
    let cancelled = false;
    void supabase.from("timer_settings").select("*").eq("profile_id", profileId).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setMessage("Nie udało się pobrać ustawień zegara z konta. Sprawdź dostęp do tabeli timer_settings w Supabase.");
          setRemoteReady(true);
          return;
        }
        if (data) {
          const next = { prepare: data.prepare_seconds, move1: data.move1_seconds,
            hold: data.hold_seconds, move2: data.move2_seconds, reps: data.reps,
            sets: data.sets, rest: data.rest_seconds, sound: data.sound,
            unilateral: data.unilateral ?? false, sidePrepare: data.side_prepare_seconds ?? 5,
            firstSide: data.first_side ?? "L" };
          if (validTimer(next)) setSettings(next);
        }
        setRemoteReady(true);
      });
    return () => { cancelled = true; };
  }, [profileId, visible, active, settingsDirty]);
  useEffect(() => {
    if (!validTimer(settings) || !remoteReady || !settingsDirty || !visible) return;
    if (supabase) {
      let cancelled = false;
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        if (cancelled) return;
        const { error } = await supabase!.from("timer_settings").upsert({ profile_id: profileId,
        prepare_seconds: settings.prepare, move1_seconds: settings.move1,
        hold_seconds: settings.hold, move2_seconds: settings.move2,
        reps: settings.reps, sets: settings.sets, rest_seconds: settings.rest,
        sound: settings.sound, unilateral: settings.unilateral ?? false,
        side_prepare_seconds: settings.sidePrepare ?? 5, first_side: settings.firstSide ?? "L" });
          if (cancelled) return;
          if (error) setMessage(error.message.includes("row-level security")
            ? "Nie można zapisać ustawień zegara na koncie. Sprawdź polityki dostępu do timer_settings w Supabase."
            : `Nie można zapisać ustawień zegara. Sprawdź migrację 20261120_unilateral_timer.sql: ${error.message}`);
          else { setSettingsDirty(false); setMessage(""); }
        }).catch(() => { if (!cancelled) setMessage("Nie można zapisać ustawień zegara. Sprawdź połączenie."); });
      return () => { cancelled = true; };
    }
    try {
      localStorage.setItem(storageKey(profileId), JSON.stringify(settings));
      setSettingsDirty(false);
    } catch {
      setMessage("Nie można zapamiętać ustawień w tej przeglądarce.");
    }
  }, [settings, profileId, remoteReady, settingsDirty, visible]);
  function beep(finish = false) {
    const ctx = audio.current;
    if (!settings.sound || !ctx || ctx.state !== "running") return;
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.frequency.value = finish ? 880 : 660;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + (finish ? 0.4 : 0.08),
    );
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + (finish ? 0.45 : 0.1));
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  function enableAudio() {
    if (!settings.sound) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current
        .resume()
        .then(() => {
          if (audio.current?.state !== "running")
            setMessage(
              "Dźwięk jest niedostępny. Sprawdź ustawienia przeglądarki.",
            );
        })
        .catch(() =>
          setMessage("Nie udało się uruchomić dźwięku. Zegar działa dalej."),
        );
    } catch {
      setMessage(
        "Ta przeglądarka nie obsługuje piknięć. Zegar działa bez dźwięku.",
      );
    }
  }
  useEffect(() => {
    if (status !== "running") return;
    const update = () => {
      const next = Math.min(
        total,
        offset.current + (performance.now() - anchor.current) / 1000,
      );
      setElapsed(next);
      const beat = Math.floor(next);
      if (beat !== lastBeat.current) {
        lastBeat.current = beat;
        beep(next >= total);
      }
      if (next >= total) setStatus("done");
    };
    update();
    const id = window.setInterval(update, 40);
    return () => window.clearInterval(id);
  }, [status, settings, total]);
  useEffect(() => {
    if (status !== "running" || !("wakeLock" in navigator)) return;
    let cancelled = false;
    let lock: WakeLockSentinel | undefined;
    async function acquire() {
      if (document.visibilityState !== "visible" || (lock && !lock.released))
        return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) await next.release();
        else lock = next;
      } catch {
        /* Screen lock is best effort. */
      }
    }
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, [status]);
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
  useEffect(
    () => () => {
      void audio.current?.close().catch(() => {});
    },
    [],
  );
  function start() {
    setMessage("");
    enableAudio();
    offset.current = 0;
    anchor.current = performance.now();
    lastBeat.current = 0;
    setElapsed(0);
    setStatus("running");
  }
  function pause() {
    offset.current = Math.min(
      total,
      offset.current + (performance.now() - anchor.current) / 1000,
    );
    setElapsed(offset.current);
    setStatus(offset.current >= total ? "done" : "paused");
  }
  if (!visible) return null;
  return (
    <section className="hsr-timer">
      <div className="heading">
        <p className="eyebrow">{ui("TWÓJ RYTM ĆWICZENIA")}</p>
        <h1>{ui("Zegar HSR")}</h1>
        <p>{ui("Ruch 1 → zatrzymanie → ruch 2. Ty wybierasz kierunek ruchu.")}</p>
      </div>
      {message && (
        <p role="status" className="notice">
          {ui(message)}
        </p>
      )}
      {active || status === "done" ? (
        <div className={`panel timer-display timer-${position?.kind}`}>
          <p className="eyebrow" role="status">
            {status === "paused"
              ? "PAUZA"
              : status === "done"
                ? ui("UKOŃCZONO")
                : ui("W TOKU")}
          </p>
          <h2 aria-live="polite">{ui(position?.phase ?? "")}</h2>
          {settings.unilateral && <p className="timer-side" role="status">{ui(timerSideLabel(position?.side))}</p>}
          <div
            className="timer-clock"
            role="timer"
            aria-label={ui("Pozostały czas fazy")}
          >
            {formatTimer(position?.remaining ?? 0)}
          </div>
          <div className="timer-counts">
            <span>
               {ui("Powtórzenie")}{" "}
              <b>
                {position?.rep}/{settings.reps}
              </b>
            </span>
            <span>
               {ui("Seria")}{" "}
              <b>
                {position?.set}/{settings.sets}
              </b>
            </span>
          </div>
          <progress aria-label={ui("Postęp zegara")} max={total} value={elapsed} />
          <p>
             {ui("Do końca:")} {formatTimer(Math.ceil(total - elapsed))}
            {position?.kind === "rest"
              ? " " + ui("· Następna seria: {{v0}}", { v0: (position?.set ?? 0) + 1 })
              : ""}
          </p>
          <div className="actions">
            {status === "running" && <button onClick={pause}>{ui("Pauza")}</button>}
            {status === "paused" && (
              <button
                onClick={() => {
                  enableAudio();
                  anchor.current = performance.now();
                  setStatus("running");
                }}
              >
                 {ui("Wznów")} </button>
            )}
            {active && (
              <button
                className="secondary"
                onClick={async () => {
                  if (await confirmAction("Zakończyć odliczanie?")) {
                    setStatus("idle");
                    setElapsed(0);
                  }
                }}
              >
                 {ui("Zakończ")} </button>
            )}
            {status === "done" && (
              <>
                <button onClick={start}>{ui("Uruchom ponownie")}</button>
                <button
                  className="secondary"
                  onClick={() => {
                    setStatus("idle");
                    setElapsed(0);
                  }}
                >
                   {ui("Zmień ustawienia")} </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (validTimer(settings)) start();
          }}
        >
          <div className="panel">
            <h2>{ui("Ustawienia zegara")}</h2>
            <p>
               {ui("Czasy w sekundach. Wpisz 0, żeby pominąć fazę ruchu, początkowe przygotowanie lub przerwę. Ostatnie 5 sekund każdej przerwy to przygotowanie do następnej serii.")} </p>
            <div className="timer-settings">
              {timerFields.map(([key, label, min, max]) => (
                <label className={`timer-field timer-${key}`} key={key}>
                  <span>
                    {ui(label)}
                    <small>
                      {key === "reps" || key === "sets" ? "liczba" : "sekundy"}
                    </small>
                  </span>
                  <input
                    aria-label={ui(label)}
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    step="1"
                    required
                    value={Number.isNaN(settings[key]) ? "" : settings[key]}
                    onChange={(event) => {
                      setSettingsDirty(true);
                      setSettings({
                        ...settings,
                        [key]:
                          event.target.value === ""
                            ? NaN
                            : Number(event.target.value),
                      });
                    }}
                  />
                </label>
              ))}
            </div>
            <UnilateralTimerFields settings={settings} onChange={(patch) => {
              setSettingsDirty(true); setSettings((current) => ({ ...current, ...patch }));
            }} />
            <label>
               {ui("Dźwięk")} <select
                aria-label={ui("Dźwięk")}
                value={settings.sound ? "beep" : "silent"}
                onChange={(event) => {
                  setSettingsDirty(true);
                  setSettings({
                    ...settings,
                    sound: event.target.value === "beep",
                  });
                }}
              >
                <option value="beep">{ui("Piknięcia co sekundę")}</option>
                <option value="silent">{ui("Cisza")}</option>
              </select>
            </label>
            {!validTimer(settings) && (
              <p role="alert">
                 {ui("Wpisz całkowite wartości w dozwolonym zakresie. Powtórzenia i serie: 1–100, czasy: 0–3600 s. Przynajmniej jedna faza ruchu musi trwać dłużej niż 0 sekund.")} </p>
            )}
          </div>
          <div className="panel timer-summary">
            <div>
              <span>{ui("Łączny czas")}</span>
              <strong>{validTimer(settings) ? formatTimer(total) : "—"}</strong>
              {settings.unilateral && <p>{settings.reps}  {ui("powtórzeń na każdą stronę ·")} {settings.sets}  {ui("serii obu stron")}</p>}
            </div>
            <button disabled={!validTimer(settings)} type="submit">
               {ui("Start")} </button>
          </div>
        </form>
      )}
      <p className="footnote">
        {ui("Przygotowanie jest przed pierwszą serią oraz w ostatnich sekundach każdej przerwy. Końcowe przygotowanie do serii wlicza się w przerwę. W trybie jednostronnym osobne przygotowanie do zmiany strony wydłuża serię, a odpoczynek jest dopiero po obu stronach. Zegar działa także w innych zakładkach tej aplikacji. Podczas ćwiczenia pozostaw aplikację na ekranie — blokada telefonu lub przejście do innej aplikacji może zakłócić dźwięk. Ustawienia zapisują się automatycznie na tym urządzeniu.")}</p>
    </section>
  );
}
