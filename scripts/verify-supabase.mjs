import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

// Local-only PostgreSQL. Auth/Storage interfaces are fixtures, not real services.
const pg = await PGlite.create();
let assertions = 0;
const check = (value, expected) => {
  assert.deepEqual(value, expected);
  assertions++;
};
async function rejected(sql, params = []) {
  await assert.rejects(pg.query(sql, params));
  assertions++;
}
const a = "10000000-0000-4000-8000-000000000001",
  b = "20000000-0000-4000-8000-000000000002";
const templateA = "30000000-0000-4000-8000-000000000001",
  templateB = "30000000-0000-4000-8000-000000000002";
const sessionId = "40000000-0000-4000-8000-000000000001";
async function identity(id) {
  await pg.exec("RESET ROLE");
  await pg.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await pg.exec("SET ROLE authenticated");
}
async function rpc(name, payload) {
  return pg.query(`SELECT public.${name}($1::jsonb)`, [
    JSON.stringify(payload),
  ]);
}
try {
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon,service_role;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
    GRANT USAGE ON SCHEMA storage TO authenticated; GRANT ALL ON storage.objects TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
  `);
  for (const name of [
    "001_schema",
    "002_catalog",
    "003_functions",
    "004_rls",
    "005_storage",
    "006_verify",
    "007_external_activities",
  ]) {
    await pg.exec(readFileSync(`supabase/${name}.sql`, "utf8"));
    console.log(`PASS ${name}`);
  }
  // A repeated fresh-schema install must fail without deleting application data.
  await assert.rejects(
    pg.exec(readFileSync("supabase/001_schema.sql", "utf8")),
  );
  assertions++;
  await pg.exec("ROLLBACK");
  await pg.query("INSERT INTO auth.users(id) VALUES ($1),($2)", [a, b]);
  const entry = { exerciseId: "calf", sets: 1, weight: 5, reps: 8, note: "" };
  await identity(a);
  await rpc("create_profile_with_template", {
    id: a,
    name: "Synthetic A",
    template: { id: templateA, name: "Synthetic plan A", entries: [entry] },
  });
  await identity(b);
  await rpc("create_profile_with_template", {
    id: b,
    name: "Synthetic B",
    template: { id: templateB, name: "Synthetic plan B", entries: [entry] },
  });
  await identity(a);
  const avatar = `${a}/60000000-0000-4000-8000-000000000001.webp`;
  await pg.query(
    "INSERT INTO storage.objects(bucket_id,name) VALUES ('avatars',$1)",
    [avatar],
  );
  await rejected(
    "INSERT INTO storage.objects(bucket_id,name) VALUES ('avatars',$1)",
    [`${b}/60000000-0000-4000-8000-000000000001.webp`],
  );
  await rejected(
    "INSERT INTO storage.objects(bucket_id,name) VALUES ('avatars',$1)",
    [`${a}/invalid.jpg`],
  );
  await pg.query(
    "SELECT public.update_account_identity('Synthetic A','Europe/Warsaw',$1)",
    [avatar],
  );
  check(
    (await pg.query("SELECT id FROM public.profiles")).rows.map((r) => r.id),
    [a],
  );
  await rejected("UPDATE public.profiles SET owner_user_id=$1 WHERE id=$2", [
    b,
    a,
  ]);
  await rejected("SELECT public.read_record_page_v1($1,$2)", [b, "sessions"]);
  await rejected("SELECT public.read_record_page_v1($1,$2,$3)", [
    a,
    "logs",
    101,
  ]);
  const session = {
    id: sessionId,
    profileId: a,
    planName: "Synthetic workout",
    started: "2026-11-20T08:00:00Z",
    note: "",
    plan: [{ ...entry, exerciseName: "Synthetic calf", unilateral: true }],
    sets: ["L", "P"].map((side) => ({
      exerciseId: "calf",
      side,
      index: 0,
      weight: 5,
      reps: 8,
      done: false,
    })),
    exerciseProgress: [],
  };
  await rpc("save_workout_session_analytics", session);
  await rpc("update_session_sets", {
    sessionId,
    sets: session.sets.map((row) => ({ ...row, done: true })),
  });
  check(
    Number(
      (await pg.query("SELECT count(*) FROM public.session_sets WHERE done"))
        .rows[0].count,
    ),
    2,
  );
  session.ended = "2026-11-20T09:00:00Z";
  session.sets = session.sets.map((row) => ({ ...row, done: true }));
  await rpc("save_workout_session_analytics", session);
  const report = {
    id: "50000000-0000-4000-8000-000000000001",
    profileId: a,
    date: "2026-11-20",
    at: "2026-11-20T10:00:00Z",
    context: "",
    note: "Synthetic report",
    values: [{ siteId: "achilles", value: 2 }],
    injuryIds: [],
    sessionId,
    measurementPhase: "post",
  };
  await rpc("save_pain_log_analytics", report);
  await rpc("save_pain_log_analytics", {
    ...report,
    id: "50000000-0000-4000-8000-000000000002",
    at: "2026-11-20T11:00:00Z",
  });
  check(
    Number(
      (await pg.query("SELECT count(*) FROM public.pain_logs")).rows[0].count,
    ),
    2,
  );
  const first = (
    await pg.query("SELECT public.read_record_page_v1($1,'logs',1) AS data", [
      a,
    ])
  ).rows[0].data.items[0];
  const next = (
    await pg.query(
      "SELECT public.read_record_page_v1($1,'logs',1,$2,$3) AS data",
      [a, first.measured_at, first.id],
    )
  ).rows[0].data.items[0];
  check(first.id === next.id, false);
  check(first.values[0].value, 2);
  const workout = (
    await pg.query("SELECT public.read_record_page_v1($1,'sessions') AS data", [
      a,
    ])
  ).rows[0].data.items[0];
  check(workout.sets.length, 2);
  check(workout.plans.length, 1);
  await rejected("SELECT public.save_pain_log_analytics($1::jsonb)", [
    JSON.stringify({
      ...report,
      id: "50000000-0000-4000-8000-000000000003",
      profileId: b,
    }),
  ]);
  await rejected("SELECT public.save_pain_log_analytics($1::jsonb)", [
    JSON.stringify({ ...report, at: "2026-11-20T07:00:00Z" }),
  ]);
  check(
    (
      await pg.query("SELECT measured_at FROM public.pain_logs WHERE id=$1", [
        report.id,
      ])
    ).rows[0].measured_at.toISOString(),
    "2026-11-20T10:00:00.000Z",
  );
  await pg.query("SELECT public.update_profile_language($1,'en')", [a]);
  check(
    (await pg.query("SELECT preferred_language FROM public.profiles")).rows[0]
      .preferred_language,
    "en",
  );
  await pg.query(
    "SELECT public.update_account_identity('Synthetic renamed','Europe/Warsaw',NULL)",
  );
  const settings = {
    profileId: a,
    name: "Synthetic renamed",
    weeklyGoal: 3,
    checkInTime: "08:00",
    rehabSites: [
      {
        id: "achilles",
        name: "Synthetic area",
        bodyArea: "Heel",
        position: 0,
        active: true,
        archived: false,
      },
    ],
    painContexts: [],
    injuries: [],
  };
  await rpc("save_profile_settings_with_archiving", settings);
  await pg.query(
    "INSERT INTO public.timer_settings(profile_id,unilateral,first_side) VALUES ($1,true,$2)",
    [a, "L"],
  );
  check(
    (await pg.query("SELECT unilateral FROM public.timer_settings")).rows[0]
      .unilateral,
    true,
  );
  const external = {
    id: "70000000-0000-4000-8000-000000000001",
    profileId: a,
    activityType: "external",
    activityName: "Synthetic running",
    templateId: templateA,
    planName: "Synthetic plan A",
    started: "2026-11-19T10:00:00Z",
    ended: "2026-11-19T11:00:00Z",
    sets: [],
    plan: [],
    note: "",
  };
  await rpc("save_external_activity", external);
  check(
    (
      await pg.query(
        "SELECT activity_name FROM public.workout_sessions WHERE id=$1",
        [external.id],
      )
    ).rows[0].activity_name,
    "Synthetic running",
  );
  await rejected("SELECT public.save_workout_session_analytics($1::jsonb)", [
    JSON.stringify({ ...external, templateId: templateB }),
  ]);
  await rejected("SELECT public.save_workout_session_analytics($1::jsonb)", [
    JSON.stringify({ ...external, activityName: "" }),
  ]);
  const backup = {
    profileSettings: settings,
    templates: [
      { id: templateA, name: "Synthetic imported", entries: [entry] },
    ],
    sessions: [session, external],
    logs: [report],
  };
  await pg.query("SELECT public.replace_profile_data_v7($1,$2::jsonb)", [
    a,
    JSON.stringify(backup),
  ]);
  check(
    Number(
      (await pg.query("SELECT count(*) FROM public.pain_logs")).rows[0].count,
    ),
    1,
  );
  check((await pg.query("SELECT activity_name FROM public.workout_sessions WHERE id=$1",[external.id])).rows[0].activity_name,"Synthetic running");
  await pg.query("DELETE FROM public.workout_sessions WHERE id=$1", [
    sessionId,
  ]);
  check(
    (await pg.query("SELECT session_id FROM public.pain_logs")).rows[0]
      .session_id,
    null,
  );
  await identity(b);
  check(
    Number(
      (await pg.query("SELECT count(*) FROM public.pain_logs")).rows[0].count,
    ),
    0,
  );
  check(
    Number(
      (await pg.query("SELECT count(*) FROM storage.objects")).rows[0].count,
    ),
    0,
  );
  check(
    Number(
      (await pg.query("SELECT count(*) FROM public.timer_settings")).rows[0]
        .count,
    ),
    0,
  );
  await pg.exec("RESET ROLE; SET ROLE anon");
  await rejected("SELECT * FROM public.profiles");
  await rejected("SELECT public.delete_account_records($1)", [a]);
  await pg.exec("RESET ROLE; SET ROLE service_role");
  await pg.query("SELECT public.delete_account_records($1)", [a]);
  await pg.exec("RESET ROLE");
  check(
    Number(
      (await pg.query("SELECT count(*) FROM public.profiles WHERE id=$1", [a]))
        .rows[0].count,
    ),
    0,
  );
  check(
    Number(
      (await pg.query("SELECT count(*) FROM public.profiles WHERE id=$1", [b]))
        .rows[0].count,
    ),
    1,
  );
  await pg.exec(readFileSync("supabase/006_verify.sql", "utf8"));
  console.log(
    `PASS ${assertions} functional assertions; fresh install, RLS, RPCs, keysets, import, rollback, deletion. Auth/Storage services remain staging checks.`,
  );
} catch (error) {
  console.error(
    "SQL verification failed:",
    error.message,
    error.detail ?? "",
    error.where ?? "",
  );
  process.exitCode = 1;
} finally {
  await pg.close();
}
