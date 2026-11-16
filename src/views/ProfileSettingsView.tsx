import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Profile } from "../db";
import { profileSettingsSchema, type ProfileSettings } from "../domain";

export function ProfileSettingsView({ profile, busy, onSave, onDirty }: {
  profile: Profile;
  busy: boolean;
  onSave: (settings: ProfileSettings) => Promise<boolean>;
  onDirty: (dirty: boolean) => void;
}) {
  const [settings, setSettings] = useState<ProfileSettings>(() => ({
    name: profile.name,
    weeklyGoal: profile.weeklyGoal,
    checkInTime: profile.checkInTime,
    rehabSites: structuredClone(profile.rehabSites),
    painContexts: structuredClone(profile.painContexts),
  }));
  const [initial, setInitial] = useState(() => JSON.stringify(settings));
  const [validationError, setValidationError] = useState("");
  const [saving, setSaving] = useState(false);
  const isDirty = useMemo(() => JSON.stringify(settings) !== initial, [settings, initial]);

  useEffect(() => {
    const next: ProfileSettings = {
      name: profile.name,
      weeklyGoal: profile.weeklyGoal,
      checkInTime: profile.checkInTime,
      rehabSites: structuredClone(profile.rehabSites),
      painContexts: structuredClone(profile.painContexts),
    };
    setSettings(next);
    setInitial(JSON.stringify(next));
  }, [profile]);
  useEffect(() => onDirty(isDirty), [isDirty, onDirty]);

  function updateSite(id: string, patch: Partial<ProfileSettings["rehabSites"][number]>) {
    setSettings((current) => ({ ...current, rehabSites: current.rehabSites.map((site) =>
      site.id === id ? { ...site, ...patch } : site) }));
  }
  function updateContext(value: string, patch: Partial<ProfileSettings["painContexts"][number]>) {
    setSettings((current) => ({ ...current, painContexts: current.painContexts.map((context) =>
      context.value === value ? { ...context, ...patch } : context) }));
  }
  function moveSite(id: string, delta: number) {
    setSettings((current) => {
      const index = current.rehabSites.findIndex((site) => site.id === id);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= current.rehabSites.length) return current;
      const rehabSites = [...current.rehabSites];
      [rehabSites[index], rehabSites[next]] = [rehabSites[next], rehabSites[index]];
      return { ...current, rehabSites: rehabSites.map((site, position) => ({ ...site, position })) };
    });
  }
  function moveContext(value: string, delta: number) {
    setSettings((current) => {
      const index = current.painContexts.findIndex((context) => context.value === value);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= current.painContexts.length) return current;
      const painContexts = [...current.painContexts];
      [painContexts[index], painContexts[next]] = [painContexts[next], painContexts[index]];
      return { ...current, painContexts: painContexts.map((context, position) => ({ ...context, position })) };
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = profileSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Sprawdź ustawienia profilu.");
      return;
    }
    setValidationError("");
    if (saving) return;
    setSaving(true);
    try {
      if (await onSave(parsed.data)) setInitial(JSON.stringify(parsed.data));
    } finally {
      setSaving(false);
    }
  }

  return <>
    <h1>Ustawienia profilu</h1>
    <p className="intro">Ten profil jest przypisany do zalogowanego konta. Zmiany zapisują się w jego bazie danych.</p>
    <form className="panel profile-settings" onSubmit={(event) => void submit(event)}>
      <section>
        <h2>Dane profilu</h2>
        <label>Nazwa profilu
          <input required maxLength={80} value={settings.name}
            onChange={(event) => setSettings((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <div className="grid two">
          <label>Cel treningów w tygodniu
            <select value={settings.weeklyGoal} onChange={(event) => setSettings((current) =>
              ({ ...current, weeklyGoal: Number(event.target.value) }))}>
              {Array.from({ length: 15 }, (_, goal) => <option key={goal} value={goal}>{goal}</option>)}
            </select>
          </label>
          <label>Godzina domyślnego check-inu
            <input type="time" value={settings.checkInTime}
              onChange={(event) => setSettings((current) => ({ ...current, checkInTime: event.target.value }))} />
          </label>
        </div>
      </section>

      <section>
        <div className="section-title"><h2>Monitorowane ścięgna i obszary</h2>
          <button type="button" className="secondary" disabled={busy || settings.rehabSites.length >= 50} onClick={() => setSettings((current) => ({
            ...current,
            rehabSites: [...current.rehabSites, { id: crypto.randomUUID(), name: "", bodyArea: "", position: current.rehabSites.length, active: true }],
          }))}>Dodaj obszar</button>
        </div>
        <p>Wyłączony obszar znika z nowych pomiarów, a wcześniejsze wartości pozostają w historii.</p>
        {settings.rehabSites.map((site) => <fieldset className="profile-config-row" key={site.id}>
          <legend className="visually-hidden">Obszar rehabilitacji</legend>
          <label>Nazwa obszaru
            <input required maxLength={100} value={site.name}
              onChange={(event) => updateSite(site.id, { name: event.target.value })} />
          </label>
          <label>Część ciała
            <input required maxLength={100} value={site.bodyArea}
              onChange={(event) => updateSite(site.id, { bodyArea: event.target.value })} />
          </label>
          <label className="profile-config-toggle"><input type="checkbox" checked={site.active}
            onChange={(event) => updateSite(site.id, { active: event.target.checked })} /> Monitoruj</label>
          <div className="profile-order-actions">
            <button type="button" className="secondary" disabled={busy || site.position === 0} aria-label="Move area up" onClick={() => moveSite(site.id, -1)}>Up</button>
            <button type="button" className="secondary" disabled={busy || site.position === settings.rehabSites.length - 1} aria-label="Move area down" onClick={() => moveSite(site.id, 1)}>Down</button>
          </div>
        </fieldset>)}
      </section>

      <section>
        <div className="section-title"><h2>Konteksty dziennika</h2>
          <button type="button" className="secondary" disabled={busy || settings.painContexts.length >= 30} onClick={() => setSettings((current) => {
            const value = `custom-${crypto.randomUUID()}`;
            return { ...current, painContexts: [...current.painContexts,
              { value, label: "", position: current.painContexts.length, active: true }] };
          })}>Dodaj kontekst</button>
        </div>
        <p>Możesz zmienić nazwy i dostępność opcji. Wartości zapisane wcześniej w dzienniku nie są zmieniane.</p>
        {settings.painContexts.map((context) => <div className="profile-config-row" key={context.value}>
          <label>Nazwa kontekstu
            <input required maxLength={100} value={context.label}
              onChange={(event) => updateContext(context.value, { label: event.target.value })} />
          </label>
          <label className="profile-config-toggle"><input type="checkbox" checked={context.active}
            onChange={(event) => updateContext(context.value, { active: event.target.checked })} /> Dostępny w dzienniku</label>
        </div>)}
      </section>

      {validationError && <p role="alert" className="alert">{validationError}</p>}
      {isDirty && <p role="status">Masz niezapisane ustawienia.</p>}
      <div className="actions">
        <button type="submit" disabled={busy || saving || !isDirty}>{busy ? "Zapisywanie…" : "Zapisz ustawienia"}</button>
      </div>
    </form>
  </>;
}
