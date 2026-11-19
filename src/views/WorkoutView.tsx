import { useTranslation } from "react-i18next";
import { ui, locale } from "../i18n/config";
import { useEffect, useRef, useState } from "react";
import { SessionFields } from "../SessionFields";
import { PainSlider } from "../PainSlider";
import { PlanComposer } from "../Plans";
import { completedGroups, exerciseById, painMonitor, visibleSets,
  type PainLog, type Session, type WorkoutTemplate, type RehabSite, type PainContext } from "../domain";

const fmt = (value: string) => new Date(value).toLocaleDateString(locale(), { day: "numeric", month: "short" });
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
  onFinish: (pain?: Record<string, string>, reason?: Session["completionReason"]) => void;
  onDiscard: () => void;
  onStart: (template?: WorkoutTemplate) => void;
  onLoadWorkout: (template: WorkoutTemplate) => void;
  onChangeWorkout: (template: WorkoutTemplate) => void;
  onSavePlan: (asNew: boolean) => void;
  onEditPlan: () => void;
}) {
  useTranslation();
  const previousActiveId = useRef(active?.id);
  const [completionReason, setCompletionReason] = useState<NonNullable<Session["completionReason"]>>("unspecified");
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
    setCompletionReason("unspecified");
    setRecordPain(false);
    setPostPain({});
  }, [active?.id]);
  return <>
    <h1 id="workout-heading" tabIndex={-1}>{active ? ui("Twój trening trwa") : ui("Następny trening")}</h1>
    <p className="intro">{active
      ? cloud
        ? ui("Zmiany serii zapisują się na koncie po potwierdzeniu zapisu. Możesz wrócić do treningu później.")
        : ui("Każda zmiana jest zapisywana na urządzeniu. Możesz zamknąć aplikację i wrócić.")
      : ui("Sprawdź monitor bólu i ustaw dawki. Jeden wpis serii dotyczy obu nóg.")}</p>
    {active ? <>
      <p className="badge">{active.planName ?? "Plan początkowy"}  {ui("· Rozpoczęto")} {new Date(active.started).toLocaleString(locale())} · {completedGroups(active)}/{visibleSets(active).length}  {ui("serii")}</p>
      <div className="actions workout-quick-finish">
        <button type="button" className="secondary" disabled={busy}
          onClick={() => onFinish(recordPain ? postPain : undefined, completionReason)}>{ui("Zakończ trening wcześniej")}</button>
        <p>{ui("Możesz zapisać trening bez wykonania wszystkich zaplanowanych serii.")}</p>
      </div>
      <label>{ui("Powód wcześniejszego zakończenia (opcjonalnie)")} <select value={completionReason} onChange={(e) => setCompletionReason(e.target.value as NonNullable<Session["completionReason"]>)}>
          <option value="unspecified">{ui("Nie podano")}</option><option value="pain">{ui("Ból")}</option><option value="fatigue">{ui("Zmęczenie")}</option>
          <option value="time">{ui("Brak czasu")}</option><option value="other">{ui("Inny")}</option>
        </select></label>
      <SessionFields session={active} disabled={busy} onChange={onSetChange} confirmAction={confirmAction}
        onTimerFinish={onTimerFinish} onReplace={onReplace} />
      {activeSites.length > 0 && <section className="panel" aria-label={ui("Pomiar bólu po treningu")}>
        <h2>{ui("Odczuwany ból po treningu")}</h2>
        <label className="profile-config-toggle"><input type="checkbox" checked={recordPain} disabled={busy}
          onChange={(event) => setRecordPain(event.target.checked)} />  {ui("Zapisz pomiar bólu razem z treningiem")}</label>
        {recordPain && <>
          <p>{ui("Oceń każdy monitorowany obszar w skali od 0 do 10. Pomiar pojawi się też w Dzienniku.")}</p>
          {activeSites.map((site) => <PainSlider key={site.id} name={site.name} detail={site.bodyArea}
            value={postPain[site.id] ?? ""} disabled={busy}
            onChange={(value) => setPostPain((current) => ({ ...current, [site.id]: value }))} />)}
        </>}
      </section>}
      <div className="actions">
        <button type="button" disabled={busy || (recordPain && activeSites.some((site) => postPain[site.id] === undefined))}
          onClick={() => onFinish(recordPain ? postPain : undefined, completionReason)}>{ui("Zakończ trening")}</button>
        <button type="button" className="destructive secondary" disabled={busy} onClick={onDiscard}>{ui("Odrzuć trening")}</button>
      </div>
    </> : <>
      <section className="panel">
        <h2>{ui("Moje plany")}</h2>
        <p>{ui("Wybierz zapisany plan i rozpocznij trening lub wczytaj go do dostosowania.")}</p>
        <div className="template-list">{templates.map((template) => <article key={template.id}>
          <h3>{template.name}</h3>
          <p>{template.entries.map((entry) => ui(exerciseById(entry.exerciseId).name)).join(" · ")}</p>
          <p>{template.entries.length}  {ui("ćwiczeń ·")} {template.entries.reduce((sum, entry) => sum + entry.sets, 0)}  {ui("serii")}{template.entries.some((entry) => entry.timer) ? " " + ui("· Zegar HSR") : ""}</p>
          <div className="actions">
            <button type="button" disabled={busy} onClick={() => onStart(template)}>{ui("Uruchom plan")}</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => onLoadWorkout(template)}>{ui("Dostosuj")}</button>
            <button type="button" className="secondary" onClick={onEditPlan}>{ui("Edytuj plan")}</button>
          </div>
        </article>)}</div>
        {!templates.length && <p>{ui("Brak zapisanych planów. Utwórz pierwszy plan poniżej.")}</p>}
      </section>
      <div className="notice">{last ? ui("Od ostatniego treningu minęło {{v0}} h.", {v0: Math.floor(hours)}) : ui("Brak poprzednich treningów.")}</div>
      <section className="panel" aria-label={ui("Monitor bólu po ostatnim treningu")}>
        <h2>{ui("Monitor bólu po ostatnim treningu")}</h2>
        {last ? <>
          <p>{ui("Ostatni trening:")} {fmt(last.started)}{ui(". Pomiary według dni kalendarzowych, nie dokładnych odstępów 24/48 h. Szczegółowe powiązania znajdziesz w Analizach.")}</p>
          <div className="grid three">{painMonitor(last, logs).map(({ date, log }, index) =>
            <article key={date}>
              <h3>{[ui("Przed treningiem (tego dnia)"), ui("Następny dzień"), ui("Dwa dni później")][index]}</h3>
              <p>{fmt(date + "T12:00:00")}</p>
              {log ? <>
                {log.values.map((value) => <p key={value.siteId}>{sites.find((site) => site.id === value.siteId)?.name ?? value.siteId}: <strong>{value.value} / 10</strong></p>)}
                <p>{ui("Godzina:")}{new Date(log.at).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}  {ui("· Kontekst:")} {(contexts.find((item) => item.value === log.context)?.label ?? log.context) || "Brak danych"}</p>
                {log.note && <p>{log.note}</p>}
              </> : <p>{ui("Brak danych")}</p>}
            </article>)}</div>
        </> : <p>{ui("Brak ukończonego treningu do porównania.")}</p>}
        <p>{ui("Samodzielnie wybierz, czy zwiększyć, zmniejszyć, czy pozostawić obciążenie.")}</p>
      </section>
      <section className="panel">
        <label>{ui("Zapisane plany treningowe")} <select value={templates.some((template) => template.id === workout.id) ? workout.id : ""}
            onChange={(event) => {
              const template = templates.find((row) => row.id === event.target.value);
              if (template) onLoadWorkout(template);
            }}>
            <option value="" disabled>{ui("Własny trening")}</option>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </label>
        <label>{ui("Nazwa planu")} <input maxLength={80} value={workout.name}
            onChange={(event) => onChangeWorkout({ ...workout, name: event.target.value })} />
        </label>
        <p>{ui("Ułóż ćwiczenia i zapisz plan w profilu, aby wczytać go przy kolejnym treningu. Rozpoczęty trening zachowa własną kopię kolejności i dawek.")}</p>
        {workoutDirty && <p role="status">{ui("Plan ma niezapisane zmiany.")}</p>}
        <div className="actions">
          <button type="button" className="secondary" disabled={busy || !workout.entries.length}
            onClick={() => onSavePlan(true)}>{ui("Zapisz jako nowy plan")}</button>
          {templates.some((template) => template.id === workout.id) &&
            <button type="button" className="secondary" disabled={busy || !workoutDirty || !workout.entries.length}
              onClick={() => onSavePlan(false)}>{ui("Zapisz zmiany w planie")}</button>}
        </div>
      </section>
      <PlanComposer entries={workout.entries}
        onChange={(entries) => onChangeWorkout({ ...workout, entries })} />
      <button type="button" disabled={busy || !workout.entries.length} onClick={() => onStart()}>
         {ui("Zatwierdź dawki i rozpocznij")} </button>
      <p className="footnote">{ui("MVP nie rozpoznaje urazów. Nagły silny ból lub utrata funkcji wymagają oceny medycznej; nie czekaj na kolejny wpis.")}</p>
    </>}
  </>;
}
