import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import {
  i18n,
  readCachedPreference,
  readPreference,
  resolveLanguage,
  storePreference,
  type LanguagePreference,
} from "./config";

const Context = createContext({
  preference: "auto" as LanguagePreference,
  choose: (_value: LanguagePreference) => {},
});
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [preference, choose] = useState<LanguagePreference>(
    () => readPreference() ?? "auto",
  );
  useEffect(() => {
    void i18n.changeLanguage(resolveLanguage(preference));
    const update = () => {
      document.documentElement.lang = i18n.language;
      document.documentElement.dir = "ltr";
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute(
          "content",
          i18n.language === "en"
            ? "Your rehabilitation workouts and pain diary."
            : "Twoje treningi rehabilitacyjne i dziennik bólu.",
        );
    };
    update();
    i18n.on("languageChanged", update);
    const auto = () => {
      if (preference === "auto")
        void i18n.changeLanguage(resolveLanguage("auto"));
    };
    window.addEventListener("languagechange", auto);
    return () => {
      i18n.off("languageChanged", update);
      window.removeEventListener("languagechange", auto);
    };
  }, [preference]);
  return (
    <I18nextProvider i18n={i18n}>
      <Context.Provider value={{ preference, choose }}>
        {children}
      </Context.Provider>
    </I18nextProvider>
  );
}
export const useLanguage = () => {
  useTranslation();
  return useContext(Context);
};

// A late profile response must not undo a manual selection made meanwhile.
export function useAccountLanguage(
  profileId?: string,
  preference?: LanguagePreference,
) {
  const { choose } = useLanguage();
  const loaded = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!profileId) return;
    if (loaded.current === profileId) return;
    loaded.current = profileId;
    const cached = readCachedPreference(profileId);
    choose(cached?.pending ? cached.value : (preference ?? "pl"));
    return () => {
      loaded.current = undefined;
      choose(readPreference() ?? "auto");
    };
  }, [profileId, choose]);
}
export function GuestLanguageSettings() {
  const { preference, choose } = useLanguage();
  return (
    <label className="language-setting">
      {i18n.language === "en" ? "Application language" : "Język aplikacji"}
      <select
        aria-label={
          i18n.language === "en" ? "Application language" : "Język aplikacji"
        }
        value={preference}
        onChange={(event) => {
          const value = event.target.value as LanguagePreference;
          storePreference(value);
          choose(value);
        }}
      >
        <option value="auto">Automatycznie / Automatic</option>
        <option value="pl">Polski</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
