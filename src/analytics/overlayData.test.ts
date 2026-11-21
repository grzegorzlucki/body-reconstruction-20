import { describe, expect, it } from "vitest";
import { overlayData } from "./overlayData";
import { defaultTemplate, newSession, day, type PainLog } from "../domain";

describe("comparison overlay buckets", () => {
  it("preserves real zero, computes per-area daily medians and leaves missing days empty", () => {
    const log = (id: string, value: number): PainLog => ({
      id,
      profileId: "p",
      date: "2026-11-01",
      at: "2026-11-01T08:00:00Z",
      values: [{ siteId: "a", value }],
      context: "",
      note: "",
    });
    const rows = overlayData(
      "2026-11-01",
      "2026-11-03",
      [log("a", 0), log("b", 4)],
      [],
    );
    expect(rows.map((row) => row.pain)).toEqual([
      [{ siteId: "a", value: 2 }],
      [],
      [],
    ]);
    expect(
      overlayData("2026-11-01", "2026-11-01", [log("a", 0)], [])[0].pain[0]
        .value,
    ).toBe(0);
  });
  it("counts performed external and partial workouts without manufacturing sets or ongoing duration", () => {
    const start = new Date(2026, 10, 1, 12).toISOString();
    const base = newSession({}, start, defaultTemplate());
    const strength = {
      ...base,
      sets: base.sets.map((row) => ({
        ...row,
        done: row.exerciseId === base.sets[0].exerciseId && row.index === 0,
        reps: 5,
      })),
    };
    const external = {
      ...base,
      id: "external",
      activityType: "external" as const,
      sets: [],
      ended: new Date(Date.parse(start) + 1800000).toISOString(),
    };
    const [row] = overlayData(
      day(start),
      day(start),
      [],
      [strength, external, { ...base, id: "empty" }],
    );
    expect(row.training).toEqual({ sessions: 2, sets: 1, minutes: 30 });
  });
  it("bounds large ranges and handles invalid/reversed ranges", () => {
    expect(overlayData("2020-01-01", "2026-12-31", [], [])).toHaveLength(366);
    expect(overlayData("invalid", "2026-12-31", [], [])).toEqual([]);
    expect(overlayData("2026-11-02", "2026-11-01", [], [])).toEqual([]);
  });
});
