import type { ReactNode } from "react";
import { AppUpdater } from "../AppUpdater";
import { AppNavigation } from "./AppNavigation";
import { ErrorNotice } from "./errorMessages";
import type { MainTab, Tab } from "./navigation";

export function AppShell({ tab, onNavigate, busy, dirty, cloud, accountId, onSignOut,
  confirmAction, onApprovedReload, ready, loadingData, error, notice, children }: {
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
      {error && <ErrorNotice message={error} />}
      {notice && <div role="status" className="notice">{notice}</div>}
      {children}
    </main>
    <footer>BODY RECONSTRUCTION <span>Konsekwencja, nie pośpiech.</span></footer>
  </div>;
}
