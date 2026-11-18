import React, { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createRoot } from "react-dom/client";
import { db as localDb, legacyProfileId, type Profile } from "./db";
import { cloudDb } from "./cloudDb";
import { supabase } from "./supabase";
import { AuthGate } from "./AuthGate";
import {
  defaultTemplate,
  templateSchema,
  newSession,
  type WorkoutTemplate,
  day,
  type Session,
  type ProfileSettings,
} from "./domain";
import "./style.css";
import { Plans } from "./Plans";
import { IntervalTimer } from "./HsrTimer";
import { type Tab } from "./app/navigation";
import { useNavigation } from "./app/useNavigation";
import { useProfileData } from "./app/useProfileData";
import { AppShell } from "./app/AppShell";
import { TodayView } from "./views/TodayView";
import { DiaryView } from "./views/DiaryView";
import { SessionEditorView } from "./views/SessionEditorView";
import { WorkoutView } from "./views/WorkoutView";
import { useWorkoutActions } from "./app/useWorkoutActions";
import { usePainLogActions } from "./app/usePainLogActions";
import { useBackupActions } from "./app/useBackupActions";
import type { AppRepository } from "./app/repository";
import { useConfirmation } from "./app/useConfirmation";
import { ProfileSettingsView } from "./views/ProfileSettingsView";
import { AccountProfileView, ProfileNavigation } from "./views/AccountProfileView";
import { isProfileTab } from "./app/navigation";
import { AnalyticsView } from "./views/AnalyticsView";
const Calendar = React.lazy(() => import("./Calendar").then((module) => ({ default: module.Calendar })));
const HistoryView = React.lazy(() => import("./views/HistoryView").then((module) => ({ default: module.HistoryView })));
const DataView = React.lazy(() => import("./views/DataView").then((module) => ({ default: module.DataView })));
import {
  validateHistoricalSession,
} from "./domain";
const localDateTime = (iso: string) => {
  const d = new Date(iso);
  return day(d) + "T" + d.toTimeString().slice(0, 5);
};
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker
    .register(import.meta.env.BASE_URL + "sw.js", {
      scope: import.meta.env.BASE_URL,
      updateViaCache: "none",
    })
    .catch(() => {});
