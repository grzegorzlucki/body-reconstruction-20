import { message as systemMessage } from "../i18n/config";
import type { Dispatch, SetStateAction } from "react";
import type { Profile } from "../db";
import type { AppRepository } from "./repository";
import { exportBackup as exportLocalBackup, importBackup as importLocalBackup } from "../db";
import { exportCloudBackup, importCloudBackup } from "../cloudDb";
import { backupSchema, day, defaultTemplate, type WorkoutTemplate } from "../domain";

type ActionContext = {
  database: AppRepository;
  cloud: boolean;
  localProfiles: Profile[];
  sourceProfileId: string;
  profiles: Profile[];
  profileId: string;
  action: (run: () => Promise<void>) => Promise<void>;
  setWorkout: Dispatch<SetStateAction<WorkoutTemplate>>;
  setWorkoutDirty: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string>>;
  confirmAction: (message: string) => Promise<boolean>;
};

export function useBackupActions({ database, cloud, localProfiles, sourceProfileId,
  profiles, profileId, action, setWorkout, setWorkoutDirty, setNotice,
  confirmAction }: ActionContext) {
  async function migrateLocal() {
    if (!cloud) return;
    await action(async () => {
      const source = localProfiles.find((p) => p.id === sourceProfileId);
      const target = profiles.find((p) => p.id === profileId);
      if (!source || !target) throw Error("Wybierz profil źródłowy i docelowy.");
      const backup = await exportLocalBackup(source.id);
      if (!await confirmAction(systemMessage("Przenieść dane lokalnego profilu „{{v0}}” do konta, do profilu „{{v1}}”? Zastąpi to obecne dane profilu na serwerze. Lokalna kopia pozostanie na urządzeniu.",{v0: source.name, v1: target.name}))) return;
      await importCloudBackup(backup, target.id);
      setWorkout(structuredClone((await database.templates.where("profileId").equals(target.id).toArray())[0] ?? defaultTemplate()));
      setWorkoutDirty(false);
      setNotice("Dane przeniesione. Lokalna kopia pozostała na urządzeniu.");
    });
  }
  async function download() {
    await action(async () => {
      const data = cloud ? await exportCloudBackup(profileId) : await exportLocalBackup(profileId);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `rehab-${day(new Date())}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      // The browser may still be reading the Blob after the download event fires.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      localStorage.setItem(`rehab-last-backup:${profileId}`, data.exportedAt);
      setNotice(
        "Eksport przygotowany. Sprawdź, czy plik został zapisany w Plikach / Pobranych.",
      );
    });
  }
  async function load(file: File) {
    await action(async () => {
      if (file.size > 20 * 1024 * 1024)
        throw Error("Plik jest zbyt duży (limit 20 MB).");
      const data = backupSchema.parse(JSON.parse(await file.text()));
      if (
        !await confirmAction(
          systemMessage("Plik zawiera {{v0}} wpisów i {{v1}} treningów. ZASTĄPI dane profilu „{{v2}}”. Pozostałe profile pozostaną bez zmian. Kontynuować?",{v0: data.logs.length, v1: data.sessions.length, v2: profiles.find((p) => p.id === profileId)?.name}),
        )
      )
        return;
      if (cloud) await importCloudBackup(data, profileId);
      else await importLocalBackup(data, profileId);
      const restored = await database.templates.where("profileId").equals(profileId).toArray();
      setWorkout(structuredClone(restored[0] ?? defaultTemplate()));
      setWorkoutDirty(false);
      setNotice("Kopia odtworzona.");
    });
  }
  return { migrateLocal, download, load };
}
