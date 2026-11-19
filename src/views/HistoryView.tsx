import { useTranslation } from "react-i18next";
import { ui, locale } from "../i18n/config";
import { PainCharts } from "../PainCharts";
import { exerciseCatalog, sessionExercises, sessionPlan, completedGroups, visibleSets, type Injury, type PainLog, type Session, type RehabSite, type PainContext } from "../domain";

const fmt = (date: string) => new Date(date).toLocaleDateString(locale(), { day: "numeric", month: "short" });

export function HistoryView({ logs, sessions, sites, contexts, injuries, historyExercise, setHistoryExercise, openSessionEditor, editLog, navigate, onAnalyze }: {
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
  return <>

                <div className="section-title">
                  <h1>{ui("Historia procesu")}</h1>
                  <button onClick={() => openSessionEditor()}>
                     {ui("Dodaj trening historyczny")} </button>
                </div>
                <p className="intro">
                   {ui("Twoje rzeczywiste wpisy. Brak pomiaru pozostaje brakiem.")} </p>
                <PainCharts logs={logs} sites={sites} />
                <h2>{ui("Pomiary")}</h2>
                {!logs.length && (
                  <p>
                     {ui("Jeszcze bez pomiarów. Zacznij od dzisiejszego check-inu.")} </p>
                )}
                {[...logs].reverse().map((l) => (
                  <article className="history-row" key={l.id}>
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
                        {(contexts.find((item) => item.value === l.context)?.label ?? l.context) || "Bez kontekstu"}
                        {l.injuryIds?.length ? ` · ${l.injuryIds.map((id) => injuries.find((injury) => injury.id === id)?.name ?? id).join(", ")}` : ""} {l.note && `· ${l.note}`}
                      </small>
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
                        {fmt(s.started)} · {s.planName ?? "Plan początkowy"} ·{" "}
                        {s.ended ? completedGroups(s) < visibleSets(s).length ? ui("Zakończony wcześniej") : ui("Ukończony") : ui("W trakcie")} ·{" "}
                        {completedGroups(s)}/{visibleSets(s).length}  {ui("serii")} </summary>
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
                      {s.note && <p>{s.note}</p>}
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
