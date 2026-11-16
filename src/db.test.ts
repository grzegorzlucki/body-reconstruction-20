import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db, exportBackup, importBackup, createProfile, legacyProfileId } from "./db";
import { exercises, newSession } from "./domain";
beforeEach(async () => {
  await db.logs.clear();
  await db.sessions.clear();
});
describe("Baza i kopie", () => {
  it("odtwarza wpisy i aktywną sesję bez utraty danych", async () => {
    const session = newSession(
      Object.fromEntries(
        exercises.map((e) => [e.id, { weight: e.weight, reps: e.reps }]),
      ),
    );
    await db.sessions.add({ ...session, profileId: legacyProfileId });
    await db.logs.add({
      id: "pain",
      profileId: legacyProfileId,
      date: "2026-11-02",
      at: "2026-11-02T07:00:00.000Z",
      values: [{ siteId: "achilles", value: 2 }, { siteId: "pht", value: 3 }, { siteId: "quadriceps", value: 1 }],
      context: "spacer",
      note: "notatka",
    });
    const before = await exportBackup();
    await db.sessions.clear();
    await db.logs.clear();
    await importBackup(JSON.parse(JSON.stringify(before)));
    expect((await exportBackup()).sessions[0].sets).toEqual(before.sessions[0].sets);
    expect((await exportBackup()).logs[0].values).toEqual(before.logs[0].values);
  });
  it("nie usuwa danych po niepoprawnym imporcie", async () => {
    await db.logs.add({
      id: "keep",
      profileId: legacyProfileId,
      date: "2026-11-02",
      at: "2026-11-02T07:00:00.000Z",
      values: [{ siteId: "achilles", value: 2 }, { siteId: "pht", value: 2 }, { siteId: "quadriceps", value: 2 }],
      context: "spacer",
      note: "",
    });
    await expect(
      importBackup({ version: 9, logs: [], sessions: [] }),
    ).rejects.toThrow();
    expect(await db.logs.count()).toBe(1);
  });
});

it("eksportuje i przywraca plany razem z niezależną sesją", async () => {
  const { defaultTemplate } = await import("./domain");
  const template = { ...defaultTemplate(), id: "lower-a", name: "Lower A" };
  await db.templates.clear();
  await db.templates.add({ ...template, profileId: legacyProfileId });
  const session = newSession({}, undefined, template);
  await db.sessions.add({ ...session, profileId: legacyProfileId });
  const backup = await exportBackup();
  await db.templates.update(template.id, { name: "Zmieniony" });
  await importBackup(backup);
  expect((await db.templates.toArray())[0].name).toBe(template.name);
  expect((await db.sessions.toArray())[0]?.planName).toBe("Lower A");
  expect(backup.version).toBe(4);
});

it("importuje kopię v1 i dodaje plan początkowy bez zmiany historii", async () => {
  const { defaultTemplate } = await import("./domain");
  const oldSession = newSession(
    Object.fromEntries(
      exercises.map((e) => [e.id, { weight: e.weight, reps: e.reps }]),
    ),
  );
  await importBackup({
    version: 1,
    exportedAt: new Date().toISOString(),
    logs: [],
    sessions: [oldSession],
  });
  expect((await db.sessions.toArray())[0].sets).toEqual(oldSession.sets);
  expect((await db.templates.toArray())[0].entries).toEqual(defaultTemplate().entries);
});

it("nie usuwa danych po błędnym planie w kopii v2", async () => {
  await db.templates.put({
    id: "keep",
    profileId: legacyProfileId,
    name: "Zachowaj",
    entries: [
      { exerciseId: "leg-press", sets: 3, reps: 8, weight: 0, note: "" },
    ],
  });
  await expect(
    importBackup({
      version: 2,
      exportedAt: new Date().toISOString(),
      logs: [],
      sessions: [],
      templates: [{ id: "bad", name: "", entries: [] }],
    }),
  ).rejects.toThrow();
  expect(await db.templates.get("keep")).toBeDefined();
});

it("isolates profiles and imports only into the selected profile", async () => {
  const other = await createProfile("Druga osoba");
  const original = {
    id: crypto.randomUUID(), profileId: legacyProfileId, date: "2026-11-02",
    at: "2026-11-02T07:00:00.000Z", values: [{ siteId: "achilles", value: 2 }, { siteId: "pht", value: 2 }, { siteId: "quadriceps", value: 2 }], context: "spacer", note: "",
  };
  await db.logs.add(original);
  await db.logs.add({ ...original, id: crypto.randomUUID(), profileId: other.id });
  const backup = await exportBackup(other.id);
  expect(backup.logs).toHaveLength(1);
  await importBackup({ ...backup, logs: [] }, other.id);
  expect(await db.logs.where("profileId").equals(other.id).count()).toBe(0);
  expect(await db.logs.where("profileId").equals(legacyProfileId).count()).toBe(1);
});
