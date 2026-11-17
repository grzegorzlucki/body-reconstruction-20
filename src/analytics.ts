import { day, type PainContext, type PainLog, type RehabSite, type Session } from "./domain";

export type AnalyticsSummary = {
  start: string;
  end: string;
  previousStart: string;
  logs: PainLog[];
  previousLogs: PainLog[];
  completedSessions: number;
  diaryDays: number;
  siteStats: Array<{ site: RehabSite; average: number | null; previousAverage: number | null; last: number | null; count: number }>;
  contexts: Array<{ context: PainContext | undefined; count: number }>;
};

export function summarizeAnalytics(logs: PainLog[], sessions: Session[], sites: RehabSite[], contexts: PainContext[], days = 30, now = new Date()): AnalyticsSummary {
  const end = day(now);
  const currentStart = new Date(now);
  currentStart.setHours(0, 0, 0, 0);
  currentStart.setDate(currentStart.getDate() - days + 1);
  const start = day(currentStart);
  const previousStartDate = new Date(currentStart);
  previousStartDate.setDate(previousStartDate.getDate() - days);
  const previousStart = day(previousStartDate);
  const previousEndDate = new Date(currentStart);
  previousEndDate.setDate(previousEndDate.getDate() - 1);
  const previousEnd = day(previousEndDate);
  const currentLogs = logs.filter((log) => log.date >= start && log.date <= end);
  const previousLogs = logs.filter((log) => log.date >= previousStart && log.date <= previousEnd);
  const average = (rows: PainLog[], siteId: string) => {
    const values = rows.flatMap((log) => log.values.filter((value) => value.siteId === siteId).map((value) => value.value));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const siteStats = sites.map((site) => {
    const values = currentLogs.flatMap((log) => log.values.filter((value) => value.siteId === site.id).map((value) => ({ value: value.value, at: log.at })));
    const latest = values.reduce<{ value: number; at: string } | null>((best, item) => !best || item.at > best.at ? item : best, null);
    return { site, average: average(currentLogs, site.id), previousAverage: average(previousLogs, site.id),
      last: latest?.value ?? null, count: values.length };
  }).filter((stat) => stat.count || stat.previousAverage !== null);
  const contextCounts = new Map<string, number>();
  for (const log of currentLogs) if (log.context) contextCounts.set(log.context, (contextCounts.get(log.context) ?? 0) + 1);
  const contextsSummary = [...contextCounts].map(([value, count]) => ({ context: contexts.find((item) => item.value === value), count }))
    .sort((a, b) => b.count - a.count);
  const completedSessions = sessions.filter((session) => session.ended && day(session.ended) >= start && day(session.ended) <= end).length;
  return { start, end, previousStart, logs: currentLogs, previousLogs, completedSessions,
    diaryDays: new Set(currentLogs.map((log) => log.date)).size, siteStats, contexts: contextsSummary };
}

export function filterLogsByInjury(logs: PainLog[], injuryId: string) {
  if (!injuryId) return logs;
  return logs.filter((log) => log.injuryIds?.includes(injuryId));
}
