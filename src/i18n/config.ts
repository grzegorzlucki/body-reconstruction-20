import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { translations } from "./translations";

export type Language = "pl" | "en";
export type LanguagePreference = Language | "auto";
export const isPreference = (value: unknown): value is LanguagePreference =>
  value === "pl" || value === "en" || value === "auto";
const storageKey = "rehab-ui-language-v1";
export function readCachedPreference(
  scope = "guest",
): { value: LanguagePreference; pending: boolean } | undefined {
  try {
    const raw = localStorage.getItem(`${storageKey}:${scope}`);
    if (isPreference(raw)) return { value: raw, pending: false };
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return isPreference(parsed.value)
      ? { value: parsed.value, pending: parsed.pending === true }
      : undefined;
  } catch {
    return undefined;
  }
}
export const readPreference = (scope = "guest") =>
  readCachedPreference(scope)?.value;
export function storePreference(
  value: LanguagePreference,
  scope = "guest",
  pending = false,
) {
  try {
    localStorage.setItem(
      `${storageKey}:${scope}`,
      JSON.stringify({ value, pending }),
    );
  } catch {
    /* Memory-only mode is supported. */
  }
}
export function resolveLanguage(
  preference: LanguagePreference,
  languages: readonly string[] = typeof navigator === "undefined"
    ? []
    : navigator.languages,
): Language {
  if (preference !== "auto") return preference;
  for (const tag of languages) {
    const language = tag.toLowerCase().split("-")[0];
    if (language === "pl" || language === "en") return language;
  }
  return "pl";
}
const sourceKeys = new Map<string, string>();
const pl: Record<string, string> = {},
  en: Record<string, string> = {};
for (const [source, translation] of translations) {
  const base = translation
    .toLowerCase()
    .replace(/\{\{.*?\}\}/g, "value")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 100);
  let key = base,
    suffix = 2;
  while (pl[key] && pl[key] !== source) key = `${base}_${suffix++}`;
  sourceKeys.set(source, key);
  pl[key] = source;
  en[key] = translation;
}
export const resources = { pl: { translation: pl }, en: { translation: en } };
for (const [kind, forms] of Object.entries({
  sets: ["seria", "serie", "serii", "set", "sets"],
  reports: ["raport", "raporty", "raportów", "report", "reports"],
  exercises: ["ćwiczenie", "ćwiczenia", "ćwiczeń", "exercise", "exercises"],
  sessions: ["sesja", "sesje", "sesji", "session", "sessions"],
})) {
  for (const [suffix, index] of [
    ["one", 0],
    ["few", 1],
    ["many", 2],
    ["other", 2],
  ] as const)
    pl[`count_${kind}_${suffix}`] = `{{count}} ${forms[index]}`;
  en[`count_${kind}_one`] = `{{count}} ${forms[3]}`;
  en[`count_${kind}_other`] = `{{count}} ${forms[4]}`;
}
export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage(readPreference() ?? "auto"),
  fallbackLng: "pl",
  supportedLngs: ["pl", "en"],
  interpolation: { escapeValue: false },
  initAsync: false,
  react: { useSuspense: false },
});
export const locale = () => (i18n.language === "en" ? "en-GB" : "pl-PL");
export const countLabel = (
  kind: "sets" | "reports" | "exercises" | "sessions",
  count: number,
) => String(i18n.t(`count_${kind}`, { count }));
export const hasUiTranslation = (source: string) =>
  sourceKeys.has(source) || source.startsWith(marker);
const marker = "@rehab-message:";
// A transient descriptor keeps dialogs/toasts live when language changes. Never
// write this value into a user's name, notes, backup or database data.
export function message(
  source: string,
  values: Record<string, unknown> = {},
): string {
  return marker + JSON.stringify({ source, values });
}
export function ui(source: string, values?: Record<string, unknown>): string {
  if (source.startsWith(marker)) {
    try {
      const parsed = JSON.parse(source.slice(marker.length));
      const values = Object.fromEntries(
        Object.entries(parsed.values as Record<string, unknown>).map(
          ([key, value]) => [
            key,
            typeof value === "string" && value.startsWith(marker)
              ? ui(value)
              : value,
          ],
        ),
      );
      return ui(parsed.source, values);
    } catch {
      return source;
    }
  }
  const key = sourceKeys.get(source);
  return key ? String(i18n.t(key, values ?? {})) : source;
}
export function searchLabels(source: string): string {
  const key = sourceKeys.get(source);
  return key ? `${pl[key]} ${en[key]}` : source;
}
