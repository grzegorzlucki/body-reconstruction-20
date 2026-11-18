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
  return <label className="pain-row">
    <span>{name}{detail && <small> · {detail}</small>}</span>
    <span className="pain-slider-ends"><span>Brak bólu</span><span>Najsilniejszy wyobrażalny ból</span></span>
    <span className="pain-slider-control">
      <input type="range" min="0" max="10" step="1" value={value === "" ? "5" : value} disabled={disabled}
        aria-label={`Odczuwany ból: ${name}`} aria-valuetext={value === "" ? "Nie wybrano oceny" : `${value} na 10`}
        style={{ accentColor: value === "" ? "var(--color-accent-fill)" : painLevelColor(Number(value)) }}
        onPointerDown={(event) => { if (value === "") onChange(event.currentTarget.value); }}
        onChange={(event) => onChange(event.target.value)} />
      <output aria-live="polite">{value === "" ? "Wybierz ocenę" : `${value} / 10`}</output>
    </span>
  </label>;
}
