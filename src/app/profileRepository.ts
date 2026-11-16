import type { AppRepository } from "./repository";

export async function readProfileRecords(database: AppRepository, profileId: string) {
  const [sessions, logs, templates] = await Promise.all([
    database.sessions.where("profileId").equals(profileId).sortBy("started"),
    database.logs.where("profileId").equals(profileId).sortBy("date"),
    database.templates.where("profileId").equals(profileId).toArray(),
  ]);
  return { sessions, logs, templates };
}
