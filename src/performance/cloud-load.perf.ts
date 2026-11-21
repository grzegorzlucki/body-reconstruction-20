// Local HTTP fixture, NOT a PostgreSQL/Supabase capacity benchmark.
import { afterAll, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const context = vi.hoisted(() => ({
  current: null as AsyncLocalStorage<any> | null,
}));
vi.mock("../supabase", () => ({
  supabase: new Proxy(
    {},
    { get: (_target, key) => context.current!.getStore().client[key] },
  ),
}));
import { cloudDb, saveCloudSessionSets } from "../cloudDb";
import { newSession } from "../domain";
import { readProfileRecords } from "../app/profileRepository";
import { clearResourceCache } from "../app/resourceCache";

context.current = new AsyncLocalStorage();
let requests = 0,
  bytes = 0,
  uploadBytes = 0,
  active = 0,
  peak = 0,
  delay = 5,
  fail = false;
let size = { sessions: 12, logs: 30, sets: 18 };
const tables: Record<string, number> = {};
function rows(table: string, user: string): any[] {
  const exercise = {
    exercise_id: "calf",
    position: 0,
    planned_sets: 3,
    planned_weight: 5,
    planned_reps: 8,
    set_count: 3,
    weight: 5,
    reps: 8,
    note: "",
    exercise_name: "Synthetic exercise",
    unilateral: false,
  };
  const at = "2026-11-20T08:00:00+00:00";
  switch (table) {
    case "profiles":
      return [
        {
          id: user,
          owner_user_id: user,
          name: "Synthetic user",
          weekly_goal: 2,
          check_in_time: "08:00",
          preferred_language: "pl",
        },
      ];
    case "profile_rehab_sites":
      return [
        {
          profile_id: user,
          id: "achilles",
          name: "Synthetic area",
          body_area: "Synthetic",
          position: 0,
          active: true,
          archived: false,
        },
      ];
    case "workout_templates":
      return [
        { id: `${user}:template`, profile_id: user, name: "Synthetic plan" },
      ];
    case "template_exercises":
      return [{ ...exercise, template_id: `${user}:template` }];
    case "workout_sessions":
      return Array.from({ length: size.sessions }, (_, i) => ({
        id: `${user}:s${i}`,
        profile_id: user,
        started_at: at,
        ended_at: at,
        note: "",
        exercise_progress: [],
      }));
    case "session_exercises":
      return Array.from({ length: size.sessions }, (_, i) => ({
        ...exercise,
        session_id: `${user}:s${i}`,
      }));
    case "session_sets":
      return Array.from({ length: size.sessions * size.sets }, (_, i) => ({
        session_id: `${user}:s${Math.floor(i / size.sets)}`,
        exercise_id: `synthetic${Math.floor((i % size.sets) / 3)}`,
        side: "both",
        set_index: i % 3,
        weight: 5,
        reps: 8,
        done: true,
      }));
    case "pain_logs":
      return Array.from({ length: size.logs }, (_, i) => ({
        id: `${user}:l${i}`,
        profile_id: user,
        log_date: "2026-11-20",
        measured_at: at,
        context: "",
        note: "",
      }));
    case "pain_log_values":
      return Array.from({ length: size.logs * 3 }, (_, i) => ({
        pain_log_id: `${user}:l${Math.floor(i / 3)}`,
        site_id: `area${i % 3}`,
        value: i % 11,
      }));
    default:
      return [];
  }
}
const server = createServer(async (req, res) => {
  active++;
  peak = Math.max(peak, active);
  requests++;
  const url = new URL(req.url!, "http://localhost");
  const user = String(req.headers.authorization).replace("Bearer ", "");
  const table = url.pathname.split("/").at(-1)!;
  tables[table] = (tables[table] ?? 0) + 1;
  let result: any = rows(table, user);
  for (const [field, filter] of url.searchParams) {
    if (filter.startsWith("eq."))
      result = result.filter(
        (row: any) => String(row[field]) === filter.slice(3),
      );
    if (filter.startsWith("in.(")) {
      const ids = filter.slice(4, -1).split(",");
      result = result.filter((row: any) => ids.includes(String(row[field])));
    }
  }
  result = result.slice(
    Number(url.searchParams.get("offset") ?? 0),
    Number(url.searchParams.get("offset") ?? 0) +
      Number(url.searchParams.get("limit") ?? 500),
  );
  if (url.pathname === "/auth/v1/user") result = { id: user };
  if (req.method === "POST") {
    let payload = "";
    for await (const chunk of req) {
      uploadBytes += chunk.length;
      payload += chunk.toString();
    }
    result = null;
  }
  if (table === "read_record_page_v1") {
    const params = Object.fromEntries(url.searchParams);
    if (params.before_id === "null") delete params.before_id;
    const session = params.resource === "sessions";
    const parent = rows(session ? "workout_sessions" : "pain_logs", user).sort(
      (a, b) => (a.id < b.id ? 1 : -1),
    );
    const page = parent
      .filter((row) => !params.before_id || row.id < params.before_id)
      .slice(0, Number(params.page_size));
    const first = rows(session ? "session_exercises" : "pain_log_values", user);
    const second = rows(session ? "session_sets" : "pain_log_injuries", user);
    const key = session ? "session_id" : "pain_log_id";
    const group = (items: any[]) => {
      const map = new Map<string, any[]>();
      for (const item of items) {
        const list = map.get(item[key]) ?? [];
        list.push(item);
        map.set(item[key], list);
      }
      return map;
    };
    const firstById = group(first),
      secondById = group(second);
    result = {
      items: page.map((row) => ({
        ...row,
        [session ? "plans" : "values"]: firstById.get(row.id) ?? [],
        [session ? "sets" : "injuries"]: secondById.get(row.id) ?? [],
      })),
    };
  }
  await new Promise((resolve) => setTimeout(resolve, delay));
  const unavailable = fail && url.pathname.startsWith("/rest/");
  const body = JSON.stringify(
    unavailable
      ? { message: "Synthetic service unavailable", code: "503" }
      : result,
  );
  bytes += Buffer.byteLength(body);
  res.writeHead(unavailable ? 503 : 200, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(body);
  active--;
});
const listening = new Promise<string>((resolve) =>
  server.listen(0, "127.0.0.1", () =>
    resolve(`http://127.0.0.1:${(server.address() as any).port}`),
  ),
);
afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
);
const percentile = (values: number[], fraction: number) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];

