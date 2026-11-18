import { useId } from "react";

export function painLevelColor(value: number) {
  if (value <= 2) return "var(--pain-low)";
  if (value <= 4) return "var(--pain-mild)";
  if (value <= 6) return "var(--pain-moderate)";
  if (value <= 8) return "var(--pain-high)";
  return "var(--pain-severe)";
}

export function PainSlider({ name, detail, value, onChange, disabled = false }: {
  name: string;
  detail?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return <label className="pain-row">
    <span>{name}{detail && <small> · {detail}</small>}</span>
    <span className="pain-slider-control">
      <input id={id} type="range" min="0" max="10" step="1" value={value === "" ? "5" : value} disabled={disabled}
        data-pain-unrated={value === "" ? "true" : undefined} aria-describedby={`${id}-scale`}
        aria-label={`Odczuwany ból: ${name}`} aria-valuetext={value === "" ? "Nie wybrano oceny" : `${value} na 10`}
        style={{ accentColor: value === "" ? "var(--color-accent-fill)" : painLevelColor(Number(value)) }}
        onPointerUp={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault(); onChange(event.currentTarget.value);
          }
        }}
        onChange={(event) => onChange(event.target.value)} />
      <output htmlFor={id} aria-live="polite">{value === "" ? "Nie oceniono" : `${value} / 10`}</output>
    </span>
    <span id={`${id}-scale`} className="pain-slider-ends"><span>0 — brak bólu</span><span>10 — najsilniejszy wyobrażalny ból</span></span>
    {value === "" && <small>Przesuń suwak lub wskaż ocenę. Klawiatura: strzałki, Enter zatwierdza.</small>}
  </label>;
}
