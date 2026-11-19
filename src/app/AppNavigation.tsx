import { useTranslation } from "react-i18next";
import { ui } from "../i18n/config";
import { useRef } from "react";
import { tabs, isProfileTab, type MainTab, type Tab } from "./navigation";
import { ProfileAvatar } from "../profile/ProfileAvatar";

const icons: Record<MainTab, string> = {
  Dzisiaj: "◉", Trening: "↗", Dziennik: "+", Kalendarz: "▦",
  Historia: "◷", Plany: "☷", "Zegar HSR": "◴", Dane: "◇",
  Ustawienia: "\u2699", Analizy: "\u25a5",
  Profil: "◯", Bezpieczeństwo: "⚿", Preferencje: "☷", Aplikacja: "↻",
};
const primary: MainTab[] = ["Dzisiaj", "Trening", "Plany", "Dziennik"];
const secondary: MainTab[] = ["Profil", "Kalendarz", "Historia", "Analizy", "Zegar HSR", "Dane"];

export function AppNavigation({ current, onNavigate, profileName = "Profil", avatarPath }: {
  current: Tab;
  onNavigate: (next: MainTab) => Promise<boolean>;
  profileName?: string; avatarPath?: string | null;
}) {
  useTranslation();
  const moreDialog = useRef<HTMLDialogElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const item = (tab: MainTab) => <button key={tab} type="button"
    className={current === tab || (tab === "Profil" && isProfileTab(current) && current !== "Dane") ? "selected" : ""}
    aria-current={current === tab || (tab === "Profil" && isProfileTab(current) && current !== "Dane") ? "page" : undefined}
    onClick={async () => {
      if (await onNavigate(tab)) {
        moreDialog.current?.close();
      }
    }}>
    {tab === "Profil" ? <ProfileAvatar name={profileName} path={avatarPath} /> : <span className="nav-icon" aria-hidden="true">{icons[tab]}</span>}{ui(tab)}
  </button>;
  return <>
    <nav className="desktop-nav" aria-label={ui("Główna nawigacja")}>{tabs.filter((tab) => !isProfileTab(tab)).map(item)}</nav>
    <nav className="phone-nav" aria-label={ui("Główna nawigacja")}>
      {primary.map(item)}
      <button ref={moreButton} type="button" className={isProfileTab(current) || secondary.includes(current as MainTab) ? "selected" : ""}
        aria-label={ui("Więcej widoków")} onClick={() => moreDialog.current?.showModal()}>
        <span aria-hidden="true">☷</span>{ui("Więcej")} </button>
    </nav>
    <dialog ref={moreDialog} className="more-dialog" aria-label={ui("Więcej widoków")}
      onClose={() => moreButton.current?.focus()}>
      <div className="more-dialog-heading"><h2>{ui("Więcej")}</h2>
        <button type="button" className="secondary" onClick={() => moreDialog.current?.close()}>{ui("Zamknij")}</button>
      </div>
      <nav aria-label={ui("Pozostałe widoki")}>{secondary.map(item)}</nav>
    </dialog>
  </>;
}
