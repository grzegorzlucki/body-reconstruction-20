import { day, type Session, type PainLog } from "../domain";
export type CalendarRecords = { sessions: Session[]; logs: PainLog[] };
export function calendarData(sessions: Session[], logs: PainLog[]) {
  const result = new Map<string, CalendarRecords>();
  function bucket(date: string) {
    if (!result.has(date)) result.set(date, { sessions: [], logs: [] });
    return result.get(date)!;
  }
  for (const session of sessions)
    bucket(day(session.started)).sessions.push(session);
  for (const log of logs) bucket(log.date).logs.push(log);
  for (const records of result.values()) {
    records.sessions.sort(
      (a, b) => Date.parse(a.started) - Date.parse(b.started),
    );
    records.logs.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }
  return result;
}
