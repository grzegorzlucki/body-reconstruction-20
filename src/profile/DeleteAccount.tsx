import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../supabase";

export function DeleteAccount({ onDirty, onBusy, confirmAction, disabled = false }: {
  onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void;
  confirmAction: (message: string) => Promise<boolean>;
  disabled?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [removing, setBusy] = useState(false);
  const busy = removing || disabled;
  const [error, setError] = useState("");
  useEffect(() => onDirty(!!(password || phrase)), [password, phrase, onDirty]);
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (!supabase || busy || phrase !== "USUŃ KONTO") return;
    if (!await confirmAction("Usunąć konto, zdjęcie i wszystkie dane rehabilitacji? Tej operacji nie można cofnąć. Wcześniej wykonaj eksport w Moich danych.")) return;
    setBusy(true); onBusy(true); setError("");
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", { body: { password, confirmation: phrase } });
      if (error || !data?.deleted) throw Error("Nie udało się usunąć konta. Sprawdź hasło, połączenie i konfigurację funkcji delete-account. W razie częściowego błędu możesz ponowić operację.");
      setPassword(""); setPhrase(""); onDirty(false);
      await supabase.auth.signOut({ scope: "local" });
      window.location.replace(import.meta.env.BASE_URL);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nie udało się usunąć konta."); }
    finally { setBusy(false); onBusy(false); }
  }
  return <form className="panel danger-zone" onSubmit={(event) => void remove(event)}>
    <h2>Usuń konto</h2><p>Usunięcie obejmuje konto, zdjęcie, treningi, plany, pomiary i ustawienia w chmurze. Najpierw pobierz kopię danych. Wcześniejsze eksporty i lokalne kopie na urządzeniach pozostaną do ręcznego usunięcia.</p>
    <label>Aktualne hasło<input name="deletePassword" type="password" autoComplete="current-password" required disabled={busy}
      value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <label>Wpisz USUŃ KONTO<input name="deleteConfirmation" autoComplete="off" required disabled={busy}
      value={phrase} onChange={(event) => setPhrase(event.target.value)} /></label>
    <button className="destructive secondary" disabled={busy || phrase !== "USUŃ KONTO"}>{busy ? "Usuwanie…" : "Usuń konto i dane"}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
