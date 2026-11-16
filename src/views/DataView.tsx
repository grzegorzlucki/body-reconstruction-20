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
  const lastExport = localStorage.getItem(`rehab-last-backup:${profileId}`) ||
    (profileId === legacyProfileId ? localStorage.getItem("rehab-last-backup") : null);
  return <>
    <h1>Twoje dane, u Ciebie</h1>
    {cloud && localProfiles.length > 0 && <section className="panel">
      <h2>Przenieś lokalne dane do konta</h2>
      <label>Profil na tym urządzeniu
        <select value={sourceProfileId} onChange={(event) => onSourceProfileChange(event.target.value)}>
          {localProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </select>
      </label>
      <p>Import zastąpi dane wybranego profilu konta. Lokalna kopia pozostanie na urządzeniu.</p>
      <button type="button" disabled={busy} onClick={onMigrate}>Przenieś do wybranego profilu konta</button>
    </section>}
    <p className="intro">{cloud
      ? "Dane konta są przechowywane w Supabase. Eksportuj kopię JSON, aby mieć własne archiwum."
      : "Baza jest na tym urządzeniu. Zmiana adresu aplikacji, przeglądarki lub wyczyszczenie pamięci może oznaczać osobną albo pustą bazę."}</p>
    <section className="panel">
      <h2>Kopia zapasowa</h2>
      <p>{logs.length} pomiarów · {sessions.length} treningów · {templates.length} planów</p>
      <p>Ostatni eksport: {lastExport ? new Date(lastExport).toLocaleString("pl-PL") : "jeszcze nie wykonano"}</p>
      <button type="button" disabled={busy} onClick={onDownload}>Eksportuj pełną kopię JSON</button>
      <p>Zapisz pobrany plik w aplikacji Pliki. Eksport obejmuje dane zdrowotne — przechowuj go prywatnie.</p>
    </section>
    <section className="panel">
      <h2>Odtwórz kopię</h2>
      <p>Import zastępuje dane wybranego profilu po sprawdzeniu pliku i potwierdzeniu.</p>
      <label>Wybierz plik JSON
        <input disabled={busy} type="file" accept=".json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImport(file);
            event.target.value = "";
          }} />
      </label>
    </section>
    <section className="panel">
      <h2>Pamięć i instalacja</h2>
      <button type="button" className="secondary" onClick={onPersist}>Poproś o trwałe przechowywanie</button>
      <p>Na iPhonie: Safari → Udostępnij → Dodaj do ekranu początkowego. Do instalacji i działania offline potrzebny jest adres HTTPS. Szczegóły testowania znajdziesz w README projektu.</p>
    </section>
  </>;
}