const db: AppRepository = supabase ? cloudDb : localDb;
function App({ user }: { user?: User }) {
  const { ask: confirmAction, dialog: confirmationDialog } = useConfirmation();
  const approvedReload = useRef(false);
  const [localProfiles, setLocalProfiles] = useState<Profile[]>([]);
  const [sourceProfileId, setSourceProfileId] = useState(legacyProfileId);
  const { profiles, profileId, logs, sessions, setSessions,
    templates, ready, loadingData, refresh: refreshRecords } = useProfileData(db);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [workout, setWorkout] = useState<WorkoutTemplate>(defaultTemplate);
  const [workoutDirty, setWorkoutDirty] = useState(false);
  const [planDirty, setPlanDirty] = useState(false);
  const [historyExercise, setHistoryExercise] = useState("");
  const [editing, setEditing] = useState<Session | null>(null);
  const [editStart, setEditStart] = useState(""),
    [editEnd, setEditEnd] = useState("");
  const [editingExisting, setEditingExisting] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);
  useEffect(() => {
    if (!planDirty && !workoutDirty && !editing && !profileDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (approvedReload.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [planDirty, workoutDirty, editing, profileDirty]);
  const { tab, navigate: goToTab } = useNavigation(async (next) => {
    if (busy) return false;
    if (planDirty && !await confirmAction("Odrzucić niezapisane zmiany planu?")) return false;
    if (workoutDirty && !await confirmAction("Odrzucić niezapisane zmiany przygotowania treningu?")) return false;
    if (editing && next !== "Edytor treningu" &&
      !await confirmAction("Odrzucić niezapisane zmiany treningu?")) return false;
    if (profileDirty && !await confirmAction("Odrzucić niezapisane zmiany ustawień konta?")) return false;
    setPlanDirty(false);
    setWorkoutDirty(false);
    setProfileDirty(false);
    setEditing(null);
    setNotice("");
    setError("");
    return true;
  });
  function navigate(next: Tab, options?: { replace?: boolean; force?: boolean }) {
    return goToTab(next, options);
  }
  function openSessionEditor(session?: Session, dateValue = day(new Date())) {
    if (session && !session.ended) {
      navigate("Trening", { force: true });
      return;
    }
    const end =
      dateValue === day(new Date())
        ? new Date()
        : new Date(dateValue + "T13:00:00");
    const start = new Date(end.getTime() - 3600e3);
    const initial = session
      ? structuredClone(session)
      : {
          ...newSession({}, start.toISOString(), workout),
          profileId,
          ended: end.toISOString(),
        };
    if (!session)
      initial.sets = initial.sets.map((row) => ({ ...row, done: true }));
    setEditing(initial);
    setEditingExisting(!!session);
    setEditStart(localDateTime(initial.started));
    setEditEnd(localDateTime(initial.ended!));
    setError("");
    setNotice("");
    navigate("Edytor treningu", { force: true });
  }
  async function saveHistorical(event: React.FormEvent) {
    event.preventDefault();
    await action(async () => {
      if (!editing) return;
      if (!editStart || !editEnd)
        throw Error("Uzupełnij początek i koniec treningu.");
      const saved = validateHistoricalSession(
        {
          ...editing,
          started: new Date(editStart).toISOString(),
          ended: new Date(editEnd).toISOString(),
          editedAt: new Date().toISOString(),
        },
        sessions,
      );
      await db.sessions.put(saved);
      setEditing(null);
      navigate("Historia", { force: true });
      setNotice(
        "Trening zapisany. Historia, kalendarz i monitor bólu zostały zaktualizowane.",
      );
    });
  }
  async function removeSession() {
    if (!editing) return;
    await action(async () => {
      if (!await confirmAction("Usunąć ten trening z historii?")) return;
      await db.sessions.delete(editing.id);
      setEditing(null);
      navigate("Historia", { force: true });
      setNotice("Trening usunięty.");
    });
  }
  async function refresh() {
    setError("");
    const records = await refreshRecords();
    if (!ready && records?.templates.length) {
      setWorkout(
        structuredClone(
          records.templates.find((t) => t.id.endsWith(":original-plan") || t.id === "original-plan") ??
            records.templates[0],
        ),
      );
      setWorkoutDirty(false);
    }
  }
  useEffect(() => {
    refresh().catch((cause: unknown) => setError(
      supabase
        ? `Nie można pobrać danych konta: ${cause instanceof Error ? cause.message : "nieznany błąd"}`
        : "Nie można otworzyć bazy. Sprawdź ustawienia pamięci przeglądarki.",
    ));
    if (supabase) void localDb.profiles.toArray().then((rows) => {
      setLocalProfiles(rows);
      if (rows.length) setSourceProfileId(rows[0].id);
    }).catch(() => {});
  }, []);
  async function saveProfileSettings(settings: ProfileSettings): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      await db.profiles.update(profileId, settings);
      await refreshRecords();
      setProfileDirty(false);
      setNotice("Ustawienia profilu zapisane.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się zapisać ustawień.");
      return false;
    } finally { setBusy(false); }
  }
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      try {
        await refresh();
      } catch {
        /* Zachowaj pierwotny błąd zapisu. */
      }
      setError(
        e instanceof Error ? e.message : "Nie udało się zapisać danych.",
      );
    } finally {
      setBusy(false);
    }
  }
  const active = sessions.find((s) => !s.ended),
    last = sessions.filter((s) => s.ended).at(-1),
    today = logs.filter((l) => l.date === day(new Date())).sort((a, b) => b.at.localeCompare(a.at))[0];
  const hours = last
    ? (Date.now() - new Date(last.ended!).getTime()) / 36e5
    : Infinity;
  const selectedProfile = profiles.find((profile) => profile.id === profileId);
  async function signOut() {
    if (!supabase || busy) return;
    if ((profileDirty || workoutDirty || planDirty || !!editing) &&
      !await confirmAction("Wylogować i odrzucić niezapisane zmiany formularzy? Zapisane treningi pozostaną na koncie.")) return;
    setBusy(true); setError("");
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nie udało się wylogować."); }
    finally { setBusy(false); }
  }
  const { date, time, pain, context, note, injuryIds, editDate, savePain, removePain,
    setTime, setPain, setContext, setNote, setInjuryIds } = usePainLogActions({
    database: db, logs, profileId, cloud: !!supabase,
    sites: selectedProfile?.rehabSites ?? [], contexts: selectedProfile?.painContexts ?? [],
    injuries: selectedProfile?.injuries ?? [],
    defaultTime: selectedProfile?.checkInTime ?? "08:00", action, setNotice, confirmAction,
  });
  const { begin, savePreparedWorkout, updateTraining, finishExercise,
    replaceActiveExercise, finishWorkout, discardWorkout, loadWorkout,
    changeWorkout } = useWorkoutActions({ database: db, cloud: !!supabase,
    profileId, active, sessions, templates, sites: selectedProfile?.rehabSites ?? [], workout, workoutDirty, busy,
    setBusy, setError, setNotice, setSessions, setWorkout, setWorkoutDirty,
    action, refresh, confirmAction });
  const { migrateLocal, download, load } = useBackupActions({
    database: db, cloud: !!supabase, localProfiles, sourceProfileId, profiles,
    profileId, action, setWorkout, setWorkoutDirty, setNotice, confirmAction,
  });
  return (
    <>
    <AppShell tab={tab} onNavigate={navigate} busy={busy} confirmAction={confirmAction}
      onApprovedReload={() => { approvedReload.current = true; }}
      dirty={planDirty || workoutDirty || !!editing || profileDirty} cloud={!!supabase}
      accountId={user?.email} profileName={selectedProfile?.name} avatarPath={selectedProfile?.avatarPath} onSignOut={signOut}
      ready={ready} loadingData={loadingData} error={error} notice={notice}>
        {isProfileTab(tab) && <ProfileNavigation tab={tab} onNavigate={navigate} />}
        {!ready && !["Profil", "Bezpieczeństwo", "Preferencje", "Aplikacja"].includes(tab) ? (
          <div>
            <p>{loadingData ? supabase ? "Ładowanie danych konta…" : "Otwieranie lokalnej bazy…" : "Nie udało się załadować danych."}</p>
            {error && <button type="button" disabled={loadingData} onClick={() => { void refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Nieznany błąd")); }}>Spróbuj ponownie</button>}
          </div>
        ) : (
          <>
            {["Profil", "Bezpieczeństwo", "Preferencje", "Aplikacja"].includes(tab) && <AccountProfileView key={tab}
              tab={tab} profile={selectedProfile} user={user} busy={busy} dirty={profileDirty}
              onDirty={setProfileDirty} onBusy={setBusy} onChanged={refreshRecords} onNavigate={navigate}
              onSignOut={signOut} confirmAction={confirmAction} onApprovedReload={() => { approvedReload.current = true; }} />}
            <IntervalTimer key={profileId} profileId={profileId} visible={tab === "Zegar HSR"}
              confirmAction={confirmAction} />
            {tab === "Dzisiaj" && (
              <TodayView active={active} sessions={sessions} today={today} hours={hours}
                busy={busy} onFinish={() => { void finishWorkout(); }}
                logs={logs} injuries={selectedProfile?.injuries ?? []}
                sites={selectedProfile?.rehabSites ?? []} weeklyGoal={selectedProfile?.weeklyGoal ?? 2}
                onWorkout={() => { navigate("Trening"); }}
                onDiary={async () => { if (await navigate("Dziennik")) editDate(day(new Date())); }}
                onAnalytics={() => { void navigate("Analizy"); }} />
            )}
            {tab === "Dziennik" && (
              <DiaryView date={date} time={time} pain={pain} context={context} note={note} injuryIds={injuryIds}
                sites={selectedProfile?.rehabSites ?? []} contexts={selectedProfile?.painContexts ?? []}
                injuries={selectedProfile?.injuries ?? []}
                logs={logs} busy={busy} onDate={editDate} onTime={setTime}
                onPain={(siteId, value) => setPain((values) => ({ ...values, [siteId]: value }))}
                onContext={setContext} onInjuries={setInjuryIds} onNote={setNote}
                onSave={(event) => void savePain(event)} onRemove={() => void removePain()} />
            )}
            {tab === "Trening" && (
              <WorkoutView active={active} cloud={!!supabase} busy={busy}
                confirmAction={confirmAction}
                templates={templates} workout={workout} workoutDirty={workoutDirty}
                last={last} hours={hours} logs={logs} sites={selectedProfile?.rehabSites ?? []} contexts={selectedProfile?.painContexts ?? []}
                onSetChange={(session) => { void updateTraining(session); }}
                onTimerFinish={finishExercise}
                onReplace={(from, to) => { void replaceActiveExercise(from, to); }}
                onFinish={(pain) => { void finishWorkout(pain); }}
                onDiscard={() => { void discardWorkout(); }}
                onStart={(template) => { void begin(template); }}
                onLoadWorkout={loadWorkout} onChangeWorkout={changeWorkout}
                onSavePlan={(asNew) => { void savePreparedWorkout(asNew); }}
                onEditPlan={() => { navigate("Plany"); }} />
            )}
            {tab === "Kalendarz" && (
              <React.Suspense fallback={<p role="status">Ładowanie kalendarza…</p>}>
              <Calendar
                sessions={sessions}
                logs={logs} sites={selectedProfile?.rehabSites ?? []}
                onTraining={(d) => openSessionEditor(undefined, d)}
                onEdit={(s) => openSessionEditor(s)}
                onPain={(d) => {
                  editDate(d);
                  navigate("Dziennik");
                }}
              />
              </React.Suspense>
            )}
            {tab === "Edytor treningu" && editing && (
              <SessionEditorView editing={editing} editingExisting={editingExisting}
                confirmAction={confirmAction}
                editStart={editStart} editEnd={editEnd} setEditStart={setEditStart}
                setEditEnd={setEditEnd} setEditing={setEditing} busy={busy}
                saveHistorical={(event) => void saveHistorical(event)}
                navigate={navigate} removeSession={() => void removeSession()} />
            )}
            {tab === "Historia" && (
              <React.Suspense fallback={<p role="status">Ładowanie historii…</p>}>
              <HistoryView logs={logs} sessions={sessions} sites={selectedProfile?.rehabSites ?? []} contexts={selectedProfile?.painContexts ?? []} injuries={selectedProfile?.injuries ?? []} historyExercise={historyExercise}
                setHistoryExercise={setHistoryExercise} openSessionEditor={openSessionEditor}
                editDate={editDate} navigate={navigate} />
              </React.Suspense>
            )}
            {tab === "Analizy" && (
                <AnalyticsView logs={logs} sessions={sessions}
                  sites={selectedProfile?.rehabSites ?? []} contexts={selectedProfile?.painContexts ?? []}
                  injuries={selectedProfile?.injuries ?? []} />
            )}
            {tab === "Plany" && (
              <Plans
                templates={templates}
                onDirty={setPlanDirty}
                confirmAction={confirmAction}
                onSave={async (template) => {
                  await db.templates.put(templateSchema.parse({ ...template, profileId }));
                  if (workout.id === template.id && !workoutDirty)
                    setWorkout(structuredClone(template));
                  await refresh();
                }}
                onDelete={async (id) => {
                  await db.templates.delete(id);
                  if (workout.id === id) {
                    setWorkout(defaultTemplate());
                    setWorkoutDirty(false);
                  }
                  await refresh();
                }}
              />
            )}
            {tab === "Ustawienia" && selectedProfile && <ProfileSettingsView profile={selectedProfile}
              busy={busy} onDirty={setProfileDirty} onSave={saveProfileSettings} />}
            {tab === "Dane" && (
              <React.Suspense fallback={<p role="status">Ładowanie danych…</p>}>
              <DataView cloud={!!supabase} localProfiles={localProfiles}
                sourceProfileId={sourceProfileId} onSourceProfileChange={setSourceProfileId}
                profileId={profileId} logs={logs} sessions={sessions} templates={templates}
                busy={busy} onMigrate={() => void migrateLocal()}
                onDownload={() => void download()} onImport={(file) => void load(file)}
                onPersist={() => void action(async () => {
                  const granted = await navigator.storage?.persist?.();
                  setNotice(granted
                    ? "Przeglądarka przyznała trwałą pamięć. Nadal wykonuj kopie."
                    : "Trwała pamięć nie została przyznana. Wykonuj regularne kopie.");
                })} />
              </React.Suspense>
            )}
          </>
        )}
    </AppShell>
    {confirmationDialog}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  supabase ? <AuthGate>{(session) => <App key={session.user.id} user={session.user} />}</AuthGate> : <App />,
);
