import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export function ProfileAvatar({ name, path }: { name: string; path?: string | null }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let disposed = false;
    setUrl("");
    async function load() {
      if (!path || !supabase) return;
      const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, 1800);
      if (!disposed && !error) setUrl(data?.signedUrl ?? "");
    }
    void load().catch(() => {});
    const timer = window.setInterval(() => void load().catch(() => {}), 1500000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [path]);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join("").toLocaleUpperCase() || "?";
  return <span className="profile-avatar" aria-hidden="true">{url
    ? <img src={url} alt="" width="48" height="48" onError={() => setUrl("")} /> : initials}</span>;
}
