import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { Profile } from "../db";
import { profileSections, type Tab, type MainTab } from "../app/navigation";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import { PersonalInfoForm } from "../profile/PersonalInfoForm";
import { SecuritySettings } from "../profile/SecuritySettings";
import { DeleteAccount } from "../profile/DeleteAccount";
import { AppUpdater } from "../AppUpdater";

export function ProfileNavigation({ tab, onNavigate }: { tab: Tab; onNavigate: (tab: MainTab) => Promise<boolean> }) {
  return <nav className="profile-sections" aria-label="Sekcje profilu">{profileSections.map((item) =>
    <button key={item.tab} type="button" className={tab === item.tab ? "selected" : ""} aria-current={tab === item.tab ? "page" : undefined}
      onClick={() => void onNavigate(item.tab)}>{item.label}</button>)}</nav>;
}

export function AccountProfileView({ tab, profile, user, busy, dirty, onDirty, onBusy, onChanged, onNavigate, onSignOut, confirmAction, onApprovedReload }: {
  tab: Tab; profile?: Profile; user?: User; busy: boolean; dirty: boolean;
  onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void; onChanged: () => Promise<unknown>;
  onNavigate: (tab: MainTab) => Promise<boolean>; onSignOut: () => Promise<void>;
  confirmAction: (message: string) => Promise<boolean>; onApprovedReload: () => void;
}) {
  const [personalDirty, setPersonalDirty] = useState(false);
  const [deleteDirty, setDeleteDirty] = useState(false);
  let accountTime = "";
  try { accountTime = new Intl.DateTimeFormat("pl-PL", { timeZone: profile?.timeZone ?? "Europe/Warsaw", dateStyle: "medium", timeStyle: "short" }).format(new Date()); }
  catch { /* Invalid legacy time zone can be corrected in the personal form. */ }
  useEffect(() => { if (tab === "Profil") onDirty(personalDirty || deleteDirty); }, [tab, personalDirty, deleteDirty, onDirty]);
  if (tab === "Bezpieczeństwo") return <><h1>Bezpieczeństwo</h1><SecuritySettings user={user} onDirty={onDirty} onBusy={onBusy} confirmAction={confirmAction} /></>;
  if (tab === "Preferencje") return <><h1>Preferencje</h1><section className="panel"><h2>Ustawienia konta i rehabilitacji</h2>
    <p>Strefę czasową zmienisz w Moim profilu. Cel tygodniowy, godzinę pomiaru i monitorowane obszary znajdziesz w Rehabilitacji.</p>
    <div className="actions"><button className="secondary" onClick={() => void onNavigate("Profil")}>Dane profilu</button>
      <button className="secondary" onClick={() => void onNavigate("Ustawienia")}>Ustawienia rehabilitacji</button></div>
    <p>Daty pomiarów i treningów są prezentowane według dotychczasowych zasad. Zmiana strefy konta nie przepisuje historii.</p>
  </section></>;
  if (tab === "Aplikacja") return <><h1>Aplikacja</h1><section className="panel"><h2>Aktualizacje i pamięć</h2>
    <p>Body Reconstruction · wersja {__APP_VERSION__}</p><p>{user ? "Dane konta są zapisywane w Supabase i wymagają połączenia z internetem." : "Dane lokalne są zapisane na tym urządzeniu. Wykonuj kopie zapasowe."}</p>
    <AppUpdater disabled={busy} hasUnsavedChanges={dirty} confirmAction={confirmAction} onApprovedReload={onApprovedReload} />
  </section></>;
  return <><h1>Mój profil</h1><section className="panel profile-overview">
    <ProfileAvatar name={profile?.name ?? "Konto"} path={profile?.avatarPath} />
    <div><h2>{profile?.name ?? "Konto"}</h2><p>{user?.email ?? "Profil lokalny — dane na urządzeniu"}</p>
      {user && <p>{user.email_confirmed_at ? "E-mail potwierdzony" : "E-mail oczekuje na potwierdzenie"}</p>}
      {accountTime && <p>Strefa konta: {profile?.timeZone ?? "Europe/Warsaw"} · {accountTime}</p>}</div>
  </section>
    {profile ? <PersonalInfoForm key={profile.id} profile={profile} user={user} onChanged={onChanged} onDirty={setPersonalDirty} onBusy={onBusy} disabled={busy} />
      : <p className="panel">Nie udało się pobrać profilu. Bezpieczeństwo konta i wylogowanie pozostają dostępne.</p>}
    <div className="actions"><button className="secondary" type="button" onClick={() => void onNavigate("Dane")}>Eksport i zarządzanie danymi</button>
      {user && <button type="button" className="secondary" disabled={busy} onClick={() => void onSignOut()}>Wyloguj z tego urządzenia</button>}</div>
    {user && <DeleteAccount onDirty={setDeleteDirty} onBusy={onBusy} confirmAction={confirmAction} disabled={busy} />}
  </>;
}
