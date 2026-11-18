import type { ReactNode } from "react";
import { AppUpdater } from "../AppUpdater";
import { AppNavigation } from "./AppNavigation";
import { ErrorNotice } from "./errorMessages";
import type { MainTab, Tab } from "./navigation";
import { AccountMenu } from "./AccountMenu";
import { LoadingScreen } from "./LoadingScreen";

export function AppShell({ tab, onNavigate, busy, dirty, cloud, accountId, profileName, avatarPath, onSignOut,
  confirmAction, onApprovedReload, ready, loadingData, error, notice, children }: {
  tab: Tab;
  onNavigate: (tab: MainTab) => Promise<boolean>;
  busy: boolean;
  dirty: boolean;
  cloud: boolean;
  accountId?: string;
  profileName?: string; avatarPath?: string | null;
  onSignOut: () => Promise<void>;
  confirmAction: (message: string) => Promise<boolean>;
  onApprovedReload: () => void;
  ready: boolean;
  loadingData: boolean;
  error: string;
  notice: string;
  children: ReactNode;
}) {
  return <div className="shell">
    <a className="skip-link" href="#main-content">Przejdź do treści</a>
    <aside>
      <button type="button" className="brand" onClick={() => onNavigate("Dzisiaj")}
        aria-label="Body Reconstruction — Dzisiaj">
        <span className="brand-icon" aria-hidden="true">↗</span> Body<br /><span>Reconstruction</span>
      </button>
      <p className="eyebrow">TWÓJ PROCES. TWOJE TEMPO.</p>
      <div className="sidebar-navigation">
        <AppNavigation current={tab} onNavigate={onNavigate} profileName={profileName} avatarPath={avatarPath} />
      </div>
      <div className="sidebar-footer">
        <div className="sidebar-updater"><AppUpdater disabled={busy} hasUnsavedChanges={dirty} confirmAction={confirmAction} onApprovedReload={onApprovedReload} /></div>
      <div className="local">
        <i aria-hidden="true" /> {cloud ? "Dane na koncie" : "Dane na tym urządzeniu"}
        <small>{cloud ? ready && !error ? "Dane załadowane" : loadingData ? "Łączenie z Supabase" : "Błąd połączenia" : "Tryb lokalny"}</small>
      </div>
      </div>
    </aside>
    <main id="main-content" tabIndex={-1} aria-busy={loadingData}>
      <header><span>REHABILITACJA / {tab.toUpperCase()}</span>
        <div className="header-account"><span>{new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}</span>
          <AccountMenu name={profileName ?? (cloud ? "Konto" : "Profil lokalny")} email={accountId} avatarPath={avatarPath}
            onNavigate={onNavigate} onSignOut={onSignOut} busy={busy} /></div>
      </header>
      {error && <ErrorNotice message={error} />}
      {ready && loadingData && <LoadingScreen inline />}
      {notice && <div role="status" className="notice">{notice}</div>}
      {children}
    </main>
    <footer>BODY RECONSTRUCTION <span>Konsekwencja, nie pośpiech.</span></footer>
  </div>;
}
