export function PainSlider({ name, detail, value, onChange, disabled = false }: {
  name: string;
  detail?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return <label className="pain-row">
    <span>{name}{detail && <small> · {detail}</small>}</span>
    <span className="pain-slider-control">
      <input type="range" min="0" max="10" step="1" value={value === "" ? "5" : value} disabled={disabled}
        aria-label={`Odczuwany ból: ${name}`} aria-valuetext={value === "" ? "Nie wybrano oceny" : `${value} na 10`}
        onPointerDown={() => { if (value === "") onChange("5"); }}
        onChange={(event) => onChange(event.target.value)} />
      <output aria-live="polite">{value === "" ? "Wybierz ocenę" : `${value} / 10`}</output>
    </span>
  </label>;
}
