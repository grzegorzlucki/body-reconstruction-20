import { useTranslation } from "react-i18next";
import { ui } from "../i18n/config";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Profile } from "../db";
import { day, profileSettingsSchema, type ProfileSettings } from "../domain";

export function ProfileSettingsView({ profile, busy, onSave, onDirty }: {
  profile: Profile;
  busy: boolean;
  onSave: (settings: ProfileSettings) => Promise<boolean>;
  onDirty: (dirty: boolean) => void;
}) {
  useTranslation();
  const [settings, setSettings] = useState<ProfileSettings>(() => ({
    name: profile.name,
    weeklyGoal: profile.weeklyGoal,
    checkInTime: profile.checkInTime,
    rehabSites: structuredClone(profile.rehabSites),
    painContexts: structuredClone(profile.painContexts),
    injuries: structuredClone(profile.injuries ?? []),
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
      injuries: structuredClone(profile.injuries ?? []),
    };
    setSettings(next);
    setInitial(JSON.stringify(next));
  }, [profile]);
  useEffect(() => onDirty(isDirty), [isDirty, onDirty]);

  function updateSite(id: string, patch: Partial<ProfileSettings["rehabSites"][number]>) {
    setSettings((current) => ({ ...current, rehabSites: current.rehabSites.map((site) =>
      site.id === id ? { ...site, ...patch } : site) }));
  }
  function archiveSite(id: string) {
    setSettings((current) => {
      const visible = current.rehabSites.filter((site) => !site.archived && site.id !== id)
        .sort((a, b) => a.position - b.position);
      const positions = new Map(visible.map((site, position) => [site.id, position]));
      return { ...current, rehabSites: current.rehabSites.map((site) => site.id === id
        ? { ...site, archived: true, active: false }
        : positions.has(site.id) ? { ...site, position: positions.get(site.id)! } : site) };
    });
  }
  function updateContext(value: string, patch: Partial<ProfileSettings["painContexts"][number]>) {
    setSettings((current) => ({ ...current, painContexts: current.painContexts.map((context) =>
      context.value === value ? { ...context, ...patch } : context) }));
  }
  function updateInjury(id: string, patch: Partial<ProfileSettings["injuries"][number]>) {
    setSettings((current) => ({ ...current, injuries: current.injuries.map((injury) =>
      injury.id === id ? { ...injury, ...patch } : injury) }));
  }
  function moveSite(id: string, delta: number) {
    setSettings((current) => {
      const visible = current.rehabSites.filter((site) => !site.archived).sort((a, b) => a.position - b.position);
      const index = visible.findIndex((site) => site.id === id);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= visible.length) return current;
      [visible[index], visible[next]] = [visible[next], visible[index]];
      const positions = new Map(visible.map((site, position) => [site.id, position]));
      return { ...current, rehabSites: current.rehabSites.map((site) => positions.has(site.id)
        ? { ...site, position: positions.get(site.id)! } : site) };
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
    <h1>{ui("Rehabilitacja")}</h1>
    <p className="intro">{ui("Ten profil jest przypisany do zalogowanego konta. Zmiany zapisują się w jego bazie danych.")}</p>
    <form className="panel profile-settings" onSubmit={(event) => void submit(event)}>
      <section>
        <h2>{ui("Plan i dziennik")}</h2>
        <div className="grid two">
          <label>{ui("Cel treningów w tygodniu")} <select value={settings.weeklyGoal} onChange={(event) => setSettings((current) =>
              ({ ...current, weeklyGoal: Number(event.target.value) }))}>
              {Array.from({ length: 15 }, (_, goal) => <option key={goal} value={goal}>{goal}</option>)}
            </select>
          </label>
          <label>{ui("Godzina domyślnego check-inu")} <input type="time" value={settings.checkInTime}
              onChange={(event) => setSettings((current) => ({ ...current, checkInTime: event.target.value }))} />
          </label>
        </div>
      </section>

      <section>
        <div className="section-title"><h2>{ui("Kontuzje i leczone obszary")}</h2>
          <button type="button" className="secondary" disabled={busy || settings.injuries.length >= 50} onClick={() => setSettings((current) => ({
            ...current,
            injuries: [...current.injuries, {
              id: crypto.randomUUID(), name: "", side: "unspecified", startedOn: day(new Date()),
              status: "active", siteIds: [], note: "", position: current.injuries.length,
            }],
          }))}>{ui("Dodaj kontuzję")}</button>
        </div>
        <p>{ui("Kontuzje łączą raporty z konkretnymi ścięgnami lub obszarami. Zakończone wpisy pozostają w historii.")}</p>
        {!settings.injuries.length && <p>{ui("Nie dodano jeszcze kontuzji.")}</p>}
        {settings.injuries.map((injury) => <fieldset className="profile-config-row injury-config" key={injury.id}>
          <legend className="visually-hidden">{ui("Kontuzja")}</legend>
          <label>{ui("Nazwa lub rozpoznanie")} <input required maxLength={100} value={injury.name}
              onChange={(event) => updateInjury(injury.id, { name: event.target.value })} />
          </label>
          <label>{ui("Strona ciała")} <select value={injury.side} onChange={(event) => updateInjury(injury.id, { side: event.target.value as typeof injury.side })}>
              <option value="unspecified">{ui("Nie określono")}</option><option value="left">{ui("Lewa")}</option>
              <option value="right">{ui("Prawa")}</option><option value="both">{ui("Obie")}</option>
            </select>
          </label>
          <label>{ui("Od kiedy")} <input required type="date" value={injury.startedOn}
              onChange={(event) => updateInjury(injury.id, { startedOn: event.target.value })} />
          </label>
          <label>{ui("Status")} <select value={injury.status} onChange={(event) => updateInjury(injury.id, {
              status: event.target.value as typeof injury.status,
              resolvedOn: event.target.value === "resolved" ? (injury.resolvedOn ?? day(new Date())) : undefined,
            })}>
              <option value="active">{ui("Aktywna")}</option><option value="paused">{ui("Wstrzymana")}</option>
              <option value="resolved">{ui("Zakończona")}</option>
            </select>
          </label>
          {injury.status === "resolved" && <label>{ui("Data zakończenia")} <input type="date" min={injury.startedOn} value={injury.resolvedOn ?? ""}
              onChange={(event) => updateInjury(injury.id, { resolvedOn: event.target.value || undefined })} />
          </label>}
          <fieldset className="injury-sites"><legend>{ui("Powiązane ścięgna i obszary")}</legend>
            {settings.rehabSites.map((site) => <label className="profile-config-toggle" key={site.id}>
              <input type="checkbox" checked={injury.siteIds.includes(site.id)} disabled={site.archived}
                onChange={(event) => updateInjury(injury.id, { siteIds: event.target.checked
                  ? [...injury.siteIds, site.id] : injury.siteIds.filter((id) => id !== site.id) })} />
              {site.name} · {site.bodyArea}{site.archived ? " " + ui("(usunięty — historia zachowana)") : ""}
            </label>)}
          </fieldset>
          <label className="injury-note">{ui("Notatka (opcjonalnie)")} <textarea maxLength={1000} value={injury.note}
              onChange={(event) => updateInjury(injury.id, { note: event.target.value })} />
          </label>
          <button type="button" className="text-button" disabled={busy} onClick={() => {
            if (profile.injuries.some((saved) => saved.id === injury.id))
              updateInjury(injury.id, { status: "resolved", resolvedOn: day(new Date()) });
            else setSettings((current) => ({ ...current, injuries: current.injuries.filter((item) => item.id !== injury.id) }));
          }}>{profile.injuries.some((saved) => saved.id === injury.id) ? ui("Zakończ kontuzję") : ui("Usuń szkic")}</button>
        </fieldset>)}
      </section>

      <section>
        <div className="section-title"><h2>{ui("Monitorowane ścięgna i obszary")}</h2>
          <button type="button" className="secondary" disabled={busy || settings.rehabSites.length >= 50} onClick={() => setSettings((current) => ({
            ...current,
            rehabSites: [...current.rehabSites, { id: crypto.randomUUID(), name: "", bodyArea: "", position: current.rehabSites.filter((site) => !site.archived).length, active: true, archived: false }],
          }))}>{ui("Dodaj obszar")}</button>
        </div>
        <p>{ui("Wyłączony obszar znika z nowych pomiarów. Usunięcie chowa go z ustawień, ale zachowuje wcześniejsze pomiary i nazwy w historii.")}</p>
        {settings.rehabSites.filter((site) => !site.archived).sort((a, b) => a.position - b.position).map((site, index, visibleSites) => <fieldset className="profile-config-row rehab-site-config" key={site.id}>
          <legend className="visually-hidden">{ui("Obszar rehabilitacji")}</legend>
          <label>{ui("Nazwa obszaru")} <input required maxLength={100} value={site.name}
              onChange={(event) => updateSite(site.id, { name: event.target.value })} />
          </label>
          <label>{ui("Część ciała")} <input required maxLength={100} value={site.bodyArea}
              onChange={(event) => updateSite(site.id, { bodyArea: event.target.value })} />
          </label>
          <div className="site-config-controls">
            <label className="profile-config-toggle"><input type="checkbox" checked={site.active}
              onChange={(event) => updateSite(site.id, { active: event.target.checked })} />  {ui("Monitoruj")}</label>
            <div className="profile-order-actions">
              <button type="button" className="secondary" disabled={busy || index === 0} aria-label={ui("Przenieś obszar wyżej")} onClick={() => moveSite(site.id, -1)}>{ui("Góra")}</button>
              <button type="button" className="secondary" disabled={busy || index === visibleSites.length - 1} aria-label={ui("Przenieś obszar niżej")} onClick={() => moveSite(site.id, 1)}>{ui("Dół")}</button>
            </div>
            <button type="button" className="remove-site" disabled={busy || (site.active && settings.rehabSites.filter((item) => !item.archived && item.active).length <= 1)}
              aria-label={ui("Usuń obszar {{v0}}", {v0: site.name || "bez nazwy"})} onClick={() => archiveSite(site.id)}>{ui("Usuń obszar")}</button>
          </div>
        </fieldset>)}
        {!settings.rehabSites.some((site) => !site.archived) && <p>{ui("Dodaj nowy obszar, aby monitorować pomiary.")}</p>}
      </section>

      <section>
        <div className="section-title"><h2>{ui("Konteksty dziennika")}</h2>
          <button type="button" className="secondary" disabled={busy || settings.painContexts.length >= 30} onClick={() => setSettings((current) => {
            const value = `custom-${crypto.randomUUID()}`;
            return { ...current, painContexts: [...current.painContexts,
              { value, label: "", position: current.painContexts.length, active: true }] };
          })}>{ui("Dodaj kontekst")}</button>
        </div>
        <p>{ui("Możesz zmienić nazwy i dostępność opcji. Wartości zapisane wcześniej w dzienniku nie są zmieniane.")}</p>
        {settings.painContexts.map((context) => <div className="profile-config-row" key={context.value}>
          <label>{ui("Nazwa kontekstu")} <input required maxLength={100} value={context.label}
              onChange={(event) => updateContext(context.value, { label: event.target.value })} />
          </label>
          <label className="profile-config-toggle"><input type="checkbox" checked={context.active}
            onChange={(event) => updateContext(context.value, { active: event.target.checked })} />  {ui("Dostępny w dzienniku")}</label>
        </div>)}
      </section>

      {validationError && <p role="alert" className="alert">{validationError}</p>}
      {isDirty && <p role="status">{ui("Masz niezapisane ustawienia.")}</p>}
      <div className="actions">
        <button type="submit" disabled={busy || saving || !isDirty}>{busy ? ui("Zapisywanie…") : ui("Zapisz ustawienia")}</button>
      </div>
    </form>
  </>;
}
