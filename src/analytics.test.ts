import { describe, expect, it } from "vitest";
import {
  dailyMeasurements,
  median,
  remapMeasurementSessions,
  sessionDose,
  validateMeasurementLink,
} from "./analytics/metrics";
import { matchSessionMeasurements } from "./analytics/matching";
import { summarizeAnalytics } from "./analytics";
import {
  backupSchema,
  defaultRehabSites,
  defaultPainContexts,
  defaultTemplate,
  newSession,
  type PainLog,
  type Session,
} from "./domain";

const HOUR = 3600000;
function session(): Session {
  const row = newSession({}, "2026-10-24T23:00:00.000Z", defaultTemplate());
  return {
    ...row,
    id: "session",
    profileId: "profile",
    ended: "2026-10-25T00:00:00.000Z",
    sets: row.sets.map((s) => ({ ...s, done: true, reps: 5 })),
  };
}
function log(
  id: string,
  at: string,
  value = 2,
  extras: Partial<PainLog> = {},
): PainLog {
  return {
    id,
    profileId: "profile",
    date: at.slice(0, 10),
    at,
    values: [{ siteId: "achilles", value }],
    context: "rest",
    note: "",
    ...extras,
  };
}
describe("analytics metrics", () => {
  it("gives equal weight to days, including a real zero", () => {
    const rows = [
      log("a", "2026-10-26T07:00:00.000Z", 0),
      log("b", "2026-10-26T08:00:00.000Z", 8),
      log("c", "2026-10-26T09:00:00.000Z", 10),
      log("d", "2026-10-27T07:00:00.000Z", 0),
    ];
    expect(dailyMeasurements(rows).map((r) => r.values[0].value)).toEqual([
      8, 0,
    ]);
    const result = summarizeAnalytics(
      rows,
      [],
      defaultRehabSites,
      defaultPainContexts,
      7,
      new Date("2026-10-27T12:00:00.000Z"),
    );
    expect(result.siteStats[0].average).toBe(4);
    expect(result.siteStats[0].count).toBe(4);
    expect(result.siteStats[0].last).toBe(0);
    expect(median([])).toBeNull();
    expect(median([2, 5])).toBe(3.5);
  });
  it("does not double-count L/P groups or count unchecked/zero-rep rows", () => {
    const row = session(),
      first = row.sets[0];
    const partial = {
      ...row,
      sets: [
        { ...first, side: "L" as const, done: true, reps: 5 },
        { ...first, side: "P" as const, done: true, reps: 5 },
        { ...first, index: 1, done: true, reps: 0 },
        { ...first, index: 2, done: false, reps: 10 },
      ],
    };
    expect(sessionDose(partial)).toMatchObject({
      completed: 1,
      planned: 3,
      repetitions: 10,
      status: "Częściowy",
      volume: null,
    });
    expect(
      sessionDose({
        ...row,
        sets: row.sets.map((s) => ({ ...s, done: false })),
      }).status,
    ).toBe("Pusty");
    const empty = {
      ...row,
      sets: row.sets.map((s) => ({ ...s, done: true, reps: 0 })),
    };
    expect(
      summarizeAnalytics(
        [],
        [empty],
        [],
        [],
        7,
        new Date("2026-10-26T12:00:00Z"),
      ).completedSessions,
    ).toBe(0);
  });
  it("remaps real session IDs and detaches dangling references", () => {
    const rows = [
      log("a", "2026-10-25T00:00:00.000Z", 2, { sessionId: "session" }),
      log("b", "2026-10-25T00:00:00.000Z", 3, { sessionId: "missing" }),
    ];
    expect(
      remapMeasurementSessions(rows, new Map([["session", "new"]])).map(
        (r) => r.sessionId,
      ),
    ).toEqual(["new", undefined]);
    expect(rows[0].sessionId).toBe("session");
  });
  it("validates phase timing and profile ownership", () => {
    const row = session();
    expect(() =>
      validateMeasurementLink(
        log("a", row.started, 2, {
          sessionId: row.id,
          measurementPhase: "post",
        }),
        [row],
      ),
    ).toThrow();
    expect(() =>
      validateMeasurementLink(
        log("a", row.ended!, 2, {
          sessionId: row.id,
          measurementPhase: "post",
        }),
        [row],
      ),
    ).not.toThrow();
    expect(() =>
      validateMeasurementLink(
        log("a", row.ended!, 2, { sessionId: row.id, profileId: "other" }),
        [row],
      ),
    ).toThrow();
  });
  it("continues accepting a v1 backup and retains metadata in v6", () => {
    const row = session(),
      report = log("a", row.ended!, 2, {
        sessionId: row.id,
        measurementPhase: "post",
      });
    expect(
      backupSchema.parse({
        version: 1,
        exportedAt: row.ended,
        sessions: [row],
        logs: [report],
      }).logs[0].sessionId,
    ).toBe(row.id);
    expect(
      backupSchema.safeParse({
        version: 6,
        exportedAt: row.ended,
        sessions: [],
        logs: [],
        templates: [],
        profileSettings: {
          name: "Test",
          weeklyGoal: 2,
          checkInTime: "08:00",
          rehabSites: defaultRehabSites,
          painContexts: defaultPainContexts,
          injuries: [],
        },
      }).success,
    ).toBe(true);
  });
});
describe("session measurement matching", () => {
  it("uses elapsed hours from the END across midnight and daylight-saving changes", () => {
    const row = session(),
      at = new Date(Date.parse(row.ended!) + 24 * HOUR).toISOString();
    const result = matchSessionMeasurements(
      row,
      [log("after", at)],
      [row],
      "achilles",
      "rest",
    );
    expect(result.h24).toMatchObject({ elapsedHours: 24, source: "candidate" });
    expect(result.post).toBeNull();
    expect(result.pre).toBeNull();
  });
  it("includes window boundaries but excludes just-outside measurements", () => {
    const row = session(),
      at = (hours: number) =>
        new Date(Date.parse(row.ended!) + hours * HOUR).toISOString();
    expect(
      matchSessionMeasurements(row, [log("a", at(18))], [row], "achilles").h24,
    ).not.toBeNull();
    expect(
      matchSessionMeasurements(row, [log("a", at(30))], [row], "achilles").h24,
    ).not.toBeNull();
    expect(
      matchSessionMeasurements(row, [log("a", at(30.001))], [row], "achilles")
        .h24,
    ).toBeNull();
    expect(
      matchSessionMeasurements(row, [log("a", at(42))], [row], "achilles").h48,
    ).not.toBeNull();
    expect(
      matchSessionMeasurements(row, [log("a", at(54))], [row], "achilles").h48,
    ).not.toBeNull();
  });
  it("prefers explicit links, respects context, and never reuses another session's linked log", () => {
    const row = session(),
      at = (h: number) =>
        new Date(Date.parse(row.ended!) + h * HOUR).toISOString();
    const rows = [
      log("candidate", at(24)),
      log("confirmed", at(25), 3, {
        sessionId: row.id,
        measurementPhase: "followup",
      }),
      log("other", at(24), 9, { sessionId: "another" }),
    ];
    expect(
      matchSessionMeasurements(row, rows, [row], "achilles", "rest").h24?.log
        .id,
    ).toBe("confirmed");
    expect(
      matchSessionMeasurements(row, rows, [row], "achilles", "walk").h24,
    ).toBeNull();
  });
  it("marks intervening actual activity and rejects post/during as a baseline", () => {
    const row = session(),
      next = {
        ...row,
        id: "next",
        started: "2026-10-25T15:00:00.000Z",
        ended: "2026-10-25T16:00:00.000Z",
      };
    const result = matchSessionMeasurements(
      row,
      [
        log("after", "2026-10-26T00:00:00.000Z"),
        log("before", row.started, 5, { measurementPhase: "during" }),
      ],
      [row, next],
      "achilles",
    );
    expect(result.h24?.interveningSession).toBe(true);
    expect(result.pre).toBeNull();
  });
});
