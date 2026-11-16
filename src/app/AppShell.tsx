import { useRef, type ReactNode } from "react";
import type { Profile } from "../db";
import { AppUpdater } from "../AppUpdater";
import { AppNavigation } from "./AppNavigation";
import { ProfileDialog } from "./ProfileDialog";
import { ErrorNotice } from "./errorMessages";
import type { MainTab, Tab } from "./navigation";

export function AppShell({ tab, onNavigate, busy, dirty, cloud, accountId, onSignOut, confirmAction,
  onApprovedReload,
  ready, loadingData, profiles, profileId, onSwitchProfile, profileDialog,
  onProfileDialogChange, onSaveProfileName, error, notice, children }: {
  tab: Tab;
  onNavigate: (tab: MainTab) => Promise<boolean>;
  busy: boolean;
  dirty: boolean;
  cloud: boolean;
  accountId?: string;
  onSignOut: () => void;
  confirmAction: (message: string) => Promise<boolean>;
  onApprovedReload: () => void;
  ready: boolean;
  loadingData: boolean;
  profiles: Profile[];
  profileId: string;
  onSwitchProfile: (id: string) => void;
  profileDialog: "add" | "rename" | null;
  onProfileDialogChange: (mode: "add" | "rename" | null) => void;
  onSaveProfileName: (name: string) => Promise<void>;
  error: string;
  notice: string;
  children: ReactNode;
}) {
  const profileMenu = useRef<HTMLDetailsElement>(null);
  function openProfileDialog(mode: "add" | "rename") {
    profileMenu.current?.removeAttribute("open");
    onProfileDialogChange(mode);
  }
  return <div className="shell">
    <a className="skip-link" href="#main-content">Przejdź do treści</a>
    <aside>
      <button type="button" className="brand" onClick={() => onNavigate("Dzisiaj")}
        aria-label="Body Reconstruction — Dzisiaj">
        <span className="brand-icon" aria-hidden="true">↗</span> Body<br /><span>Reconstruction</span>
      </button>
      <p className="eyebrow">TWÓJ PROCES. TWOJE TEMPO.</p>
      <AppNavigation current={tab} onNavigate={onNavigate} />
      <div className="sidebar-updater"><AppUpdater disabled={busy} hasUnsavedChanges={dirty} confirmAction={confirmAction} onApprovedReload={onApprovedReload} /></div>
      <div className="local">
        <i aria-hidden="true" /> {cloud ? "Dane na koncie" : "Dane na tym urządzeniu"}
        <small>{cloud ? ready && !error ? "Dane załadowane" : loadingData ? "Łączenie z Supabase" : "Błąd połączenia" : "Tryb lokalny"}</small>
      </div>
    </aside>
    <main id="main-content" tabIndex={-1}>
      <header><span>REHABILITACJA / {tab.toUpperCase()}</span>
        <span>{new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}</span>
      </header>
      <div className="mobile-updater"><AppUpdater disabled={busy} hasUnsavedChanges={dirty} confirmAction={confirmAction} onApprovedReload={onApprovedReload} /></div>
      {cloud && <div className="account-actions"><span>{accountId}</span>
        <button type="button" className="secondary" onClick={onSignOut}>Wyloguj</button></div>}
      {ready && <div className="profile-bar"><label><span className="profile-label">Profil
        <small className="mobile-storage-status" aria-live="polite">
          {cloud ? error ? "Błąd połączenia" : loadingData ? "Łączenie…" : "Na koncie" : "Na urządzeniu"}
        </small></span>
        <select value={profileId} disabled={busy} onChange={(event) => onSwitchProfile(event.target.value)}>
          {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </select></label>
        <div className="profile-desktop-actions">
          <button type="button" className="secondary" onClick={() => openProfileDialog("add")}>Dodaj</button>
          <button type="button" className="secondary" onClick={() => openProfileDialog("rename")}>Zmień nazwę</button>
        </div>
        <details className="profile-mobile-actions" ref={profileMenu}>
          <summary>Opcje profilu</summary>
          <div>
            <button type="button" className="secondary" onClick={() => openProfileDialog("add")}>Dodaj profil</button>
            <button type="button" className="secondary" onClick={() => openProfileDialog("rename")}>Zmień nazwę</button>
          </div>
        </details>
      </div>}
      <ProfileDialog mode={profileDialog} initialName={profiles.find((profile) => profile.id === profileId)?.name ?? ""}
        onClose={() => onProfileDialogChange(null)} onSave={onSaveProfileName} />
      {error && <ErrorNotice message={error} />}
      {notice && <div role="status" className="notice">{notice}</div>}
      {children}
    </main>
    <footer>BODY RECONSTRUCTION <span>Konsekwencja, nie pośpiech.</span></footer>
  </div>;
}
