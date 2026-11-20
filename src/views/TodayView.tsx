import { useTranslation } from "react-i18next";
import { ui } from "../i18n/config";
import {
  completedGroups,
  visibleSets,
  type Injury,
  type PainLog,
  type RehabSite,
  type Session,
} from "../domain";
import { TodayDashboard } from "../today/TodayDashboard";

export function TodayView({
  active,
  sessions,
  logs,
  today,
  sites,
  injuries,
  weeklyGoal,
  profileName,
  busy,
  onFinish,
  onWorkout,
  onDiary,
  onAnalytics,
}: {
  active?: Session;
  sessions: Session[];
  logs: PainLog[];
  today?: PainLog;
  hours: number;
  sites: RehabSite[];
  injuries: Injury[];
  weeklyGoal: number;
  profileName?: string;
  busy: boolean;
  onFinish: () => void;
  onWorkout: () => void;
  onDiary: () => void;
  onAnalytics: (sessionId?: string) => void;
}) {
  useTranslation();
  return (
    <>
      <section className="heading today-heading">
        <p className="eyebrow">{ui("Dzisiaj")}</p>
        <h1>
          {profileName?.trim()
            ? ui("Cześć, {{v0}}!", { v0: profileName.trim() })
            : ui("Cześć!")}
        </h1>
        <p>{ui("Twoja aktywność i samopoczucie w jednym miejscu.")}</p>
      </section>
      {active && (
        <section className="hero today-hero today-active-workout">
          <div>
            <span className="pill">{ui("TRWAJĄCY TRENING")}</span>
            <h2>{active.planName || ui("Trening")}</h2>
            <p>
              {ui("Kontynuuj zapis serii od miejsca, w którym skończyłeś.")}
            </p>
            <p className="workout-progress">
              {ui("Wykonane serie: {{v0}} / {{v1}}", {
                v0: completedGroups(active),
                v1: visibleSets(active).length,
              })}
            </p>
            <div className="actions">
              <button
                type="button"
                className="light"
                disabled={busy}
                onClick={onWorkout}
              >
                {ui("Wznów trening")}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={onFinish}
              >
                {ui("Zakończ trening")}
              </button>
            </div>
            <p>
              {ui(
                "Możesz zakończyć trening także z mniejszą liczbą wykonanych serii.",
              )}
            </p>
          </div>
        </section>
      )}
      <TodayDashboard
        sessions={sessions}
        logs={logs}
        sites={sites}
        injuries={injuries}
        weeklyGoal={weeklyGoal}
        onAnalytics={onAnalytics}
        onDiary={onDiary}
      >
        <div className="today-primary-grid today-quick-actions">
          <section className="panel today-hero today-workout-action">
            <div>
              <h2>{active ? ui("Kontynuuj trening") : ui("Czas na ruch?")}</h2>
              <p>
                {active
                  ? ui("Wróć do rozpoczętej sesji.")
                  : ui("Wybierz zapisany trening i zacznij, kiedy chcesz.")}
              </p>
              <button type="button" disabled={busy} onClick={onWorkout}>
                {ui("Przejdź do treningu")}
              </button>
            </div>
          </section>
          <section
            className="panel today-diary-action"
            aria-label={ui("Dzisiejszy pomiar bólu")}
          >
            <div>
              <h2>
                {today
                  ? ui("Dzisiejszy pomiar zapisany")
                  : ui("Jak się dziś czujesz?")}
              </h2>
              <p>
                {today
                  ? ui("Przejrzyj zapisane oceny lub dodaj kolejny pomiar.")
                  : ui("Oceń ból w monitorowanych obszarach.")}
              </p>
            </div>
            <button type="button" className="secondary" onClick={onDiary}>
              {today ? ui("Zobacz pomiar bólu") : ui("Zapisz pomiar bólu")}
            </button>
          </section>
        </div>
      </TodayDashboard>
    </>
  );
}
