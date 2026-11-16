import { describe, expect, it } from "vitest";
import { cloudTimestamp } from "./cloudDb";
import { logSchema, sessionSchema, newSession } from "./domain";

describe("Supabase timestamps", () => {
  it("normalizes PostgreSQL offsets before validating a loaded workout", () => {
    const started = cloudTimestamp("2026-11-16T15:23:28+00:00");
    expect(started).toBe("2026-11-16T15:23:28.000Z");
    expect(sessionSchema.parse(newSession({}, started)).started).toBe(started);
  });

  it("normalizes pain-log timestamps from PostgreSQL", () => {
    const at = cloudTimestamp("2026-11-16T16:23:28+01:00");
    expect(logSchema.parse({ id: "log", date: "2026-11-16", at,
      values: [0, 0, 0], context: "", note: "" }).at)
      .toBe("2026-11-16T15:23:28.000Z");
  });
});
