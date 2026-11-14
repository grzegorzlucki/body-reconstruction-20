import Dexie, { type Table } from "dexie";
import { type PainLog, type Session, type WorkoutTemplate, defaultTemplate, backupSchema } from "./domain";

export const legacyProfileId = "default-profile";
export type Profile = { id: string; name: string };
const starter = (profileId: string): WorkoutTemplate => ({ ...defaultTemplate(), id: `${profileId}:original-plan`, profileId });

class RehabDB extends Dexie {
  logs!: Table<PainLog, string>;
  sessions!: Table<Session, string>;
  templates!: Table<WorkoutTemplate, string>;
  profiles!: Table<Profile, string>;
  constructor() {
    super("body-reconstruction-v1");
    this.version(1).stores({ logs: "id,&date", sessions: "id,started" });
    this.version(2).stores({ logs: "id,&date", sessions: "id,started", templates: "id,name" })
      .upgrade((tx) => tx.table("templates").add(defaultTemplate()));
    this.version(3).stores({
      logs: "id,[profileId+date],profileId",
      sessions: "id,[profileId+started],profileId",
      templates: "id,[profileId+name],profileId",
      profiles: "id,name",
    }).upgrade(async (tx) => {
      await tx.table("profiles").add({ id: legacyProfileId, name: "Profil główny" });
      for (const name of ["logs", "sessions", "templates"])
        await tx.table(name).toCollection().modify({ profileId: legacyProfileId });
    });
    this.on("populate", (tx) => {
      tx.table("profiles").add({ id: legacyProfileId, name: "Profil główny" });
      tx.table("templates").add(starter(legacyProfileId));
    });
  }
}
export const db = new RehabDB();

export async function createProfile(name: string): Promise<Profile> {
  const clean = name.trim();
  if (!clean || clean.length > 80) throw Error("Nazwa profilu musi mieć od 1 do 80 znaków.");
  const profile = { id: crypto.randomUUID(), name: clean };
  await db.transaction("rw", db.profiles, db.templates, async () => {
    await db.profiles.add(profile);
    await db.templates.add(starter(profile.id));
  });
  return profile;
}

export async function exportBackup(profileId = legacyProfileId) {
  return db.transaction("r", db.profiles, db.logs, db.sessions, db.templates, async () => {
    const profile = await db.profiles.get(profileId);
    if (!profile) throw Error("Nie znaleziono profilu.");
    return {
      version: 3 as const,
      profileName: profile.name,
      exportedAt: new Date().toISOString(),
      templates: (await db.templates.where("profileId").equals(profileId).toArray()).map(({ profileId: _id, ...row }) => row),
      logs: (await db.logs.where("profileId").equals(profileId).toArray()).map(({ profileId: _id, ...row }) => row),
      sessions: (await db.sessions.where("profileId").equals(profileId).toArray()).map(({ profileId: _id, ...row }) => row),
    };
  });
}

export async function importBackup(raw: unknown, profileId = legacyProfileId) {
  const data = backupSchema.parse(raw);
  await db.transaction("rw", db.profiles, db.logs, db.sessions, db.templates, async () => {
    if (!(await db.profiles.get(profileId))) throw Error("Nie znaleziono profilu.");
    const sourceTemplates = data.version === 1 ? [defaultTemplate()] : data.templates!;
    const templateIds = new Map(sourceTemplates.map((row) => [row.id, `${profileId}:${row.id}`]));
    await db.logs.where("profileId").equals(profileId).delete();
    await db.sessions.where("profileId").equals(profileId).delete();
    await db.templates.where("profileId").equals(profileId).delete();
    await db.templates.bulkAdd(sourceTemplates.map((row) => ({ ...row, id: templateIds.get(row.id)!, profileId })));
    await db.logs.bulkAdd(data.logs.map((row) => ({ ...row, id: crypto.randomUUID(), profileId })));
    await db.sessions.bulkAdd(data.sessions.map((row) => ({ ...row, id: crypto.randomUUID(), templateId: row.templateId ? (templateIds.get(row.templateId) ?? row.templateId) : undefined, profileId })));
  });
}
