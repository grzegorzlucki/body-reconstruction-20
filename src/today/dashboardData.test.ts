import { expect, it } from "vitest";
import { newSession, type PainLog } from "../domain";
import { dashboardData } from "./dashboardData";
import { sessionDose } from "../analytics/metrics";

it("keeps unmeasured days as gaps and uses the daily median without treating zero as missing", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const log = (id: string, date: string, value: number): PainLog => ({
    id,
    date,
    at: `${date}T08:00:00Z`,
    context: "",
    note: "",
    values: [{ siteId: "achilles", value }],
  });
  const data = dashboardData(
    [],
    [
      log("a", "2026-11-19", 0),
      log("b", "2026-11-19", 6),
      log("c", "2026-11-20", 0),
      log("future", "2026-11-21", 10),
    ],
    now,
  );
  expect(data.days).toHaveLength(7);
  expect(data.days[0]).toBe("2026-11-14");
  expect(data.diaryDays).toBe(2);
  expect(data.reports).toHaveLength(3);
  expect(data.daily.map((log) => log.values[0].value)).toEqual([3, 0]);
  expect(data.daily.some((log) => log.date === "2026-11-18")).toBe(false);
});

it("counts actual completed groups, excludes drafts and empty workouts, and finds the latest completion", () => {
  const session = newSession({}, "2026-11-19T09:00:00Z");
  session.ended = "2026-11-19T10:00:00Z";
  session.sets = session.sets.map((row) => ({ ...row, done: true }));
  const empty = {
    ...session,
    id: "empty",
    sets: session.sets.map((row) => ({ ...row, done: false })),
  };
  const draft = { ...session, id: "draft", ended: undefined };
  const data = dashboardData(
    [draft, empty, session],
    [],
    new Date("2026-11-20T12:00:00Z"),
  );
  expect(data.recent).toHaveLength(1);
  expect(data.sets.reduce((a, b) => a + b, 0)).toBe(
    sessionDose(session).completed,
  );
  expect(data.last?.id).toBe(session.id);
  expect(data.diaryDays).toBe(0);
});
