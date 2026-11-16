import { useRef } from "react";
import { tabs, type MainTab, type Tab } from "./navigation";

const icons: Record<MainTab, string> = {
  Dzisiaj: "◉", Trening: "↗", Dziennik: "+", Kalendarz: "▦",
  Historia: "◷", Plany: "☷", "Zegar HSR": "◴", Dane: "◇",
};
const primary: MainTab[] = ["Dzisiaj", "Trening", "Plany", "Dziennik"];
const secondary: MainTab[] = ["Kalendarz", "Historia", "Zegar HSR", "Dane"];

export function AppNavigation({ current, onNavigate }: {
  current: Tab;
  onNavigate: (next: MainTab) => Promise<boolean>;
}) {
  const moreDialog = useRef<HTMLDialogElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const item = (tab: MainTab) => <button key={tab} type="button"
    className={current === tab ? "selected" : ""}
    aria-current={current === tab ? "page" : undefined}
    onClick={async () => {
      if (await onNavigate(tab)) {
        moreDialog.current?.close();
      }
    }}>
    <span aria-hidden="true">{icons[tab]}</span>{tab}
  </button>;
  return <>
    <nav className="desktop-nav" aria-label="Główna nawigacja">{tabs.map(item)}</nav>
    <nav className="phone-nav" aria-label="Główna nawigacja">
      {primary.map(item)}
      <button ref={moreButton} type="button" className={secondary.includes(current as MainTab) ? "selected" : ""}
        aria-label="Więcej widoków" onClick={() => moreDialog.current?.showModal()}>
        <span aria-hidden="true">☷</span>Więcej
      </button>
    </nav>
    <dialog ref={moreDialog} className="more-dialog" aria-label="Więcej widoków"
      onClose={() => moreButton.current?.focus()}>
      <div className="more-dialog-heading"><h2>Więcej</h2>
        <button type="button" className="secondary" onClick={() => moreDialog.current?.close()}>Zamknij</button>
      </div>
      <nav aria-label="Pozostałe widoki">{secondary.map(item)}</nav>
    </dialog>
  </>;
}
