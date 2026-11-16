import { useEffect, useRef, useState } from "react";
import { searchForTab, tabFromSearch, type Tab } from "./navigation";

function focusContent() {
  window.requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    document.getElementById("main-content")?.focus({ preventScroll: true });
  });
}

export function useNavigation(canLeave: (next: Tab) => Promise<boolean>) {
  const [tab, setTab] = useState<Tab>(() => tabFromSearch(window.location.search));
  const current = useRef(tab);
  const guard = useRef(canLeave);
  const pending = useRef(0);
  guard.current = canLeave;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "session-editor") {
      window.history.replaceState(null, "", window.location.pathname +
        searchForTab(window.location.search, "Historia") + window.location.hash);
    }
    const onBack = async () => {
      const next = tabFromSearch(window.location.search);
      if (next === current.current) return;
      const attempt = ++pending.current;
      if (!await guard.current(next)) {
        if (attempt !== pending.current) return;
        window.history.pushState(null, "", window.location.pathname +
          searchForTab(window.location.search, current.current) + window.location.hash);
        return;
      }
      if (attempt !== pending.current) return;
      current.current = next;
      if (new URLSearchParams(window.location.search).get("view") === "session-editor") {
        window.history.replaceState(null, "", window.location.pathname +
          searchForTab(window.location.search, next) + window.location.hash);
      }
      setTab(next);
      focusContent();
    };
    window.addEventListener("popstate", onBack);
    return () => {
      pending.current++;
      window.removeEventListener("popstate", onBack);
    };
  }, []);

  async function navigate(next: Tab, options: { replace?: boolean; force?: boolean } = {}): Promise<boolean> {
    if (next === current.current) return true;
    const attempt = ++pending.current;
    if (!options.force && !await guard.current(next)) return false;
    if (attempt !== pending.current) return false;
    const url = window.location.pathname + searchForTab(window.location.search, next) + window.location.hash;
    if (options.replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    current.current = next;
    setTab(next);
    focusContent();
    return true;
  }

  return { tab, navigate };
}
