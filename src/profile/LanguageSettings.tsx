import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  isPreference,
  readCachedPreference,
  storePreference,
  ui,
  type LanguagePreference,
} from "../i18n/config";
import { pendingLanguageWrite, saveAccountLanguage } from "../account/accountRepository";
import { ToastNotice } from "../app/ToastNotice";
import { useNotice } from "../app/useNotice";

export function LanguageSettings({ profileId, persistedPreference }: { profileId?: string; persistedPreference?: LanguagePreference }) {
  const { preference, choose } = useLanguage();
  const { notice, noticeId, setNotice, clearNotice } = useNotice();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    () => profileId && pendingLanguageWrite(profileId) ? "saving" :
      "idle",
  );
  const revision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const cached = readCachedPreference(profileId);
    const pending = profileId ? pendingLanguageWrite(profileId) : undefined;
    if (pending) {
      const current = ++revision.current;
      setStatus("saving");
      observe(pending, current);
    } else if (profileId && cached?.pending && cached.value === persistedPreference) {
      storePreference(cached.value, profileId);
      setStatus("saved");
    } else if (profileId && cached?.pending) {
      const current = ++revision.current;
      setStatus("saving");
      observe(saveAccountLanguage(profileId,cached.value),current);
    }
    return () => {
      mounted.current = false;
      revision.current++;
    };
  }, [profileId, persistedPreference]);
  function observe(write: Promise<unknown>, current: number) {
    void write.then(() => {
      if (mounted.current && current === revision.current) { setStatus("saved"); setNotice("Język zmieniony."); }
    }, () => {
      if (mounted.current && current === revision.current) setStatus("error");
    });
  }
  function save(value: LanguagePreference) {
    choose(value);
    storePreference(value, profileId ?? "guest", !!profileId);
    if (!profileId) { setStatus("saved"); setNotice("Język zmieniony."); return; }
    const current = ++revision.current;
    setStatus("saving");
    observe(saveAccountLanguage(profileId, value), current);
  }
  return (
    <section className="panel language-settings">
      <label>
        {ui("Język aplikacji")}
        <select
          aria-label={ui("Język aplikacji")}
          value={preference}
          onChange={(event) => {
            if (isPreference(event.target.value)) save(event.target.value);
          }}
        >
          <option value="auto">Automatycznie / Automatic</option>
          <option value="pl">Polski</option>
          <option value="en">English</option>
        </select>
      </label>
      <p>
        {ui(
          "Język interfejsu nie zmienia nazw planów, notatek ani danych zapisanych w historii.",
        )}
      </p>
      {(status === "saving" || status === "error") && (
        <p role="status">
          {ui(
            status === "saving"
              ? "Zapisuję język…"
              : "Nie zapisano języka na koncie. Wybór działa na tym urządzeniu. Spróbuj ponownie.",
          )}
        </p>
      )}
      {status === "error" && (
        <button type="button" onClick={() => save(preference)}>
          {ui("Spróbuj ponownie")}
        </button>
      )}
      <ToastNotice message={notice} noticeId={noticeId} onDismiss={clearNotice} />
    </section>
  );
}
