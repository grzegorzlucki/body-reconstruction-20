export const tabs = ["Dzisiaj", "Trening", "Dziennik", "Kalendarz", "Historia", "Analizy", "Plany", "Zegar HSR", "Dane", "Ustawienia"] as const;
export type MainTab = typeof tabs[number];
export type Tab = MainTab | "Edytor treningu";

const slugs: Record<Tab, string> = {
  Dzisiaj: "today", Trening: "workout", Dziennik: "diary",
  Kalendarz: "calendar", Historia: "history", Analizy: "analytics", Plany: "plans",
  "Zegar HSR": "timer", Dane: "data", Ustawienia: "settings", "Edytor treningu": "session-editor",
};

export function tabFromSearch(search: string): Tab {
  const slug = new URLSearchParams(search).get("view");
  // An editor needs in-memory draft state; a direct link opens history instead.
  if (slug === "session-editor") return "Historia";
  return (Object.keys(slugs) as Tab[]).find((tab) => slugs[tab] === slug) ?? "Dzisiaj";
}

export function searchForTab(search: string, tab: Tab): string {
  const params = new URLSearchParams(search);
  if (tab === "Dzisiaj") params.delete("view");
  else params.set("view", slugs[tab]);
  const result = params.toString();
  return result ? `?${result}` : "";
}
