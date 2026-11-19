import { useTranslation } from "react-i18next";
import { countLabel, searchLabels, ui, message as systemMessage } from "./i18n/config";
import { useState, useEffect } from "react";
import {
  exerciseCatalog,
  exerciseById,
  defaultTemplate,
  templateSchema,
  type PlanEntry,
  type WorkoutTemplate,
} from "./domain";
import { SetNumberInput } from "./SetNumberInput";
import { timerDefaults } from "./intervalTimer";
import { ErrorNotice } from "./app/errorMessages";
import { UnilateralTimerFields } from "./UnilateralTimerFields";

export function ExercisePicker({
  excluded,
  onPick,
  label = "Dodaj ćwiczenie",
}: {
  excluded: string[];
  onPick: (id: string) => void;
  label?: string;
}) {
  useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [equipment, setEquipment] = useState("");
  const normalize = (s: string) =>
    s
      .toLocaleLowerCase("pl")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replaceAll("ł", "l");
  const results = exerciseCatalog.filter(
    (e) =>
      !excluded.includes(e.id) &&
      (!equipment || e.equipment === equipment) &&
      normalize(searchLabels(e.name) + " " + searchLabels(e.detail) + " " + e.id).includes(
        normalize(query),
      ),
  );
  return (
    <div className="exercise-picker">
      <button
        type="button"
        className="secondary"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {ui(label)}
      </button>
      {open && (
        <section className="exercise-library" aria-label={ui("Baza ćwiczeń")}>
          <div className="grid two">
            <label>
               {ui("Szukaj ćwiczenia")} <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
               {ui("Sprzęt")} <select
                aria-label={ui("Sprzęt")}
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              >
                <option value="">{ui("Wszystkie")}</option>
                {[...new Set(exerciseCatalog.map((e) => e.equipment))].map(
                  (value) => (
                    <option key={value} value={value}>{ui(value ?? "")}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <p>{results.length}  {ui("ćwiczeń do wyboru")}</p>
          <div className="exercise-results">
            {results.map((e) => (
              <button
                type="button"
                className="exercise-option secondary"
                key={e.id}
                onClick={() => {
                  onPick(e.id);
                  setOpen(false);
                }}
              >
                <strong>{ui(e.name)}</strong>
                <span>
                  {ui(e.equipment ?? "")} · {ui(e.detail)}
                </span>
              </button>
            ))}
          </div>
          {!results.length && <p>{ui("Brak pasujących ćwiczeń.")}</p>}
        </section>
      )}
    </div>
  );
}

export function PlanComposer({
  entries,
  onChange,
}: {
  entries: PlanEntry[];
  onChange: (entries: PlanEntry[]) => void;
}) {
  useTranslation();
  function update(index: number, patch: Partial<PlanEntry>) {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function move(index: number, delta: number) {
    const next = [...entries];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  }
  return (
    <>
      {entries.map((entry, index) => {
        const exercise = exerciseById(entry.exerciseId);
        return (
          <section
            className="panel"
            key={entry.exerciseId}
            aria-label={ui("Ustawienia: {{v0}}",{v0: ui(exercise.name)})}
          >
            <h2>{ui(exercise.name)}</h2>
            <p>{ui(exercise.detail)}</p>
            <div className="actions plan-actions">
              <button
                type="button"
                className="secondary"
                aria-label={ui("Przesuń w górę: {{v0}}", {v0: ui(exercise.name)})}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="secondary"
                aria-label={ui("Przesuń w dół: {{v0}}", {v0: ui(exercise.name)})}
                disabled={index === entries.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <ExercisePicker
                label={ui("Zamień: {{v0}}", {v0: ui(exercise.name)})}
                excluded={entries.map((e) => e.exerciseId)}
                onPick={(exerciseId) =>
                  update(index, { exerciseId, weight: 0, reps: 0, note: "", timer: undefined })
                }
              />
              <button
                type="button"
                className="text-button"
                onClick={() => onChange(entries.filter((_, i) => i !== index))}
              >
                 {ui("Usuń:")} {ui(exercise.name)}
              </button>
            </div>
            <div className="grid three plan-numbers">
              <label>
                 {ui("Liczba serii")} <select
                  aria-label={ui("Liczba serii")}
                  value={entry.sets}
                  onChange={(event) =>
                    update(index, { sets: Number(event.target.value) })
                  }
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                 {ui("Ciężar")} {exercise.id === "calf" ? "dodatkowy " : ""}(kg)
                <SetNumberInput
                  type="number"
                  min={0}
                  max={500}
                  step="0.5"
                  value={entry.weight}
                  onValueChange={(weight) => update(index, { weight })}
                />
              </label>
              <label>
                 {ui("Powtórzenia w serii")}{exercise.unilateral ? " " + ui("(na stronę)") : ""}
                <SetNumberInput
                  type="number"
                  min={0}
                  max={50}
                  value={entry.reps}
                  onValueChange={(reps) => update(index, { reps })}
                />
              </label>
            </div>
            <label>
               {ui("Notatka do ćwiczenia:")} {ui(exercise.name)}
              <input
                maxLength={1000}
                placeholder={
                  exercise.equipment === "Guma"
                    ? ui("Np. kolor i opór gumy")
                    : ui("Wskazówki, sprzęt, ustawienie maszyny")
                }
                value={entry.note}
                onChange={(e) => update(index, { note: e.target.value })}
              />
            </label>
            <label className="timer-option">
              <input
                type="checkbox"
                checked={!!entry.timer}
                onChange={(event) => update(index, event.target.checked
                  ? { timer: { prepare: timerDefaults.prepare, move1: timerDefaults.move1,
                      hold: timerDefaults.hold, move2: timerDefaults.move2,
                      rest: timerDefaults.rest, sound: timerDefaults.sound,
                      unilateral: exercise.unilateral, sidePrepare: 5, firstSide: "L" },
                      reps: Math.max(1, entry.reps) }
                  : { timer: undefined })}
              />
               {ui("Użyj zegara HSR dla tego ćwiczenia")} </label>
            {entry.timer && <div className="timer-settings">
              {([ ["prepare", "Przygotowanie"], ["move1", "Ruch 1"],
                ["hold", "Zatrzymanie"], ["move2", "Ruch 2"],
                ["rest", "Przerwa między seriami"] ] as const).map(([key, label]) =>
                <label className="timer-field" key={key}>{ui(label)} (s)
                  <input type="number" min={0} max={3600} step={1}
                    aria-label={`${ui(label)}: ${ui(exercise.name)}`}
                    value={entry.timer![key]}
                    onChange={(event) => update(index, { timer: { ...entry.timer!, [key]: Number(event.target.value) } })} />
                </label>)}
              <label className="timer-option"><input type="checkbox" checked={entry.timer.sound}
                onChange={(event) => update(index, { timer: { ...entry.timer!, sound: event.target.checked } })} />  {ui("Dźwięk")}</label>
              <UnilateralTimerFields settings={entry.timer} onChange={(patch) => update(index, { timer: { ...entry.timer!, ...patch } })} />
              <p>{ui("Serii i powtórzeń zegar użyje z ustawień ćwiczenia powyżej.")}</p>
            </div>}
          </section>
        );
      })}
      {!entries.length && <p>{ui("Wybierz ćwiczenia z bazy, aby zbudować plan.")}</p>}
      {entries.length < 30 && (
        <ExercisePicker
          excluded={entries.map((e) => e.exerciseId)}
          onPick={(id) => {
            const e = exerciseById(id);
            onChange([
              ...entries,
              { exerciseId: id, sets: 3, weight: 0, reps: e.reps, note: "" },
            ]);
          }}
        />
      )}
    </>
  );
}

export function Plans({
  templates,
  onSave,
  onDelete,
  onDirty,
  confirmAction,
}: {
  onDirty: (dirty: boolean) => void;
  templates: WorkoutTemplate[];
  onSave: (template: WorkoutTemplate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  confirmAction: (message: string) => Promise<boolean>;
}) {
  useTranslation();
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  useEffect(() => {
    onDirty(!!editing);
    return () => onDirty(false);
  }, [editing, onDirty]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave(templateSchema.parse(editing));
      setEditing(null);
      setMessage("Plan zapisany.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać planu.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <h1>{ui("Twoje plany")}</h1>
      <p className="intro">
         {ui("Wybierz zapisany plan albo utwórz nowy. Zmiany planu nie wpływają na zapisane treningi.")} </p>
      {error && <ErrorNotice message={error} />}
      {message && (
        <p role="status" className="notice">
          {ui(message)}
        </p>
      )}
      {!editing ? (
        <>
          <div className="template-list">
            {templates.map((t) => (
              <article key={t.id}>
                <h2>{t.name}</h2>
                <p>
                  {t.entries
                    .map((e) => exerciseById(e.exerciseId).name)
                    .join(" · ")}
                </p>
                <p>
                  {t.entries.reduce((sum, e) => sum + e.sets, 0)}  {ui("serii ·")}{" "}
                  {countLabel("exercises", t.entries.length)} </p>
                <div className="actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditing(structuredClone(t));
                      setMessage("");
                      setError("");
                    }}
                  >
                    {ui("Edytuj:")}{t.name}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditing({
                        ...structuredClone(t),
                        id: crypto.randomUUID(),
                        name: t.name + " " + ui("— kopia"),
                      });
                      setMessage("");
                    }}
                  >
                    {ui("Kopiuj:")}{t.name}
                  </button>
                  <button
                    className="text-button"
                    onClick={async () => {
                      if (
                        !await confirmAction(
                          systemMessage("Usunąć plan „{{v0}}”? Historia treningów zostanie zachowana.", {v0: t.name}),
                        )
                      )
                        return;
                      try {
                        await onDelete(t.id);
                        setMessage(
                          "Plan usunięty. Historia pozostaje bez zmian.",
                        );
                      } catch {
                        setError("Nie udało się usunąć planu.");
                      }
                    }}
                  >
                     {ui("Usuń plan:")} {t.name}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!templates.length && (
            <p>
               {ui("Nie masz jeszcze szablonów. Utwórz pierwszy plan lub skopiuj plan początkowy.")} </p>
          )}
          <button
            onClick={() => {
              setEditing({ id: crypto.randomUUID(), name: "", entries: [] });
              setMessage("");
              setError("");
            }}
          >
             {ui("Nowy plan")} </button>{" "}
          <button
            className="secondary"
            onClick={() =>
              setEditing({ ...defaultTemplate(), id: crypto.randomUUID() })
            }
          >
             {ui("Utwórz z planu początkowego")} </button>
        </>
      ) : (
        <form onSubmit={save}>
          <label>
             {ui("Nazwa planu")} <input
              required
              maxLength={80}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder={ui("Np. Lower A")}
            />
          </label>
          <fieldset disabled={saving} className="plan-fieldset">
            <PlanComposer
              entries={editing.entries}
              onChange={(entries) => setEditing({ ...editing, entries })}
            />
          </fieldset>
          <div className="actions">
            <button disabled={saving || !editing.entries.length}>
               {ui("Zapisz plan")} </button>
            <button
              type="button"
              className="secondary"
              disabled={saving}
              onClick={async () => {
                if (await confirmAction("Odrzucić niezapisane zmiany planu?")) {
                  setEditing(null);
                  setError("");
                }
              }}
            >
               {ui("Anuluj edycję planu")} </button>
          </div>
        </form>
      )}
    </>
  );
}
