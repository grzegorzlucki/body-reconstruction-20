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

export function LanguageSettings({ profileId, persistedPreference }: { profileId?: string; persistedPreference?: LanguagePreference }) {
  const { preference, choose } = useLanguage();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    () => profileId && pendingLanguageWrite(profileId) ? "saving" :
      readCachedPreference(profileId)?.pending && readCachedPreference(profileId)?.value !== persistedPreference ? "error" : "idle",
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
    }
    return () => {
      mounted.current = false;
      revision.current++;
    };
  }, [profileId, persistedPreference]);
  function observe(write: Promise<unknown>, current: number) {
    void write.then(() => {
      if (mounted.current && current === revision.current) setStatus("saved");
    }, () => {
      if (mounted.current && current === revision.current) setStatus("error");
    });
  }
  function save(value: LanguagePreference) {
    choose(value);
    storePreference(value, profileId ?? "guest", !!profileId);
    if (!profileId) return;
    const current = ++revision.current;
    setStatus("saving");
    observe(saveAccountLanguage(profileId, value), current);
  }
  return (
    <section className="panel">
      <h2>{ui("Język aplikacji")}</h2>
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
      {status !== "idle" && (
        <p role="status">
          {ui(
            status === "saving"
              ? "Zapisuję język…"
              : status === "saved"
                ? "Język zapisany."
                : "Nie zapisano języka na koncie. Wybór działa na tym urządzeniu. Spróbuj ponownie.",
          )}
        </p>
      )}
      {status === "error" && (
        <button type="button" onClick={() => save(preference)}>
          {ui("Spróbuj ponownie")}
        </button>
      )}
    </section>
  );
}
