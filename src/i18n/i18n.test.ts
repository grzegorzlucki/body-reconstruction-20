import { afterEach, describe, expect, it, vi } from "vitest";
import {
  countLabel,
  i18n,
  isPreference,
  locale,
  message,
  readCachedPreference,
  readPreference,
  resolveLanguage,
  resources,
  searchLabels,
  storePreference,
  ui,
} from "./config";
import { formatNumber } from "./formatters";
import { translations } from "./translations";

afterEach(async () => {
  await i18n.changeLanguage("pl");
  vi.unstubAllGlobals();
});
describe("Polish and English UI", () => {
  it("resolves automatic language in browser preference order", () => {
    expect(resolveLanguage("auto", ["de-DE", "en-US", "pl-PL"])).toBe("en");
    expect(resolveLanguage("auto", ["pl-PL", "en-GB"])).toBe("pl");
    expect(resolveLanguage("auto", ["de-DE"])).toBe("pl");
    expect(resolveLanguage("pl", ["en-GB"])).toBe("pl");
    expect(isPreference("EN")).toBe(false);
  });
  it("has matching, nonempty resources and interpolation parameters", () => {
    const commonKeys = (language: "pl" | "en") =>
      Object.keys(resources[language].translation)
        .filter((key) => !key.startsWith("count_"))
        .sort();
    expect(commonKeys("pl")).toEqual(commonKeys("en"));
    expect(new Set(translations.map(([source]) => source)).size).toBe(
      translations.length,
    );
    for (const [source, english] of translations) {
      expect(english.trim(), source).not.toBe("");
      expect(english.match(/\{\{.*?\}\}/g)?.sort() ?? [], source).toEqual(
        source.match(/\{\{.*?\}\}/g)?.sort() ?? [],
      );
    }
  });
  it("uses the plural rules of each language", async () => {
    expect(countLabel("sets", 1)).toBe("1 seria");
    expect(countLabel("sets", 2)).toBe("2 serie");
    expect(countLabel("sets", 5)).toBe("5 serii");
    expect(countLabel("sets", 22)).toBe("22 serie");
    await i18n.changeLanguage("en");
    expect(countLabel("sets", 1)).toBe("1 set");
    expect(countLabel("sets", 2)).toBe("2 sets");
  });
  it("separates guest/account caches, validates entries and handles denied storage", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    storePreference("pl");
    storePreference("en", "account-a", true);
    storePreference("auto", "account-b");
    expect(readPreference()).toBe("pl");
    expect(readCachedPreference("account-a")).toEqual({
      value: "en",
      pending: true,
    });
    expect(readPreference("account-b")).toBe("auto");
    storage.set("rehab-ui-language-v1:account-a", '{"value":"unknown"}');
    expect(readPreference("account-a")).toBeUndefined();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("denied");
      },
    });
    expect(readPreference()).toBeUndefined();
    expect(() => storePreference("en")).not.toThrow();
  });
  it("formats presentation without changing numeric values", async () => {
    await i18n.changeLanguage("pl");
    expect(formatNumber(2.5)).toBe("2,5");
    await i18n.changeLanguage("en");
    expect(formatNumber(2.5)).toBe("2.5");
    expect(formatNumber(0)).toBe("0.0");
  });
  it("translates a pending system message at render time and preserves user values", async () => {
    const pending = message("Cześć, {{v0}}!", { v0: "Mój <profil>" });
    expect(ui(pending)).toBe("Cześć, Mój <profil>!");
    await i18n.changeLanguage("en");
    expect(ui(pending)).toBe("Hi, Mój <profil>!");
    expect(locale()).toBe("en-GB");
    expect(ui("Zegar HSR")).toBe("HSR timer");
    expect(ui("not in dictionary")).toBe("not in dictionary");
    expect(searchLabels("Wspięcia na palce")).toContain("Standing calf raise");
  });
});
