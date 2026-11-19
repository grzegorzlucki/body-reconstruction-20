import { useTranslation } from "react-i18next";
import { ui, locale } from "../i18n/config";
import type { Profile } from "../db";
import { legacyProfileId } from "../db";
import type { PainLog, Session, WorkoutTemplate } from "../domain";

export function DataView({ cloud, localProfiles, sourceProfileId, onSourceProfileChange,
  profileId, logs, sessions, templates, busy, onMigrate, onDownload, onImport, onPersist }: {
  cloud: boolean;
  localProfiles: Profile[];
  sourceProfileId: string;
  onSourceProfileChange: (id: string) => void;
  profileId: string;
  logs: PainLog[];
  sessions: Session[];
  templates: WorkoutTemplate[];
  busy: boolean;
  onMigrate: () => void;
  onDownload: () => void;
  onImport: (file: File) => void;
  onPersist: () => void;
}) {
  useTranslation();
  const lastExport = localStorage.getItem(`rehab-last-backup:${profileId}`) ||
    (profileId === legacyProfileId ? localStorage.getItem("rehab-last-backup") : null);
  return <>
    <h1>{ui("Twoje dane, u Ciebie")}</h1>
    {cloud && localProfiles.length > 0 && <section className="panel">
      <h2>{ui("Przenieś lokalne dane do konta")}</h2>
      <label>{ui("Profil na tym urządzeniu")} <select value={sourceProfileId} onChange={(event) => onSourceProfileChange(event.target.value)}>
          {localProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </select>
      </label>
      <p>{ui("Import zastąpi dane wybranego profilu konta. Lokalna kopia pozostanie na urządzeniu.")}</p>
      <button type="button" disabled={busy} onClick={onMigrate}>{ui("Przenieś do wybranego profilu konta")}</button>
    </section>}
    <p className="intro">{cloud
      ? ui("Dane konta są przechowywane w Supabase. Eksportuj kopię JSON, aby mieć własne archiwum.")
      : ui("Baza jest na tym urządzeniu. Zmiana adresu aplikacji, przeglądarki lub wyczyszczenie pamięci może oznaczać osobną albo pustą bazę.")}</p>
    <section className="panel">
      <h2>{ui("Kopia zapasowa")}</h2>
      <p>{logs.length}  {ui("pomiarów ·")} {sessions.length}  {ui("treningów ·")} {templates.length}  {ui("planów")}</p>
      <p>{ui("Ostatni eksport:")} {lastExport ? new Date(lastExport).toLocaleString(locale()) : ui("jeszcze nie wykonano")}</p>
      <button type="button" disabled={busy} onClick={onDownload}>{ui("Eksportuj pełną kopię JSON")}</button>
      <p>{ui("Zapisz pobrany plik w aplikacji Pliki. Eksport obejmuje dane zdrowotne — przechowuj go prywatnie.")}</p>
    </section>
    <section className="panel">
      <h2>{ui("Odtwórz kopię")}</h2>
      <p>{ui("Import zastępuje dane wybranego profilu po sprawdzeniu pliku i potwierdzeniu.")}</p>
      <label>{ui("Wybierz plik JSON")} <input disabled={busy} type="file" accept=".json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImport(file);
            event.target.value = "";
          }} />
      </label>
    </section>
    <section className="panel">
      <h2>{ui("Pamięć i instalacja")}</h2>
      <button type="button" className="secondary" onClick={onPersist}>{ui("Poproś o trwałe przechowywanie")}</button>
      <p>{ui("Na iPhonie: Safari → Udostępnij → Dodaj do ekranu początkowego. Do instalacji i działania offline potrzebny jest adres HTTPS. Szczegóły testowania znajdziesz w README projektu.")}</p>
    </section>
  </>;
}
