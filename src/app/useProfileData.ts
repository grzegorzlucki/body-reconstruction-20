import { useRef, useState } from "react";
import { legacyProfileId, type Profile } from "../db";
import type { AppRepository } from "./repository";
import type { PainLog, Session, WorkoutTemplate } from "../domain";
import { readProfileRecords } from "./profileRepository";

type Database = AppRepository;
type Records = Awaited<ReturnType<typeof readProfileRecords>>;

function withTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(Error(message)), 15000);
    operation.then(
      (result) => { window.clearTimeout(timeout); resolve(result); },
      (cause) => { window.clearTimeout(timeout); reject(cause); },
    );
  });
}

export function useProfileData(database: Database) {
  const request = useRef(0);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState(() =>
    localStorage.getItem("rehab-active-profile") || legacyProfileId);
  const [logs, setLogs] = useState<PainLog[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [ready, setReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const complete = useRef(false);
  const [historyReady, setHistoryReady] = useState(!database.readRecent);

  async function refresh(): Promise<Records | null> {
    const currentRequest = ++request.current;
    setLoadingData(true);
    try {
      const available = await withTimeout(database.profiles.toArray(),
        "Przekroczono czas odczytu profili. Sprawdź połączenie i spróbuj ponownie.");
      if (currentRequest !== request.current) return null;
      setProfiles(available);
      const currentId = available.some((profile) => profile.id === profileId)
        ? profileId : available[0]?.id ?? legacyProfileId;
      if (currentId !== profileId) setProfileId(currentId);
      const records = await withTimeout(database.readRecent && !complete.current ? database.readRecent(currentId) : readProfileRecords(database, currentId),
        "Przekroczono czas pobierania danych profilu. Spróbuj ponownie.");
      if (currentRequest !== request.current) return null;
      setLogs(records.logs);
      setSessions(records.sessions);
      setTemplates(records.templates);
      setReady(true);
      return records;
    } catch (cause) {
      if (currentRequest !== request.current) return null;
      throw cause;
    } finally {
      if (currentRequest === request.current) setLoadingData(false);
    }
  }

  async function switchTo(nextId: string): Promise<Records | null> {
    const currentRequest = ++request.current;
    setReady(false);
    setLoadingData(true);
    setSessions([]);
    setLogs([]);
    setTemplates([]);
    setProfileId(nextId);
    localStorage.setItem("rehab-active-profile", nextId);
    try {
      const records = await withTimeout(readProfileRecords(database, nextId),
        "Przekroczono czas pobierania danych profilu. Spróbuj ponownie.");
      if (currentRequest !== request.current) return null;
      setTemplates(records.templates);
      setSessions(records.sessions);
      setLogs(records.logs);
      setReady(true);
      return records;
    } catch (cause) {
      if (currentRequest !== request.current) return null;
      throw cause;
    } finally {
      if (currentRequest === request.current) setLoadingData(false);
    }
  }

  async function ensureHistory() {
    if (complete.current || !database.readRecent) return;
    const currentRequest = ++request.current;
    setLoadingData(true);
    try {
      const records = await readProfileRecords(database, profileId);
      if (currentRequest !== request.current) return;
      setSessions(records.sessions); setLogs(records.logs); setTemplates(records.templates);
      complete.current = true; setHistoryReady(true);
    } finally { if (currentRequest === request.current) setLoadingData(false); }
  }
  return { profiles, setProfiles, profileId, logs, sessions, setSessions, historyReady, ensureHistory,
    templates, ready, loadingData, refresh, switchTo };
}
