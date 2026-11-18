import { useEffect, useRef, useState } from "react";
import { SessionFields } from "../SessionFields";
import { PainSlider } from "../PainSlider";
import { PlanComposer } from "../Plans";
import { completedGroups, exerciseById, painMonitor, visibleSets,
  type PainLog, type Session, type WorkoutTemplate, type RehabSite, type PainContext } from "../domain";

const fmt = (value: string) => new Date(value).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
type ExerciseStatus = "completed" | "finishedEarly" | "stopped";

export function WorkoutView({ active, cloud, busy, confirmAction, templates, workout, workoutDirty, last,
  hours, logs, sites, contexts, onSetChange, onTimerFinish, onReplace, onFinish, onDiscard,
  onStart, onLoadWorkout, onChangeWorkout, onSavePlan, onEditPlan }: {
  active?: Session;
  cloud: boolean;
  busy: boolean;
  confirmAction: (message: string) => Promise<boolean>;
  templates: WorkoutTemplate[];
  workout: WorkoutTemplate;
  workoutDirty: boolean;
  last?: Session;
  hours: number;
  logs: PainLog[];
  sites: RehabSite[];
  contexts: PainContext[];
  onSetChange: (session: Session) => void;
  onTimerFinish: (exerciseId: string, status: ExerciseStatus) => Promise<void>;
  onReplace: (from: string, to: string) => void;
  onFinish: (pain?: Record<string, string>) => void;
  onDiscard: () => void;
  onStart: (template?: WorkoutTemplate) => void;
  onLoadWorkout: (template: WorkoutTemplate) => void;
  onChangeWorkout: (template: WorkoutTemplate) => void;
  onSavePlan: (asNew: boolean) => void;
  onEditPlan: () => void;
}) {
  const previousActiveId = useRef(active?.id);
  const [recordPain, setRecordPain] = useState(false);
  const [postPain, setPostPain] = useState<Record<string, string>>({});
  const activeSites = sites.filter((site) => site.active);
  useEffect(() => {
    if (active && previousActiveId.current !== active.id) {
      window.requestAnimationFrame(() => {
        const heading = document.getElementById("workout-heading");
        heading?.scrollIntoView({ block: "start" });
        heading?.focus({ preventScroll: true });
      });
    }
    previousActiveId.current = active?.id;
    setRecordPain(false);
    setPostPain({});
  }, [active?.id]);
  return <>
    <h1 id="workout-heading" tabIndex={-1}>{active ? "Twój trening trwa" : "Następny trening"}</h1>
    <p className="intro">{active
      ? cloud
        ? "Zmiany serii zapisują się na koncie po potwierdzeniu zapisu. Możesz wrócić do treningu później."
        : "Każda zmiana jest zapisywana na urządzeniu. Możesz zamknąć aplikację i wrócić."
      : "Sprawdź monitor bólu i ustaw dawki. Jeden wpis serii dotyczy obu nóg."}</p>
    {active ? <>
      <p className="badge">{active.planName ?? "Plan początkowy"} · Rozpoczęto {new Date(active.started).toLocaleString("pl-PL")} · {completedGroups(active)}/{visibleSets(active).length} serii</p>
      <div className="actions workout-quick-finish">
        <button type="button" className="secondary" disabled={busy}
          onClick={() => onFinish(recordPain ? postPain : undefined)}>Zakończ trening wcześniej</button>
        <p>Możesz zapisać trening bez wykonania wszystkich zaplanowanych serii.</p>
      </div>
      <SessionFields session={active} disabled={busy} onChange={onSetChange} confirmAction={confirmAction}
        onTimerFinish={onTimerFinish} onReplace={onReplace} />
      {activeSites.length > 0 && <section className="panel" aria-label="Pomiar bólu po treningu">
        <h2>Odczuwany ból po treningu</h2>
        <label className="profile-config-toggle"><input type="checkbox" checked={recordPain} disabled={busy}
          onChange={(event) => setRecordPain(event.target.checked)} /> Zapisz pomiar bólu razem z treningiem</label>
        {recordPain && <>
          <p>Oceń każdy monitorowany obszar w skali od 0 do 10. Pomiar pojawi się też w Dzienniku.</p>
          {activeSites.map((site) => <PainSlider key={site.id} name={site.name} detail={site.bodyArea}
            value={postPain[site.id] ?? ""} disabled={busy}
            onChange={(value) => setPostPain((current) => ({ ...current, [site.id]: value }))} />)}
        </>}
      </section>}
      <div className="actions">
        <button type="button" disabled={busy || (recordPain && activeSites.some((site) => postPain[site.id] === undefined))}
          onClick={() => onFinish(recordPain ? postPain : undefined)}>Zakończ trening</button>
        <button type="button" className="destructive secondary" disabled={busy} onClick={onDiscard}>Odrzuć trening</button>
      </div>
    </> : <>
      <section className="panel">
        <h2>Moje plany</h2>
        <p>Wybierz zapisany plan i rozpocznij trening lub wczytaj go do dostosowania.</p>
        <div className="template-list">{templates.map((template) => <article key={template.id}>
          <h3>{template.name}</h3>
          <p>{template.entries.map((entry) => exerciseById(entry.exerciseId).name).join(" · ")}</p>
          <p>{template.entries.length} ćwiczeń · {template.entries.reduce((sum, entry) => sum + entry.sets, 0)} serii{template.entries.some((entry) => entry.timer) ? " · Zegar HSR" : ""}</p>
          <div className="actions">
            <button type="button" disabled={busy} onClick={() => onStart(template)}>Uruchom plan</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => onLoadWorkout(template)}>Dostosuj</button>
            <button type="button" className="secondary" onClick={onEditPlan}>Edytuj plan</button>
          </div>
        </article>)}</div>
        {!templates.length && <p>Brak zapisanych planów. Utwórz pierwszy plan poniżej.</p>}
      </section>
      <div className="notice">{last ? `Od ostatniego treningu minęło ${Math.floor(hours)} h.` : "Brak poprzednich treningów."}</div>
      <section className="panel" aria-label="Monitor bólu po ostatnim treningu">
        <h2>Monitor bólu po ostatnim treningu</h2>
        {last ? <>
          <p>Ostatni trening: {fmt(last.started)}. Pomiary z dnia treningu oraz poranków jeden i dwa dni później (około 24 i 48 h).</p>
          <div className="grid three">{painMonitor(last, logs).map(({ date, log }, index) =>
            <article key={date}>
              <h3>{["Przed treningiem", "Po około 24 h", "Po około 48 h"][index]}</h3>
              <p>{fmt(date + "T12:00:00")}</p>
              {log ? <>
                {log.values.map((value) => <p key={value.siteId}>{sites.find((site) => site.id === value.siteId)?.name ?? value.siteId}: <strong>{value.value} / 10</strong></p>)}
                <p>Godzina: {new Date(log.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })} · Kontekst: {(contexts.find((item) => item.value === log.context)?.label ?? log.context) || "Brak danych"}</p>
                {log.note && <p>{log.note}</p>}
              </> : <p>Brak danych</p>}
            </article>)}</div>
        </> : <p>Brak ukończonego treningu do porównania.</p>}
        <p>Samodzielnie wybierz, czy zwiększyć, zmniejszyć, czy pozostawić obciążenie.</p>
      </section>
      <section className="panel">
        <label>Zapisane plany treningowe
          <select value={templates.some((template) => template.id === workout.id) ? workout.id : ""}
            onChange={(event) => {
              const template = templates.find((row) => row.id === event.target.value);
              if (template) onLoadWorkout(template);
            }}>
            <option value="" disabled>Własny trening</option>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </label>
        <label>Nazwa planu
          <input maxLength={80} value={workout.name}
            onChange={(event) => onChangeWorkout({ ...workout, name: event.target.value })} />
        </label>
        <p>Ułóż ćwiczenia i zapisz plan w profilu, aby wczytać go przy kolejnym treningu. Rozpoczęty trening zachowa własną kopię kolejności i dawek.</p>
        {workoutDirty && <p role="status">Plan ma niezapisane zmiany.</p>}
        <div className="actions">
          <button type="button" className="secondary" disabled={busy || !workout.entries.length}
            onClick={() => onSavePlan(true)}>Zapisz jako nowy plan</button>
          {templates.some((template) => template.id === workout.id) &&
            <button type="button" className="secondary" disabled={busy || !workoutDirty || !workout.entries.length}
              onClick={() => onSavePlan(false)}>Zapisz zmiany w planie</button>}
        </div>
      </section>
      <PlanComposer entries={workout.entries}
        onChange={(entries) => onChangeWorkout({ ...workout, entries })} />
      <button type="button" disabled={busy || !workout.entries.length} onClick={() => onStart()}>
        Zatwierdź dawki i rozpocznij
      </button>
      <p className="footnote">MVP nie rozpoznaje urazów. Nagły silny ból lub utrata funkcji wymagają oceny medycznej; nie czekaj na kolejny wpis.</p>
    </>}
  </>;
}