it("measures actual cloud adapter HTTP fan-out at 5/25/100/125 simultaneous clients", async () => {
  const base = await listening;
  const results: any[] = [];
  async function run(
    users: number,
    rounds: number,
    label: string,
    write = false,
  ) {
    clearResourceCache();
    requests = 0;
    bytes = 0;
    uploadBytes = 0;
    peak = 0;
    for (const key of Object.keys(tables)) delete tables[key];
    const times: number[] = [],
      errors: string[] = [];
    const started = performance.now();
    await Promise.all(
      Array.from({ length: users }, async (_, index) => {
        const user = `synthetic-user-${index}`;
        const client = createClient(base, "publishable-fixture-only", {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${user}` } },
        });
        client.auth.getUser = async () =>
          ({
            data: {
              user: await (
                await fetch(base + "/auth/v1/user", {
                  headers: { Authorization: `Bearer ${user}` },
                })
              ).json(),
            },
            error: null,
          }) as any;
        await context.current!.run({ client }, async () => {
          for (let round = 0; round < rounds; round++) {
            const start = performance.now();
            try {
              if (write) {
                const session = {
                  ...newSession({}, new Date().toISOString()),
                  profileId: user,
                };
                await saveCloudSessionSets(session, [
                  { ...session.sets[0], done: true },
                ]);
                await cloudDb.logs.put({
                  id: `${user}-report-${round}`,
                  profileId: user,
                  date: "2026-11-20",
                  at: "2026-11-20T10:00:00Z",
                  context: "",
                  note: "Synthetic only",
                  values: [{ siteId: "achilles", value: 2 }],
                });
                times.push(performance.now() - start);
                continue;
              }
              const profiles = await cloudDb.profiles.toArray();
              expect(profiles[0].id).toBe(user);
              const records = await readProfileRecords(cloudDb, user);
              expect(records.sessions).toHaveLength(size.sessions);
              expect(records.logs).toHaveLength(size.logs);
              expect(
                records.sessions.every((s) => s.id.startsWith(user + ":")),
              ).toBe(true);
              expect(
                records.sessions.reduce((sum, s) => sum + s.sets.length, 0),
              ).toBe(size.sessions * size.sets);
              expect(
                records.logs.reduce((sum, log) => sum + log.values.length, 0),
              ).toBe(size.logs * 3);
            } catch (error) {
              errors.push(
                error instanceof Error ? error.message : String(error),
              );
            }
            times.push(performance.now() - start);
          }
        });
      }),
    );
    const result = {
      label,
      users,
      rounds,
      fixture: { ...size },
      delayMs: delay,
      operations: times.length,
      requests,
      requestsPerOperation: requests / times.length,
      bytes,
      bytesPerOperation: Math.round(bytes / times.length),
      uploadBytes,
      peakHTTP: peak,
      wallMs: Math.round(performance.now() - started),
      p50Ms: Math.round(percentile(times, 0.5)),
      p95Ms: Math.round(percentile(times, 0.95)),
      p99Ms: Math.round(percentile(times, 0.99)),
      errors: errors.length,
      sampleError: errors[0],
      tables: { ...tables },
    };
    results.push(result);
    mkdirSync("test-results/performance", { recursive: true });
    writeFileSync(
      "test-results/performance/in-progress.json",
      JSON.stringify(results, null, 2),
    );
    return result;
  }
  for (const users of [5, 25, 100, 125])
    expect((await run(users, 2, "small-history")).errors).toBe(0);
  const repeated = await run(125, 20, "repeated-refresh-stress");
  expect(repeated.errors).toBe(0);
  expect(repeated.requestsPerOperation).toBeLessThan(2);
  size = { sessions: 150, logs: 600, sets: 36 };
  for (const users of [5, 125])
    expect((await run(users, 1, "large-history")).errors).toBe(0);
  size = { sessions: 12, logs: 30, sets: 18 };
  delay = 80;
  expect((await run(125, 1, "slow-network")).errors).toBe(0);
  delay = 5;
  const writes = await run(125, 10, "targeted-set-and-diary-writes", true);
  expect(writes.errors).toBe(0);
  expect(writes.requestsPerOperation).toBe(2);
  fail = true;
  delay = 5;
  expect((await run(5, 1, "503-propagation")).errors).toBe(5);
  fail = false;
  mkdirSync("test-results/performance", { recursive: true });
  writeFileSync(
    "test-results/performance/cloud-load.json",
    JSON.stringify(
      {
        kind: "local-http-fixture-not-database-capacity",
        generatedAt: new Date().toISOString(),
        node: process.version,
        results,
      },
      null,
      2,
    ),
  );
  console.table(
    results.map(({ tables, sampleError, fixture, ...result }) => result),
  );
}, 180000);
