import { useTranslation } from "react-i18next";
import { ui } from "../i18n/config";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../supabase";

export function DeleteAccount({ onDirty, onBusy, confirmAction, disabled = false }: {
  onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void;
  confirmAction: (message: string) => Promise<boolean>;
  disabled?: boolean;
}) {
  useTranslation();
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [removing, setBusy] = useState(false);
  const busy = removing || disabled;
  const confirmationPhrase = ui("USUŃ KONTO");
  useEffect(() => setPhrase(""), [confirmationPhrase]);
  const [error, setError] = useState("");
  useEffect(() => onDirty(!!(password || phrase)), [password, phrase, onDirty]);
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (!supabase || busy || phrase !== ui("USUŃ KONTO")) return;
    if (!await confirmAction("Usunąć konto, zdjęcie i wszystkie dane rehabilitacji? Tej operacji nie można cofnąć. Wcześniej wykonaj eksport w Moich danych.")) return;
    setBusy(true); onBusy(true); setError("");
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", { body: { password, confirmation: "USUŃ KONTO" } });
      if (error || !data?.deleted) throw Error("Nie udało się usunąć konta. Sprawdź hasło, połączenie i konfigurację funkcji delete-account. W razie częściowego błędu możesz ponowić operację.");
      setPassword(""); setPhrase(""); onDirty(false);
      await supabase.auth.signOut({ scope: "local" });
      window.location.replace(import.meta.env.BASE_URL);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nie udało się usunąć konta."); }
    finally { setBusy(false); onBusy(false); }
  }
  return <form className="panel danger-zone" onSubmit={(event) => void remove(event)}>
    <h2>{ui("Usuń konto")}</h2><p>{ui("Usunięcie obejmuje konto, zdjęcie, treningi, plany, pomiary i ustawienia w chmurze. Najpierw pobierz kopię danych. Wcześniejsze eksporty i lokalne kopie na urządzeniach pozostaną do ręcznego usunięcia.")}</p>
    <label>{ui("Aktualne hasło")}<input name="deletePassword" type="password" autoComplete="current-password" required disabled={busy}
      value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <label>{ui("Wpisz USUŃ KONTO")}<input name="deleteConfirmation" autoComplete="off" required disabled={busy}
      value={phrase} onChange={(event) => setPhrase(event.target.value)} /></label>
    <button className="destructive secondary" disabled={busy || phrase !== ui("USUŃ KONTO")}>{busy ? ui("Usuwanie…") : ui("Usuń konto i dane")}</button>
    {error && <p role="alert">{ui(error)}</p>}
  </form>;
}
