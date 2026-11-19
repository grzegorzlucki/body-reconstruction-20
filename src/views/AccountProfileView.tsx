import { LanguageSettings } from "../profile/LanguageSettings";
import { useTranslation } from "react-i18next";
import { ui, locale } from "../i18n/config";
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
  useTranslation();
  return <nav className="profile-sections" aria-label={ui("Sekcje profilu")}>{profileSections.map((item) =>
    <button key={item.tab} type="button" className={tab === item.tab ? "selected" : ""} aria-current={tab === item.tab ? "page" : undefined}
      onClick={() => void onNavigate(item.tab)}>{ui(item.label)}</button>)}</nav>;
}

export function AccountProfileView({ tab, profile, user, busy, dirty, onDirty, onBusy, onChanged, onNavigate, onSignOut, confirmAction, onApprovedReload }: {
  tab: Tab; profile?: Profile; user?: User; busy: boolean; dirty: boolean;
  onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void; onChanged: () => Promise<unknown>;
  onNavigate: (tab: MainTab) => Promise<boolean>; onSignOut: () => Promise<void>;
  confirmAction: (message: string) => Promise<boolean>; onApprovedReload: () => void;
}) {
  useTranslation();
  const [personalDirty, setPersonalDirty] = useState(false);
  const [deleteDirty, setDeleteDirty] = useState(false);
  let accountTime = "";
  try { accountTime = new Intl.DateTimeFormat(locale(), { timeZone: profile?.timeZone ?? "Europe/Warsaw", dateStyle: "medium", timeStyle: "short" }).format(new Date()); }
  catch { /* Invalid legacy time zone can be corrected in the personal form. */ }
  useEffect(() => { if (tab === "Profil") onDirty(personalDirty || deleteDirty); }, [tab, personalDirty, deleteDirty, onDirty]);
  if (tab === "Bezpieczeństwo") return <><h1>{ui("Bezpieczeństwo")}</h1><SecuritySettings user={user} onDirty={onDirty} onBusy={onBusy} confirmAction={confirmAction} /></>;
  if (tab === "Preferencje") return <><h1>{ui("Preferencje")}</h1><LanguageSettings profileId={profile?.id} /><section className="panel"><h2>{ui("Ustawienia konta i rehabilitacji")}</h2>
    <p>{ui("Strefę czasową zmienisz w Moim profilu. Cel tygodniowy, godzinę pomiaru i monitorowane obszary znajdziesz w Rehabilitacji.")}</p>
    <div className="actions"><button className="secondary" onClick={() => void onNavigate("Profil")}>{ui("Dane profilu")}</button>
      <button className="secondary" onClick={() => void onNavigate("Ustawienia")}>{ui("Ustawienia rehabilitacji")}</button></div>
    <p>{ui("Daty pomiarów i treningów są prezentowane według dotychczasowych zasad. Zmiana strefy konta nie przepisuje historii.")}</p>
  </section></>;
  if (tab === "Aplikacja") return <><h1>{ui("Aplikacja")}</h1><section className="panel"><h2>{ui("Aktualizacje i pamięć")}</h2>
    <p>{ui("Body Reconstruction · wersja")} {__APP_VERSION__}</p><p>{user ? ui("Dane konta są zapisywane w Supabase i wymagają połączenia z internetem.") : ui("Dane lokalne są zapisane na tym urządzeniu. Wykonuj kopie zapasowe.")}</p>
    <AppUpdater disabled={busy} hasUnsavedChanges={dirty} confirmAction={confirmAction} onApprovedReload={onApprovedReload} />
  </section></>;
  return <><h1>{ui("Mój profil")}</h1><section className="panel profile-overview">
    <ProfileAvatar name={profile?.name ?? "Konto"} path={profile?.avatarPath} />
    <div><h2>{profile?.name ?? "Konto"}</h2><p>{user?.email ?? "Profil lokalny — dane na urządzeniu"}</p>
      {user && <p>{user.email_confirmed_at ? ui("E-mail potwierdzony") : ui("E-mail oczekuje na potwierdzenie")}</p>}
      {accountTime && <p>{ui("Strefa konta:")} {profile?.timeZone ?? "Europe/Warsaw"} · {accountTime}</p>}</div>
  </section>
    {profile ? <PersonalInfoForm key={profile.id} profile={profile} user={user} onChanged={onChanged} onDirty={setPersonalDirty} onBusy={onBusy} disabled={busy} />
      : <p className="panel">{ui("Nie udało się pobrać profilu. Bezpieczeństwo konta i wylogowanie pozostają dostępne.")}</p>}
    <div className="actions"><button className="secondary" type="button" onClick={() => void onNavigate("Dane")}>{ui("Eksport i zarządzanie danymi")}</button>
      {user && <button type="button" className="secondary" disabled={busy} onClick={() => void onSignOut()}>{ui("Wyloguj z tego urządzenia")}</button>}</div>
    {user && <DeleteAccount onDirty={setDeleteDirty} onBusy={onBusy} confirmAction={confirmAction} disabled={busy} />}
  </>;
}
