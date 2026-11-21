import { expect, it } from "vitest";
import { sessionSchema, newSession, backupSchema } from "./domain";
import { sessionDose } from "./analytics/metrics";
import { dashboardData } from "./today/dashboardData";
const external = {
  id: "run",
  activityType: "external" as const,
  activityName: "Running",
  started: "2026-11-20T08:00:00Z",
  ended: "2026-11-20T09:00:00Z",
  sets: [],
  plan: [] as [],
  note: "",
};
it("validates external activity without inventing exercise sets", () => {
  expect(sessionSchema.parse(external).activityName).toBe("Running");
  expect(sessionDose(external).performed).toBe(true);
  expect(sessionDose(external).completed).toBe(0);
  for (const change of [
    { activityName: "" },
    { ended: undefined },
    { ended: external.started },
    {
      sets: [
        {
          exerciseId: "calf",
          side: "both",
          index: 0,
          reps: 1,
          weight: 0,
          done: true,
        },
      ],
    },
  ])
    expect(sessionSchema.safeParse({ ...external, ...change }).success).toBe(
      false,
    );
  expect(
    sessionSchema.safeParse({ ...external, activityType: "strength" }).success,
  ).toBe(false);
});
it("counts normal sessions and plan-linked activities once towards the goal, with separate totals", () => {
  const strength = newSession({}, external.started);
  strength.ended = external.ended;
  strength.sets = strength.sets.map((row) => ({ ...row, done: true }));
  const data = dashboardData(
    [strength, external, { ...external, id: "planned", templateId: "plan" }],
    [],
    new Date("2026-11-20T12:00:00Z"),
  );
  expect(data.goalSessions).toHaveLength(2);
  expect(data.strengthSessions).toBe(1);
  expect(data.externalSessions).toBe(2);
  expect(data.sets.reduce((a, b) => a + b, 0)).toBe(
    sessionDose(strength).completed,
  );
});
