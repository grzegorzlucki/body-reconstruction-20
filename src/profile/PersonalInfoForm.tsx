import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "../db";
import { accountIdentitySchema } from "../domain";
import { removeAvatar, saveAccountIdentity, uploadAvatar } from "../account/accountRepository";
import { ProfileAvatar } from "./ProfileAvatar";

export function PersonalInfoForm({ profile, user, onChanged, onDirty, onBusy, disabled = false }: {
  profile: Profile; user?: User; onChanged: () => Promise<unknown>; onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void; disabled?: boolean;
}) {
  const [name, setName] = useState(profile.name);
  const [timeZone, setTimeZone] = useState(profile.timeZone ?? "Europe/Warsaw");
  const [photo, setPhoto] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const [saving, setBusy] = useState(false);
  const busy = saving || disabled;
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const dirty = name !== profile.name || timeZone !== (profile.timeZone ?? "Europe/Warsaw") || !!photo || remove;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  function cancel() { setName(profile.name); setTimeZone(profile.timeZone ?? "Europe/Warsaw"); setPhoto(null); setRemove(false); setMessage(""); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = accountIdentitySchema.safeParse({ name, timeZone });
    if (!parsed.success) { setMessage(parsed.error.issues[0].message); return; }
    if (busy) return;
    setBusy(true); onBusy(true); setMessage("");
    let uploaded: string | undefined;
    let saved = false;
    try {
      if (photo && user) uploaded = await uploadAvatar(photo, user.id);
      const nextPath = uploaded ?? (remove ? null : profile.avatarPath ?? null);
      await saveAccountIdentity(profile.id, parsed.data, nextPath);
      saved = true;
      setName(parsed.data.name); setTimeZone(parsed.data.timeZone);
      setPhoto(null); setRemove(false); onDirty(false);
      if (profile.avatarPath && nextPath !== profile.avatarPath) await removeAvatar(profile.avatarPath).catch(() => {});
      await onChanged();
      setMessage("Profil zapisany.");
    } catch (cause) {
      if (uploaded && !saved) await removeAvatar(uploaded).catch(() => {});
      setMessage(saved ? "Profil zapisano. Odśwież widok, aby pobrać aktualne dane." : cause instanceof Error ? cause.message : "Nie udało się zapisać profilu.");
    } finally { setBusy(false); onBusy(false); }
  }
  return <form className="panel account-form" onSubmit={(event) => void save(event)}>
    <h2>Dane osobowe</h2>
    {preview ? <img className="profile-avatar" src={preview} alt="Podgląd wybranego zdjęcia" width="48" height="48" />
      : <ProfileAvatar name={name} path={remove ? null : profile.avatarPath} />}
    {user && <>
      <label>Zdjęcie profilowe<input key={`${remove}-${photo?.name ?? ""}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && (file.size > 2097152 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
            setMessage("Wybierz JPEG, PNG lub WebP do 2 MB."); event.target.value = ""; return;
          }
          setPhoto(file ?? null); setRemove(false); setMessage("");
        }} /></label>
      <p>JPEG, PNG lub WebP, maksymalnie 2 MB. Zdjęcie zostanie przycięte do kwadratu.</p>
      {photo && <p>Wybrano: {photo.name}</p>}
      {(profile.avatarPath || photo) && <button className="secondary" type="button" disabled={busy}
        onClick={() => { setPhoto(null); setRemove(true); }}>Usuń zdjęcie</button>}
    </>}
    <label>Nazwa wyświetlana<input name="displayName" autoComplete="nickname" required maxLength={80} disabled={busy}
      value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Strefa czasowa konta<input name="timeZone" list="account-time-zones" required disabled={busy} value={timeZone}
      onChange={(event) => setTimeZone(event.target.value)} /></label>
    <datalist id="account-time-zones">{["Europe/Warsaw", "Europe/London", "Europe/Berlin", "America/New_York", "UTC"].map((zone) => <option key={zone} value={zone} />)}</datalist>
    <p>Strefa określa zegar konta. Daty historycznych pomiarów pozostają takie, jak zapisano; formularze używają czasu urządzenia.</p>
    {message && <p role="status">{message}</p>}
    <div className="actions"><button type="submit" disabled={busy || !dirty}>{busy ? "Zapisywanie…" : "Zapisz zmiany"}</button>
      <button type="button" className="secondary" disabled={busy || !dirty} onClick={cancel}>Anuluj</button></div>
  </form>;
}
