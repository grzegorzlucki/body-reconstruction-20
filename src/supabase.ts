import { createClient } from "@supabase/supabase-js";
import { createApiFetch } from "./app/apiTransport";
import { clearResourceCache } from "./app/resourceCache";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && key
  ? createClient(url, key, { global: { fetch: createApiFetch() }, auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

let cacheUser: string | undefined;
supabase?.auth.onAuthStateChange((_event, session) => {
  if (session?.user.id !== cacheUser) { cacheUser = session?.user.id; clearResourceCache(); }
});
