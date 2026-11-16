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
  const explanation = errorExplanation(message);
  return <div role="alert" className="alert">
    {explanation ?? message}
    {explanation && <details className="error-details">
      <summary>Szczegóły techniczne</summary>
      <code>{message}</code>
    </details>}
  </div>;
}
