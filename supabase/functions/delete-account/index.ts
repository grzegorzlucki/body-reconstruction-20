import { createClient } from "npm:@supabase/supabase-js@2";

// Deploy only after the SQL migration and APP_ORIGIN configuration.
Deno.serve(async (request: Request) => {
  const origin = Deno.env.get("APP_ORIGIN");
  const cors = { "Access-Control-Allow-Origin": origin ?? "", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  const response = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (!origin || request.headers.get("origin") !== origin) return response(403, { error: "Origin denied" });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return response(405, { error: "Method not allowed" });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return response(401, { error: "Authentication required" });
    const { data: { user }, error } = await auth.auth.getUser(token);
    if (error || !user?.email) return response(401, { error: "Authentication required" });
    // Password reauthentication alone must not bypass a configured MFA factor.
    if (user.factors?.some((factor) => factor.status === "verified"))
      return response(403, { error: "MFA-enabled deletion requires an MFA-aware account flow" });
    const body = await request.json();
    if (body.confirmation !== "USUŃ KONTO" || typeof body.password !== "string" || body.password.length > 1024)
      return response(400, { error: "Confirmation required" });
    const verified = await auth.auth.signInWithPassword({ email: user.email, password: body.password });
    if (verified.error || verified.data.user?.id !== user.id) return response(403, { error: "Reauthentication failed" });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    // All avatar files are stored directly under the verified user's folder.
    for (let batch = 0; batch < 1000; batch++) {
      const files = await admin.storage.from("avatars").list(user.id, { limit: 100 });
      if (files.error) throw files.error;
      if (!files.data.length) break;
      if (batch === 999 || files.data.some((file) => !file.id)) throw Error("Avatar cleanup requires administrator assistance");
      const removed = await admin.storage.from("avatars").remove(files.data.map((file) => `${user.id}/${file.name}`));
      if (removed.error) throw removed.error;
    }
    const cleanup = await admin.rpc("delete_account_records", { account_user_id: user.id });
    if (cleanup.error) throw cleanup.error;
    const deleted = await admin.auth.admin.deleteUser(user.id);
    if (deleted.error) throw deleted.error;
    return response(200, { deleted: true });
  } catch {
    // Never log credentials or return privileged database errors.
    return response(500, { error: "Could not complete deletion; retry is safe" });
  }
});
