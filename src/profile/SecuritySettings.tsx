import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { accountRedirect } from "../account/accountRepository";

export function SecuritySettings({ user, onDirty, onBusy, confirmAction }: {
  user?: User; onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void;
  confirmAction: (message: string) => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => onDirty(!!(email || currentPassword || password || confirmation)), [email, currentPassword, password, confirmation, onDirty]);
  async function submit(event: FormEvent<HTMLFormElement>, kind: "email" | "password") {
    event.preventDefault();
    if (!supabase || !user?.email || busy) return;
    if (kind === "password" && (password !== confirmation || password.length < 8)) { setMessage("Nowe hasła muszą być identyczne i mieć co najmniej 8 znaków."); return; }
    setBusy(true); onBusy(true); setMessage("");
    try {
      const login = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (login.error) throw Error("Nie udało się potwierdzić aktualnego hasła.");
      const { error } = await supabase.auth.updateUser(kind === "email" ? { email: email.trim() } : { password }, { emailRedirectTo: accountRedirect() });
      if (error) throw error;
      setEmail(""); setPassword(""); setConfirmation(""); setCurrentPassword(""); onDirty(false);
      setMessage(kind === "email" ? "Wysłano prośbę o zmianę e-maila. Sprawdź pocztę i potwierdź zmianę." : "Hasło zmienione.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Nie udało się zapisać zmian."); }
    finally { setBusy(false); onBusy(false); }
  }
  if (!user) return <p className="panel">Tryb lokalny nie ma hasła ani adresu konta. Dane są zapisane na tym urządzeniu.</p>;
  return <>
    <section className="panel"><h2>Bezpieczeństwo konta</h2><p>Adres: {user.email}</p>
      <p>{user.email_confirmed_at ? "Adres e-mail potwierdzony" : "Adres e-mail oczekuje na potwierdzenie"}</p>
      {user.new_email && <p role="status">Oczekująca zmiana: {user.new_email}</p>}
      <label>Aktualne hasło<input name="currentPassword" type="password" autoComplete="current-password" value={currentPassword}
        disabled={busy} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
      <p>Aktualne hasło potwierdza tożsamość przed zmianą danych logowania.</p>
    </section>
    <form className="panel" onSubmit={(event) => void submit(event, "email")}><h2>Zmień e-mail</h2>
      <label>Nowy adres e-mail<input name="newEmail" type="email" autoComplete="email" required spellCheck={false} disabled={busy}
        value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <button disabled={busy || !currentPassword}>Wyślij potwierdzenie zmiany</button>
    </form>
    <form className="panel" onSubmit={(event) => void submit(event, "password")}><h2>Zmień hasło</h2>
      <label>Nowe hasło<input name="newPassword" type="password" autoComplete="new-password" required minLength={8} disabled={busy}
        value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <label>Powtórz nowe hasło<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} disabled={busy}
        value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      <button disabled={busy || !currentPassword}>Zapisz nowe hasło</button>
    </form>
    <button type="button" className="secondary" disabled={busy} onClick={async () => {
      if (!user.email || !supabase || !await confirmAction("Wysłać na adres konta link do odzyskania hasła?")) return;
      setBusy(true); onBusy(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: accountRedirect() });
        if (error) throw error; setMessage("Link do odzyskania hasła został wysłany.");
      } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Nie udało się wysłać wiadomości."); }
      finally { setBusy(false); onBusy(false); }
    }}>Wyślij link do odzyskania hasła</button>
    {message && <p className="notice" role="status">{message}</p>}
  </>;
}
