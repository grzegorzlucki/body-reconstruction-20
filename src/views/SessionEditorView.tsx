import { useTranslation } from "react-i18next";
import { ui } from "../i18n/config";
import type { FormEvent } from "react";
import { SessionFields } from "../SessionFields";
import {
  newSession,
  replaceSessionExercise,
  type Session,
  type WorkoutTemplate,
} from "../domain";

export function SessionEditorView({
  templates,
  editing,
  editingExisting,
  editStart,
  editEnd,
  setEditStart,
  setEditEnd,
  setEditing,
  busy,
  saveHistorical,
  navigate,
  removeSession,
  confirmAction,
}: {
  templates: WorkoutTemplate[];
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
  useTranslation();
  return (
    <>
      <h1>
        {editingExisting
          ? ui("Edytuj trening")
          : ui("Dodaj trening historyczny")}
      </h1>
      <p className="intro">
        {editing.activityType === "external"
          ? ui(
              "Podaj nazwę aktywności i rzeczywiste godziny. Pomiar bólu możesz dodać po zapisaniu.",
            )
          : ui(
              "Wpisz faktyczne wykonanie. Dane dla lewej i prawej nogi uzupełniasz wspólnie. Zmiany zostaną zapisane dopiero po zatwierdzeniu.",
            )}{" "}
      </p>
      <form onSubmit={saveHistorical}>
        <section className="panel">
          {!editingExisting && (
            <label>
              {ui("Rodzaj treningu")}
              <select
                value={editing.activityType ?? "strength"}
                onChange={(event) => {
                  if (event.target.value === "external")
                    setEditing({
                      ...editing,
                      activityType: "external",
                      activityName: "",
                      sets: [],
                      plan: [],
                      templateId: undefined,
                      planName: undefined,
                    });
                  else
                    setEditing({
                      ...newSession({}, editing.started),
                      id: editing.id,
                      profileId: editing.profileId,
                      ended: editing.ended,
                      note: editing.note,
                    });
                }}
              >
                <option value="strength">{ui("Trening z ćwiczeniami")}</option>
                <option value="external">
                  {ui("Inna aktywność, np. bieganie")}
                </option>
              </select>
            </label>
          )}
          {editing.activityType === "external" && (
            <>
              <label>
                {ui("Nazwa aktywności")}
                <input
                  required
                  maxLength={80}
                  value={editing.activityName ?? ""}
                  onChange={(event) =>
                    setEditing({ ...editing, activityName: event.target.value })
                  }
                />
              </label>
              <label>
                {ui("Przypisz do planu (opcjonalnie)")}
                <select
                  aria-label={ui("Przypisz do planu (opcjonalnie)")}
                  value={editing.templateId ?? ""}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      templateId: event.target.value || undefined,
                      planName: templates.find(
                        (plan) => plan.id === event.target.value,
                      )?.name,
                    })
                  }
                >
                  <option value="">
                    {ui("Bez planu — poza celem treningowym")}
                  </option>
                  {templates.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {ui(
                  "Aktywność przypisana do planu liczy się do celu. Pozostałe aktywności są liczone osobno.",
                )}
              </p>
            </>
          )}
          <div className="grid two date-time-fields">
            <label>
              {ui("Początek treningu")}{" "}
              <input
                type="datetime-local"
                required
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
              />
            </label>
            <label>
              {ui("Koniec treningu")}{" "}
              <input
                type="datetime-local"
                required
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
              />
            </label>
          </div>
          <label>
            {ui("Notatka treningu")}{" "}
            <textarea
              maxLength={2000}
              value={editing.note}
              onChange={(e) => setEditing({ ...editing, note: e.target.value })}
            />
          </label>
          <p className="footnote">
            {ui(
              "Wpisz rzeczywiste godziny treningu. Przyszłe i nakładające się treningi nie są dozwolone.",
            )}{" "}
          </p>
        </section>
        {editing.activityType !== "external" && (
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
        )}
        <div className="actions">
          <button disabled={busy}>{ui("Zapisz trening")}</button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => navigate("Historia")}
          >
            {ui("Anuluj")}{" "}
          </button>
          {editingExisting && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={removeSession}
            >
              {ui("Usuń trening")}{" "}
            </button>
          )}
        </div>
      </form>
    </>
  );
}
