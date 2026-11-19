import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  isPreference,
  readCachedPreference,
  storePreference,
  ui,
  type LanguagePreference,
} from "../i18n/config";
import { saveAccountLanguage } from "../account/accountRepository";

export function LanguageSettings({ profileId }: { profileId?: string }) {
  const { preference, choose } = useLanguage();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    () => (readCachedPreference(profileId)?.pending ? "error" : "idle"),
  );
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revision.current++;
    };
  }, []);
  function save(value: LanguagePreference) {
    choose(value);
    storePreference(value, profileId ?? "guest", !!profileId);
    if (!profileId) return;
    const current = ++revision.current;
    setStatus("saving");
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (!mounted.current) return;
        try {
          await saveAccountLanguage(profileId, value);
          if (readCachedPreference(profileId)?.value === value)
            storePreference(value, profileId);
          if (current === revision.current) setStatus("saved");
        } catch {
          if (current === revision.current) setStatus("error");
        }
      });
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
