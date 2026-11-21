import type { PainLog, Session } from "../domain";

const HOUR = 3600000;
export type MatchedMeasurement = {
  log: PainLog;
  value: number;
  source: "confirmed" | "candidate";
  elapsedHours: number;
  interveningSession: boolean;
};
export type SessionResponse = Record<
  "pre" | "post" | "h24" | "h48",
  MatchedMeasurement | null
>;

/** Time windows organize observations. They are not clinical thresholds. */
export function matchSessionMeasurements(
  session: Session,
  logs: PainLog[],
  sessions: Session[],
  siteId: string,
  context?: string,
): SessionResponse {
  const start = Date.parse(session.started),
    end = session.ended ? Date.parse(session.ended) : null;
  const eligible = logs.filter(
    (log) =>
      (!session.profileId || log.profileId === session.profileId) &&
      (!log.sessionId || log.sessionId === session.id) &&
      (context === undefined || log.context === context) &&
      log.values.some((value) => value.siteId === siteId),
  );
  const select = (
    phase: "pre" | "post" | "h24" | "h48",
  ): MatchedMeasurement | null => {
    if (phase !== "pre" && end === null) return null;
    const origin = phase === "pre" ? start : end!;
    const candidates = eligible.filter((log) => {
      const hours = (Date.parse(log.at) - origin) / HOUR;
      if (phase === "pre")
        return (
          hours >= -24 &&
          hours <= 0 &&
          ["pre", "daily", "unspecified"].includes(
            log.measurementPhase ?? "unspecified",
          )
        );
      if (phase === "post")
        return (
          log.sessionId === session.id &&
          log.measurementPhase === "post" &&
          hours >= 0
        );
      return (
        hours >= (phase === "h24" ? 18 : 42) &&
        hours <= (phase === "h24" ? 30 : 54) &&
        !["pre", "during", "post"].includes(
          log.measurementPhase ?? "unspecified",
        )
      );
    });
    const target =
      origin + (phase === "h24" ? 24 : phase === "h48" ? 48 : 0) * HOUR;
    candidates.sort(
      (a, b) =>
        Number(b.sessionId === session.id) -
          Number(a.sessionId === session.id) ||
        Math.abs(Date.parse(a.at) - target) -
          Math.abs(Date.parse(b.at) - target) ||
        a.id.localeCompare(b.id),
    );
    const log = candidates[0];
    if (!log) return null;
    const lower = phase === "pre" ? Date.parse(log.at) : origin;
    const upper = phase === "pre" ? start : Date.parse(log.at);
    const interveningSession = sessions.some(
      (other) =>
        other.id !== session.id &&
        (!session.profileId || other.profileId === session.profileId) &&
        (other.activityType === "external" || other.sets.some((row) => row.done && row.reps > 0)) &&
        Date.parse(other.started) <= upper &&
        (other.ended ? Date.parse(other.ended) : upper) > lower,
    );
    return {
      log,
      value: log.values.find((value) => value.siteId === siteId)!.value,
      source: log.sessionId === session.id ? "confirmed" : "candidate",
      elapsedHours: (Date.parse(log.at) - origin) / HOUR,
      interveningSession,
    };
  };
  return {
    pre: select("pre"),
    post: select("post"),
    h24: select("h24"),
    h48: select("h48"),
  };
}
