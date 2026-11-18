import { useEffect, useState } from "react";
import { day } from "../domain";

export const analyticsViews = [
  "overview",
  "timeline",
  "response",
  "dose",
  "areas",
] as const;
export type AnalyticsFilters = {
  screen: (typeof analyticsViews)[number];
  from: string;
  to: string;
  site: string;
  injury: string;
  context: string;
  phase: string;
  plan: string;
  exercise: string;
  session: string;
};
const validDate = (value: string | null) =>
  value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value
    ? value
    : null;
function readFilters(): AnalyticsFilters {
  const params = new URLSearchParams(window.location.search),
    start = new Date();
  start.setDate(start.getDate() - 29);
  const screen = params.get("analysis");
  return {
    screen: analyticsViews.includes(screen as AnalyticsFilters["screen"])
      ? (screen as AnalyticsFilters["screen"])
      : "overview",
    from: validDate(params.get("from")) ?? day(start),
    to: validDate(params.get("to")) ?? day(new Date()),
    site: params.get("area") ?? "",
    injury: params.get("injury") ?? "",
    context: params.get("context") ?? "*",
    phase: params.get("phase") ?? "",
    plan: params.get("plan") ?? "",
    exercise: params.get("exercise") ?? "",
    session: params.get("session") ?? "",
  };
}
export function useAnalyticsNavigation() {
  const [filters, setFilters] = useState(readFilters);
  useEffect(() => {
    const onPop = () => setFilters(readFilters());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  function update(changes: Partial<AnalyticsFilters>) {
    const next = { ...filters, ...changes },
      url = new URL(window.location.href);
    const names: Record<keyof AnalyticsFilters, string> = {
      screen: "analysis",
      from: "from",
      to: "to",
      site: "area",
      injury: "injury",
      context: "context",
      phase: "phase",
      plan: "plan",
      exercise: "exercise",
      session: "session",
    };
    for (const key of Object.keys(names) as (keyof AnalyticsFilters)[]) {
      if (next[key]) url.searchParams.set(names[key], next[key]);
      else url.searchParams.delete(names[key]);
    }
    window.history.pushState(null, "", url);
    setFilters(next);
  }
  return { filters, update };
}
