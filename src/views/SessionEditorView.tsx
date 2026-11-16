import type { FormEvent } from "react";
import { SessionFields } from "../SessionFields";
import { replaceSessionExercise, type Session } from "../domain";

export function SessionEditorView({ editing, editingExisting, editStart, editEnd, setEditStart, setEditEnd, setEditing, busy, saveHistorical, navigate, removeSession, confirmAction }: {
  editing: Session;
  editingExisting: boolean;
  editStart: string;
  editEnd: string;
  setEditStart: (value: string) => void;
  setEditEnd: (value: string) => void;
  setEditing: (session: Session) => void;
  busy: boolean;
  saveHistorical: (event: FormEvent) => void;
  navigate: (next: "Historia") => Promise<boolean>;
  removeSession: () => void;
  confirmAction: (message: string) => Promise<boolean>;
}) {
  return <>

                <h1>
                  {editingExisting
                    ? "Edytuj trening"
                    : "Dodaj trening historyczny"}
                </h1>
                <p className="intro">
                  Wpisz faktyczne wykonanie. Dane dla lewej i prawej nogi
                  uzupełniasz wspólnie. Zmiany zostaną zapisane dopiero po
                  zatwierdzeniu.
                </p>
                <form onSubmit={saveHistorical}>
                  <section className="panel">
                    <div className="grid two">
                      <label>
                        Początek treningu
                        <input
                          type="datetime-local"
                          required
                          value={editStart}
                          onChange={(e) => setEditStart(e.target.value)}
                        />
                      </label>
                      <label>
                        Koniec treningu
                        <input
                          type="datetime-local"
                          required
                          value={editEnd}
                          onChange={(e) => setEditEnd(e.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      Notatka treningu
                      <textarea
                        maxLength={2000}
                        value={editing.note}
                        onChange={(e) =>
                          setEditing({ ...editing, note: e.target.value })
                        }
                      />
                    </label>
                    <p className="footnote">
                      Wpisz rzeczywiste godziny treningu. Przyszłe i nakładające
                      się treningi nie są dozwolone.
                    </p>
                  </section>
                  <SessionFields
                    session={editing}
                    disabled={busy}
                    confirmAction={confirmAction}
                    onChange={setEditing}
                    onReplace={async (from, to) => {
                      if (
                        await confirmAction(
                          "Zastąpić ćwiczenie w tym wpisie? Jego serie trzeba będzie uzupełnić ponownie.",
                        )
                      )
                        setEditing(replaceSessionExercise(editing, from, to));
                    }}
                  />
                  <div className="actions">
                    <button disabled={busy}>Zapisz trening</button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => navigate("Historia")}
                    >
                      Anuluj
                    </button>
                    {editingExisting && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={removeSession}
                      >
                        Usuń trening
                      </button>
                    )}
                  </div>
                </form>
  </>;
}
