import { day, type PainLog, type Session } from "../domain";

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** One value per day AND area; days with more reports do not carry more weight. */
export function dailyMeasurements(logs: PainLog[]): PainLog[] {
  const dates = new Map<
    string,
    { log: PainLog; values: Map<string, number[]> }
  >();
  for (const log of logs) {
    let date = dates.get(log.date);
    if (!date) {
      date = { log, values: new Map() };
      dates.set(log.date, date);
    }
    for (const { siteId, value } of log.values) {
      const values = date.values.get(siteId) ?? [];
      values.push(value);
      date.values.set(siteId, values);
    }
  }
  return [...dates]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => ({
      ...row.log,
      id: `daily:${date}`,
      date,
      at: new Date(`${date}T12:00:00`).toISOString(),
      values: [...row.values].map(([siteId, values]) => ({
        siteId,
        value: median(values)!,
      })),
    }));
}

export function sessionDose(session: Session, exerciseId = "") {
  const rows = session.sets.filter(
    (row) => !exerciseId || row.exerciseId === exerciseId,
  );
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.exerciseId}/${row.index}`,
      group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const performed = rows.filter((row) => row.done && row.reps > 0);
  const completed = [...groups.values()].filter((group) =>
    group.every((row) => row.done && row.reps > 0),
  ).length;
  return {
    completed,
    planned: groups.size,
    performedRows: performed.length,
    repetitions: performed.reduce((sum, row) => sum + row.reps, 0),
    // Volume is only exposed for an explicitly selected exercise.
    volume: exerciseId
      ? performed.reduce((sum, row) => sum + row.weight * row.reps, 0)
      : null,
    status: !session.ended
      ? "W toku"
      : !performed.length
        ? "Pusty"
        : completed < groups.size
          ? "Częściowy"
          : "Pełny",
    durationMinutes: session.ended
      ? (Date.parse(session.ended) - Date.parse(session.started)) / 60000
      : null,
  };
}

export function validateMeasurementLink(log: PainLog, sessions: Session[]) {
  if (!log.sessionId) return;
  const session = sessions.find(
    (row) => row.id === log.sessionId && row.profileId === log.profileId,
  );
  if (!session)
    throw Error(
      "Wybrany trening nie należy do tego profilu lub już nie istnieje.",
    );
  const at = Date.parse(log.at),
    start = Date.parse(session.started),
    end = session.ended ? Date.parse(session.ended) : null;
  if (
    (log.measurementPhase === "pre" && at > start) ||
    (log.measurementPhase === "during" &&
      (at < start || (end !== null && at > end))) ||
    ((log.measurementPhase === "post" || log.measurementPhase === "followup") &&
      (end === null || at < end))
  )
    throw Error(
      "Godzina pomiaru nie pasuje do wybranej fazy treningu. Popraw godzinę, fazę lub powiązanie.",
    );
}

export function remapMeasurementSessions(
  logs: PainLog[],
  ids: Map<string, string>,
): PainLog[] {
  return logs.map((log) => ({
    ...log,
    sessionId: log.sessionId ? ids.get(log.sessionId) : undefined,
  }));
}

export function weeklyDose(sessions: Session[], exerciseId = "") {
  const weeks = new Map<
    string,
    { week: string; sets: number; repetitions: number; sessions: number }
  >();
  for (const session of sessions) {
    const monday = new Date(session.started);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const key = day(monday),
      dose = sessionDose(session, exerciseId);
    const row = weeks.get(key) ?? {
      week: key,
      sets: 0,
      repetitions: 0,
      sessions: 0,
    };
    row.sets += dose.completed;
    row.repetitions += dose.repetitions;
    if (dose.performedRows > 0) row.sessions++;
    weeks.set(key, row);
  }
  return [...weeks.values()].sort((a, b) => b.week.localeCompare(a.week));
}
