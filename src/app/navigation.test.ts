import { describe, expect, it } from "vitest";
import { searchForTab, tabFromSearch } from "./navigation";

describe("GitHub Pages-safe view URLs", () => {
  it("loads a deep-linked view and falls back for unknown routes", () => {
    expect(tabFromSearch("?view=plans")).toBe("Plany");
    expect(tabFromSearch("?view=unknown")).toBe("Dzisiaj");
    expect(tabFromSearch("?view=session-editor")).toBe("Historia");
  });

  it("preserves unrelated parameters while changing views", () => {
    expect(searchForTab("?source=app&view=plans", "Trening"))
      .toBe("?source=app&view=workout");
    expect(searchForTab("?view=plans", "Dzisiaj")).toBe("");
  });
  it("routes profile sections, preserves aliases and removes stale section parameters", () => {
    expect(tabFromSearch("?view=settings")).toBe("Ustawienia");
    expect(tabFromSearch("?view=data")).toBe("Dane");
    expect(tabFromSearch("?view=profile&section=security")).toBe("Bezpieczeństwo");
    expect(tabFromSearch("?view=profile&section=unknown")).toBe("Profil");
    expect(searchForTab("?source=app", "Ustawienia")).toBe("?source=app&view=profile&section=rehabilitation");
    expect(searchForTab("?view=profile&section=personal", "Dzisiaj")).toBe("");
  });
});
