import { expect, it } from "vitest";
import { calendarData } from "./calendarData";
import { day, newSession, type PainLog } from "../domain";
it("keeps all reports on their recorded day, sorts instants, and does not mutate input", () => {
  const base = {
    date: "2026-11-18",
    context: "",
    note: "",
    values: [{ siteId: "achilles", value: 0 }],
  };
  const logs: PainLog[] = [
    { ...base, id: "late", at: "2026-11-18T10:00:00Z" },
    { ...base, id: "early", at: "2026-11-17T23:00:00Z" },
  ];
  const session = newSession({}, "2026-11-18T10:00:00Z");
  const data = calendarData([session], logs);
  expect(data.get(base.date)?.logs.map((log) => log.id)).toEqual([
    "early",
    "late",
  ]);
  expect(data.get(day(session.started))?.sessions).toEqual([session]);
  expect(logs[0].id).toBe("late");
  expect(data.has("2026-11-19")).toBe(false);
});
