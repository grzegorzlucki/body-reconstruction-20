import { day, type PainLog, type Session } from "../domain";
import { dailyMeasurements, sessionDose } from "../analytics/metrics";

export function dashboardData(
  sessions: Session[],
  logs: PainLog[],
  now = new Date(),
) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - 6 + index);
    return day(date);
  });
  const start = days[0],
    end = days[6];
  const reports = logs.filter(
    (log) =>
      log.date >= start &&
      log.date <= end &&
      Date.parse(log.at) <= now.getTime(),
  );
  const completed = sessions.filter(
    (session) =>
      session.ended &&
      Date.parse(session.ended) <= now.getTime() &&
      sessionDose(session).performed,
  );
  const recent = completed.filter(
    (session) => day(session.started) >= start && day(session.started) <= end,
  );
  const daily = dailyMeasurements(reports);
  const last = [...completed].sort(
    (a, b) => Date.parse(b.ended!) - Date.parse(a.ended!),
  )[0];
  return {
    days,
    reports,
    recent,
    goalSessions: recent.filter(session => session.activityType !== "external" || !!session.templateId),
    strengthSessions: recent.filter(session => session.activityType !== "external").length,
    externalSessions: recent.filter(session => session.activityType === "external").length,
    last,
    daily,
    diaryDays: new Set(reports.map((log) => log.date)).size,
    sets: days.map((date) =>
      recent
        .filter((session) => day(session.started) === date)
        .reduce((sum, session) => sum + sessionDose(session).completed, 0),
    ),
  };
}
