import { GuestLanguageSettings } from "./i18n/LanguageProvider";
import { useTranslation } from "react-i18next";
import { ui } from "./i18n/config";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { errorExplanation } from "./app/errorMessages";
import { accountRedirect } from "./account/accountRepository";
import { LoadingScreen } from "./app/LoadingScreen";
import { watchAuthSession } from "./app/watchAuthSession";

export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "register" | "reset" | "update">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    return watchAuthSession(supabase.auth, (next, authEvent) => {
      setSession(next); setSessionError("");
      if (authEvent === "PASSWORD_RECOVERY") setMode("update");
      setLoading(false);
    }, () => {
      setLoading(false);
      setSessionError("Nie udało się sprawdzić sesji. Sprawdź połączenie i spróbuj ponownie.");
    });
  }, [attempt]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      const result = mode === "update"
        ? await supabase.auth.updateUser({ password })
        : mode === "register"
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: accountRedirect() } })
        : mode === "reset"
          ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: accountRedirect() })
          : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "update") { setMode("login"); setPassword(""); }
      if (mode !== "login") setMessage("Sprawdź wiadomość e-mail, aby dokończyć operację.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Nie udało się połączyć z usługą logowania.";
      setMessage(errorExplanation(detail) ?? detail);
    } finally { setBusy(false); }
  }

  if (!supabase) return <p role="alert">{ui("Brak konfiguracji Supabase. Ustaw publiczny adres i klucz projektu.")}</p>;
  if (loading) return <LoadingScreen fullScreen />;
  if (sessionError) return <main className="auth-screen"><GuestLanguageSettings />
    <h1>{ui("Nie można wczytać aplikacji")}</h1><p role="alert">{ui(sessionError)}</p>
    <button type="button" onClick={() => { setSessionError(""); setLoading(true); setAttempt((value) => value + 1); }}>{ui("Spróbuj ponownie")}</button>
  </main>;
  if (session && mode !== "update") return <>{children(session)}</>;
  return <main className="auth-screen"><GuestLanguageSettings />
    <h1>{mode === "register" ? ui("Utwórz konto") : mode === "reset" ? ui("Odzyskaj dostęp") : mode === "update" ? ui("Ustaw nowe hasło") : ui("Zaloguj się")}</h1>
    <form onSubmit={(event) => void submit(event)}>
      {mode !== "update" && <label>E-mail<input name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
      {mode !== "reset" && <label>{ui("Hasło")}<input name="password" type="password" autoComplete={mode === "register" || mode === "update" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
      <button disabled={busy} type="submit">{busy ? ui("Przetwarzanie…") : mode === "register" ? ui("Zarejestruj") : mode === "reset" ? ui("Wyślij link") : mode === "update" ? ui("Zapisz nowe hasło") : ui("Zaloguj")}</button>
    </form>
    {message && <p role="status" aria-live="polite">{ui(message)}</p>}
    <div className="auth-links">
      {mode !== "update" && <button type="button" className="secondary" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}>{mode === "login" ? ui("Utwórz konto") : ui("Wróć do logowania")}</button>}
      {mode === "login" && <button type="button" className="secondary" onClick={() => { setMode("reset"); setMessage(""); }}>{ui("Nie pamiętam hasła")}</button>}
    </div>
  </main>;
}
