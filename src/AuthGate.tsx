import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "register" | "reset" | "update">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((authEvent, next) => {
      setSession(next);
      if (authEvent === "PASSWORD_RECOVERY") setMode("update");
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      const result = mode === "update"
        ? await supabase.auth.updateUser({ password })
        : mode === "register"
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href.split("#")[0] } })
        : mode === "reset"
          ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split("#")[0] })
          : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "update") { setMode("login"); setPassword(""); }
      if (mode !== "login") setMessage("Sprawdź wiadomość e-mail, aby dokończyć operację.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się połączyć z usługą logowania.");
    } finally { setBusy(false); }
  }

  if (!supabase) return <p role="alert">Brak konfiguracji Supabase. Ustaw publiczny adres i klucz projektu.</p>;
  if (loading) return <p>Sprawdzanie sesji…</p>;
  if (session && mode !== "update") return <>{children(session)}</>;
  return <main className="auth-screen">
    <h1>{mode === "register" ? "Utwórz konto" : mode === "reset" ? "Odzyskaj dostęp" : mode === "update" ? "Ustaw nowe hasło" : "Zaloguj się"}</h1>
    <form onSubmit={(event) => void submit(event)}>
      {mode !== "update" && <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
      {mode !== "reset" && <label>Hasło<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
      <button disabled={busy} type="submit">{mode === "register" ? "Zarejestruj" : mode === "reset" ? "Wyślij link" : mode === "update" ? "Zapisz nowe hasło" : "Zaloguj"}</button>
    </form>
    {message && <p role="status">{message}</p>}
    {mode !== "update" && <button type="button" className="secondary" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}>{mode === "login" ? "Utwórz konto" : "Wróć do logowania"}</button>}
    {mode === "login" && <button type="button" className="secondary" onClick={() => { setMode("reset"); setMessage(""); }}>Nie pamiętam hasła</button>}
  </main>;
}
