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
});
