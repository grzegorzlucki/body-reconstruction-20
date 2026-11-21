import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { ui, locale } from "../i18n/config";
import { PainCharts } from "../PainCharts";
import { exerciseCatalog, sessionExercises, sessionPlan, completedGroups, visibleSets, type Injury, type PainLog, type Session, type RehabSite, type PainContext } from "../domain";

const fmt = (date: string) => new Date(date).toLocaleDateString(locale(), { day: "numeric", month: "short" });

export function HistoryView({ logs, sessions, sites, contexts, injuries, historyExercise, setHistoryExercise, openSessionEditor, editLog, navigate, onAnalyze, onPain }: {
  onPain: (session: Session) => void;
  logs: PainLog[];
  sites: RehabSite[];
  contexts: PainContext[];
  injuries: Injury[];
  sessions: Session[];
  historyExercise: string;
  setHistoryExercise: (value: string) => void;
  openSessionEditor: (session?: Session) => void;
  editLog: (id: string) => void;
  navigate: (next: "Dziennik") => Promise<boolean>;
  onAnalyze: (id: string) => void;
}) {
  useTranslation();
  const [measurementLimit,setMeasurementLimit]=useState(50);
  const [selectedLogId,setSelectedLogId]=useState<string | null>(null);
  const visibleLogs=useMemo(()=>[...logs].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,measurementLimit),[logs,measurementLimit]);
  return <>

                <div className="section-title">
                  <h1>{ui("Historia procesu")}</h1>
                  <button onClick={() => openSessionEditor()}>
                     {ui("Dodaj trening historyczny")} </button>
                </div>
                <p className="intro">
                   {ui("Twoje rzeczywiste wpisy. Brak pomiaru pozostaje brakiem.")} </p>
                <div className="history-measurement-layout">
                <PainCharts logs={visibleLogs} sites={sites} limit={null} selectedLogId={selectedLogId} onSelectLog={setSelectedLogId} />
                <section className="history-measurement-list" aria-label={ui("Pomiary")}><h2>{ui("Pomiary")}</h2>
                {!logs.length && (
                  <p>
                     {ui("Jeszcze bez pomiarów. Zacznij od dzisiejszego check-inu.")} </p>
                )}
                {visibleLogs.map((l) => (
                  <article className={`history-row${selectedLogId === l.id ? " measurement-highlighted" : ""}`} key={l.id} data-log-id={l.id} tabIndex={0} onPointerEnter={()=>setSelectedLogId(l.id)} onFocus={()=>setSelectedLogId(l.id)} onClick={()=>setSelectedLogId(l.id)}>
                    <div>
                      <b>
                        {fmt(l.at)} ·{" "}
                        {new Date(l.at).toLocaleTimeString(locale(), {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </b>
                      <p>
                        {l.values.map((value) => `${sites.find((site) => site.id === value.siteId)?.name ?? value.siteId}: ${value.value}`).join(" / ")}
                      </p>
                      <small>
                        {(contexts.find((item) => item.value === l.context)?.label ?? l.context) || ui("Bez kontekstu")}
                        {l.injuryIds?.length ? ` · ${l.injuryIds.map((id) => injuries.find((injury) => injury.id === id)?.name ?? id).join(", ")}` : ""}
                      </small>
                      {l.note && <details><summary>{ui("Notatka")}</summary><p className="calendar-note">{l.note}</p></details>}
                    </div>
                    <button
                      className="text-button"
                      onClick={async () => {
                        if (await navigate("Dziennik")) editLog(l.id);
                      }}
                    >
                       {ui("Edytuj")} </button>
                  </article>
                ))}
                {logs.length>measurementLimit && <button type="button" className="secondary" onClick={()=>setMeasurementLimit(value=>value+50)}>{ui("Pokaż kolejne pomiary")}</button>}
                </section></div>
                <h2>{ui("Treningi")}</h2>
                {!sessions.length && <p>{ui("Jeszcze bez treningów.")}</p>}
                <label>
                   {ui("Filtr ćwiczenia w historii")} <select
                    aria-label={ui("Filtr ćwiczenia w historii")}
                    value={historyExercise}
                    onChange={(event) => setHistoryExercise(event.target.value)}
                  >
                    <option value="">{ui("Wszystkie ćwiczenia")}</option>
                    {exerciseCatalog
                      .filter((e) =>
                        sessions.some((s) =>
                          s.sets.some((row) => row.exerciseId === e.id),
                        ),
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {ui(e.name)}
                        </option>
                      ))}
                  </select>
                </label>
                {historyExercise &&
                  !sessions.some((s) =>
                    s.sets.some((row) => row.exerciseId === historyExercise),
                  ) && <p>{ui("Brak treningów tego ćwiczenia.")}</p>}
                {[...sessions]
                  .filter(
                    (s) =>
                      !historyExercise ||
                      s.sets.some((row) => row.exerciseId === historyExercise),
                  )
                  .reverse()
                  .map((s) => (
                    <details className="panel" key={s.id}>
                      <summary>
                        {fmt(s.started)} · {s.activityName || s.planName || ui("Plan początkowy")} ·{" "}
                        {s.ended ? completedGroups(s) < visibleSets(s).length ? ui("Zakończony wcześniej") : ui("Ukończony") : ui("W trakcie")} ·{" "}
                        {s.activityType === "external" ? ui("Inna aktywność") : `${completedGroups(s)}/${visibleSets(s).length} ${ui("serii")}`} </summary>
                      {sessionExercises(s)
                        .filter(
                          (e) => !historyExercise || e.id === historyExercise,
                        )
                        .map((e) => (
                          <p key={e.id}>
                            <b>{ui(e.name)}</b>
                            <br />
                            {sessionPlan(s).find(
                              (entry) => entry.exerciseId === e.id,
                            )?.note && (
                              <span>
                                {
                                  sessionPlan(s).find(
                                    (entry) => entry.exerciseId === e.id,
                                  )?.note
                                }
                                <br />
                              </span>
                            )}
                            {visibleSets(s)
                              .filter((x) => x.exerciseId === e.id)
                              .map(
                                (x) =>
                                  `${e.unilateral ? "L+P" : "Obunóż"} ${x.weight} kg × ${x.reps}${x.done ? " ✓" : ""}`,
                              )
                              .join(" · ")}
                          </p>
                        ))}
                      {s.activityType === "external" && <p>{s.templateId ? ui("Aktywność zaliczana do celu") : ui("Aktywność poza celem treningowym")}</p>}
                      {s.note && <p>{s.note}</p>}
                      {s.ended && <button type="button" className="secondary" onClick={() => onPain(s)}>{ui("Dodaj pomiar po aktywności")}</button>}
                      {s.editedAt && (
                        <p className="footnote">
                          {ui("Poprawiono:")}{" "}
                          {new Date(s.editedAt).toLocaleString(locale())}
                        </p>
                      )}
                      <button type="button" className="secondary" onClick={() => onAnalyze(s.id)}>{ui("Analiza reakcji")}</button>
                      <button
                        className="secondary"
                        onClick={() => openSessionEditor(s)}
                      >
                        {s.ended ? ui("Edytuj trening") : ui("Wznów trening")}
                      </button>
                    </details>
                  ))}
  </>;
}
