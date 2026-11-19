import { useTranslation } from "react-i18next";
import { ui } from "./i18n/config";
import type { TimerSettings } from "./intervalTimer";

export function UnilateralTimerFields({ settings, onChange }: {
  settings: Pick<TimerSettings, "unilateral" | "sidePrepare" | "firstSide">;
  onChange: (patch: Pick<TimerSettings, "unilateral" | "sidePrepare" | "firstSide">) => void;
}) {
  useTranslation();
  return <fieldset className="unilateral-timer-fields">
    <legend>{ui("Strony ćwiczenia")}</legend>
    <label className="profile-config-toggle"><input type="checkbox" checked={settings.unilateral ?? false}
      onChange={(event) => onChange({ unilateral: event.target.checked,
        ...(!event.target.checked && (!Number.isInteger(settings.sidePrepare) || (settings.sidePrepare ?? 5) < 0 || (settings.sidePrepare ?? 5) > 3600)
          ? { sidePrepare: 5 } : {}),
      })} />  {ui("Ćwiczenie jednostronne — obie strony po kolei")}</label>
    {settings.unilateral && <>
      <label>{ui("Pierwsza strona")}<select value={settings.firstSide ?? "L"}
        onChange={(event) => onChange({ firstSide: event.target.value as "L" | "P" })}>
        <option value="L">{ui("Lewa")}</option><option value="P">{ui("Prawa")}</option>
      </select></label>
      <label>{ui("Przygotowanie przy zmianie strony (s)")}<input type="number" min="0" max="3600" step="1" required
        value={Number.isNaN(settings.sidePrepare) ? "" : settings.sidePrepare ?? 5}
        onChange={(event) => onChange({ sidePrepare: event.target.value === "" ? NaN : Number(event.target.value) })} /></label>
      <p>{ui("Powtórzenia dotyczą każdej strony. Jedna seria obejmuje obie strony; przerwa zaczyna się dopiero po drugiej. Przygotowanie do zmiany strony jest dodatkowym czasem.")}</p>
    </>}
  </fieldset>;
}
