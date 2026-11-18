export const tabs = ["Dzisiaj", "Trening", "Dziennik", "Kalendarz", "Historia", "Analizy", "Plany", "Zegar HSR", "Dane", "Ustawienia", "Profil", "Bezpieczeństwo", "Preferencje", "Aplikacja"] as const;
export type MainTab = typeof tabs[number];
export type Tab = MainTab | "Edytor treningu";

const slugs: Record<Tab, string> = {
  Dzisiaj: "today", Trening: "workout", Dziennik: "diary",
  Kalendarz: "calendar", Historia: "history", Analizy: "analytics", Plany: "plans",
  "Zegar HSR": "timer", Dane: "data", Ustawienia: "settings", "Edytor treningu": "session-editor",
  Profil: "profile", Bezpieczeństwo: "security", Preferencje: "preferences", Aplikacja: "application",
};

export const profileSections = [
  { tab: "Profil", section: "personal", label: "Mój profil" },
  { tab: "Ustawienia", section: "rehabilitation", label: "Rehabilitacja" },
  { tab: "Bezpieczeństwo", section: "security", label: "Bezpieczeństwo" },
  { tab: "Preferencje", section: "preferences", label: "Preferencje" },
  { tab: "Dane", section: "data", label: "Moje dane" },
  { tab: "Aplikacja", section: "application", label: "Aplikacja" },
] as const;
export const isProfileTab = (tab: Tab) => profileSections.some((item) => item.tab === tab);

export function tabFromSearch(search: string): Tab {
  const params = new URLSearchParams(search);
  const slug = params.get("view");
  if (slug === "profile") return profileSections.find((item) => item.section === params.get("section"))?.tab ?? "Profil";
  // An editor needs in-memory draft state; a direct link opens history instead.
  if (slug === "session-editor") return "Historia";
  return (Object.keys(slugs) as Tab[]).find((tab) => slugs[tab] === slug) ?? "Dzisiaj";
}

export function searchForTab(search: string, tab: Tab): string {
  const params = new URLSearchParams(search);
  const profile = profileSections.find((item) => item.tab === tab);
  if (profile) {
    params.set("view", "profile"); params.set("section", profile.section);
    return `?${params.toString()}`;
  }
  params.delete("section");
  if (tab === "Dzisiaj") params.delete("view");
  else params.set("view", slugs[tab]);
  const result = params.toString();
  return result ? `?${result}` : "";
}
