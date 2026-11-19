import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "vitest";
import { db } from "../db";

it("upgrades v7 to v8 without changing stored history or existing profile labels", async () => {
  const previous = new Dexie("body-reconstruction-v1");
  previous.version(7).stores({
    logs: "id,[profileId+date],profileId,sessionId,[profileId+at]",
    sessions: "id,[profileId+started],profileId",
    templates: "id,[profileId+name],profileId",
    profiles: "id,name",
  });
  await previous.open();
  const profile = {
    id: "old",
    name: "Moja nazwa",
    rehabSites: [],
    painContexts: [],
    injuries: [],
    weeklyGoal: 2,
    checkInTime: "08:00",
  };
  const log = {
    id: "report",
    profileId: "old",
    at: "2026-11-18T08:00:00.000Z",
    date: "2026-11-18",
    values: [],
    context: "",
    note: "Własna notatka",
  };
  await previous.table("profiles").add(profile);
  await previous.table("logs").add(log);
  previous.close();
  await db.open();
  expect(await db.profiles.get("old")).toEqual({
    ...profile,
    preferredLanguage: "pl",
  });
  expect(await db.logs.get("report")).toEqual(log);
  db.close();
});
