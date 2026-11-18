import { useEffect, useId, useRef, useState } from "react";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import { profileSections, type MainTab } from "./navigation";

export function AccountMenu({ name, email, avatarPath, onNavigate, onSignOut, busy }: {
  name: string; email?: string; avatarPath?: string | null; busy: boolean;
  onNavigate: (tab: MainTab) => Promise<boolean>; onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="account-menu" ref={root} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button type="button" className="account-trigger secondary" ref={trigger} aria-expanded={open}
      aria-controls={id} onClick={() => setOpen((value) => !value)}>
      <ProfileAvatar name={name} path={avatarPath} /><span>{name}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="account-dropdown" id={id}>
      <strong>{name}</strong><p>{email || "Dane na tym urządzeniu"}</p>
      <nav aria-label="Ustawienia konta">{profileSections.map((item) => <button key={item.tab} type="button"
        onClick={async () => {
          if (await onNavigate(item.tab)) setOpen(false);
          else { setOpen(true); trigger.current?.focus(); }
        }}>{item.label}</button>)}</nav>
      {email && <button type="button" className="secondary" disabled={busy} onClick={() => void onSignOut()}>Wyloguj</button>}
    </div>}
  </div>;
}
