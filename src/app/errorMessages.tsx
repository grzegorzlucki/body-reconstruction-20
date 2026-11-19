import { useTranslation } from "react-i18next";
import { hasUiTranslation, ui } from "../i18n/config";
export function errorExplanation(message: string): string | null {
  if (/email rate limit exceeded|over_email_send_rate_limit/i.test(message))
    return "Limit wysyłania wiadomości e-mail został przekroczony. Spróbuj ponownie później.";
  if (/invalid login credentials/i.test(message))
    return "Nieprawidłowy e-mail lub hasło.";
  if (/row-level security|permission denied|\b42501\b/i.test(message))
    return "Brak uprawnień do danych tego profilu. Sprawdź polityki dostępu w Supabase.";
  if (/schema cache|PGRST202|could not find the function/i.test(message))
    return "Brakuje funkcji zapisu w bazie. Zastosuj aktualne migracje Supabase.";
  if (/foreign key constraint/i.test(message))
    return "W bazie brakuje powiązanego ćwiczenia lub planu. Sprawdź katalog i migracje Supabase.";
  if (/invalid ISO datetime|invalid_format.*datetime/i.test(message))
    return "Nieprawidłowy format daty treningu. Odśwież aplikację i spróbuj ponownie.";
  if (/failed to fetch|networkerror|load failed/i.test(message))
    return "Nie można połączyć się z bazą. Sprawdź połączenie z internetem i spróbuj ponownie.";
  return null;
}

export function ErrorNotice({ message }: { message: string }) {
  useTranslation();
  const explanation = errorExplanation(message);
  let validation = "";
  try {
    const issues: unknown = JSON.parse(message);
    if (Array.isArray(issues) && issues.every((issue) => typeof issue?.message === "string"))
      validation = issues.map((issue) => hasUiTranslation(issue.message) ? ui(issue.message) : ui("Sprawdź poprawność wprowadzonych danych.")).join(" · ");
  } catch { /* Plain system messages are not JSON. */ }
  const display = explanation ?? (validation || (hasUiTranslation(message) ? ui(message) : ui("Nie udało się wykonać operacji. Spróbuj ponownie.")));
  return <div role="alert" className="alert">
    {ui(display)}
    {(explanation || validation || !hasUiTranslation(message)) && <details className="error-details">
      <summary>{ui("Szczegóły techniczne")}</summary>
      <code>{message}</code>
    </details>}
  </div>;
}
