import { day, type PainLog, type Session } from "../domain";
import { dailyMeasurements, sessionDose } from "./metrics";

export type TrainingMetric = "sessions" | "sets" | "minutes";

/** Calendar-day buckets; absent pain is null, genuine zero is retained. */
export function overlayData(
  from: string,
  to: string,
  logs: PainLog[],
  sessions: Session[],
  exercise = "",
) {
  const pain = new Map(
    dailyMeasurements(logs).map((log) => [log.date, log.values]),
  );
  const training = new Map<string, Record<TrainingMetric, number>>();
  for (const session of sessions) {
    const dose = sessionDose(session, exercise);
    if (!dose.performed) continue;
    const date = day(session.started);
    const bucket = training.get(date) ?? { sessions: 0, sets: 0, minutes: 0 };
    bucket.sessions++;
    bucket.sets += dose.completed;
    bucket.minutes += Math.max(0, dose.durationMinutes ?? 0);
    training.set(date, bucket);
  }
  const result = [];
  const cursor = new Date(`${from}T12:00:00`);
  // Same bounded calendar range as PeriodExplorer; no UTC/DST day arithmetic.
  while (
    Number.isFinite(cursor.getTime()) &&
    day(cursor) <= to &&
    result.length < 366
  ) {
    const date = day(cursor);
    result.push({
      date,
      pain: pain.get(date) ?? [],
      training: training.get(date) ?? { sessions: 0, sets: 0, minutes: 0 },
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
