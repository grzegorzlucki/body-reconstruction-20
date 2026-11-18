import type { TimerSettings } from "./intervalTimer";

export function UnilateralTimerFields({ settings, onChange }: {
  settings: Pick<TimerSettings, "unilateral" | "sidePrepare" | "firstSide">;
  onChange: (patch: Pick<TimerSettings, "unilateral" | "sidePrepare" | "firstSide">) => void;
}) {
  return <fieldset className="unilateral-timer-fields">
    <legend>Strony ćwiczenia</legend>
    <label className="profile-config-toggle"><input type="checkbox" checked={settings.unilateral ?? false}
      onChange={(event) => onChange({ unilateral: event.target.checked,
        ...(!event.target.checked && (!Number.isInteger(settings.sidePrepare) || (settings.sidePrepare ?? 5) < 0 || (settings.sidePrepare ?? 5) > 3600)
          ? { sidePrepare: 5 } : {}),
      })} /> Ćwiczenie jednostronne — obie strony po kolei</label>
    {settings.unilateral && <>
      <label>Pierwsza strona<select value={settings.firstSide ?? "L"}
        onChange={(event) => onChange({ firstSide: event.target.value as "L" | "P" })}>
        <option value="L">Lewa</option><option value="P">Prawa</option>
      </select></label>
      <label>Przygotowanie przy zmianie strony (s)<input type="number" min="0" max="3600" step="1" required
        value={Number.isNaN(settings.sidePrepare) ? "" : settings.sidePrepare ?? 5}
        onChange={(event) => onChange({ sidePrepare: event.target.value === "" ? NaN : Number(event.target.value) })} /></label>
      <p>Powtórzenia dotyczą każdej strony. Jedna seria obejmuje obie strony; przerwa zaczyna się dopiero po drugiej. Przygotowanie do zmiany strony jest dodatkowym czasem.</p>
    </>}
  </fieldset>;
}
