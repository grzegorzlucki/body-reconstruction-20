import { PainCharts } from "../PainCharts";
import { exerciseCatalog, sessionExercises, sessionPlan, completedGroups, visibleSets, type Injury, type PainLog, type Session, type RehabSite, type PainContext } from "../domain";

const fmt = (date: string) => new Date(date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });

export function HistoryView({ logs, sessions, sites, contexts, injuries, historyExercise, setHistoryExercise, openSessionEditor, editDate, navigate }: {
  logs: PainLog[];
  sites: RehabSite[];
  contexts: PainContext[];
  injuries: Injury[];
  sessions: Session[];
  historyExercise: string;
  setHistoryExercise: (value: string) => void;
  openSessionEditor: (session?: Session) => void;
  editDate: (date: string) => void;
  navigate: (next: "Dziennik") => Promise<boolean>;
}) {
  return <>

                <div className="section-title">
                  <h1>Historia procesu</h1>
                  <button onClick={() => openSessionEditor()}>
                    Dodaj trening historyczny
                  </button>
                </div>
                <p className="intro">
                  Twoje rzeczywiste wpisy. Brak pomiaru pozostaje brakiem.
                </p>
                <PainCharts logs={logs} sites={sites} />
                <h2>Pomiary</h2>
                {!logs.length && (
                  <p>
                    Jeszcze bez pomiarów. Zacznij od dzisiejszego check-inu.
                  </p>
                )}
                {[...logs].reverse().map((l) => (
                  <article className="history-row" key={l.id}>
                    <div>
                      <b>
                        {fmt(l.at)} ·{" "}
                        {new Date(l.at).toLocaleTimeString("pl-PL", {
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
                      onClick={() => {
                        editDate(l.date);
                        navigate("Dziennik");
                      }}
                    >
                      Edytuj
                    </button>
                  </article>
                ))}
                <h2>Treningi</h2>
                {!sessions.length && <p>Jeszcze bez treningów.</p>}
                <label>
                  Filtr ćwiczenia w historii
                  <select
                    aria-label="Filtr ćwiczenia w historii"
                    value={historyExercise}
                    onChange={(event) => setHistoryExercise(event.target.value)}
                  >
                    <option value="">Wszystkie ćwiczenia</option>
                    {exerciseCatalog
                      .filter((e) =>
                        sessions.some((s) =>
                          s.sets.some((row) => row.exerciseId === e.id),
                        ),
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                </label>
                {historyExercise &&
                  !sessions.some((s) =>
                    s.sets.some((row) => row.exerciseId === historyExercise),
                  ) && <p>Brak treningów tego ćwiczenia.</p>}
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
                        {s.ended ? completedGroups(s) < visibleSets(s).length ? "Zakończony wcześniej" : "Ukończony" : "W trakcie"} ·{" "}
                        {completedGroups(s)}/{visibleSets(s).length} serii
                      </summary>
                      {sessionExercises(s)
                        .filter(
                          (e) => !historyExercise || e.id === historyExercise,
                        )
                        .map((e) => (
                          <p key={e.id}>
                            <b>{e.name}</b>
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
                          Poprawiono:{" "}
                          {new Date(s.editedAt).toLocaleString("pl-PL")}
                        </p>
                      )}
                      <button
                        className="secondary"
                        onClick={() => openSessionEditor(s)}
                      >
                        {s.ended ? "Edytuj trening" : "Wznów trening"}
                      </button>
                    </details>
                  ))}
  </>;
}
