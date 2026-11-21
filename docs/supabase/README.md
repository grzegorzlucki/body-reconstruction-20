# Supabase installation

The numbered SQL files in `supabase/` install the current application on a **fresh Supabase project**. They replace the old bootstrap-plus-repair sequence. Auth and Storage are managed by Supabase; the installer does not recreate their schemas, roles or Auth users.

## Run these files in order

In Supabase Dashboard → SQL Editor → New query, paste and run each **complete file**, separately. Continue only after success.

| Order | File | Contents |
|---|---|---|
| 1 | `supabase/001_schema.sql` | Final tables, constraints, indexes; RLS enabled and browser grants revoked |
| 2 | `supabase/002_catalog.sql` | Shared exercise catalog and compatibility pain-site lookup |
| 3 | `supabase/003_functions.sql` | Final transactional RPCs, read pagination, validation triggers and function permissions |
| 4 | `supabase/004_rls.sql` | Account ownership policies and explicit authenticated table grants |
| 5 | `supabase/005_storage.sql` | Private avatars bucket and ownership policies; API schema reload |
| 6 | `supabase/006_verify.sql` | Read-only structural and permission checks; expect `Installation checks passed` |
| 7 | `supabase/007_external_activities.sql` | External activities, plan association, dedicated save and v7 import RPCs |

Existing current projects need only step 7 for external activities. New projects run all seven files; verification file 006 can be rerun afterwards. Backup v7 preserves activities and pain links; older v1–v6 backups remain importable.

There is no need to run anything in `supabase/old/` after these files. Do not run this fresh installer against the current database: step 1 deliberately rejects an existing application schema. The installer never drops existing user data. It is not a database reset command. SQL files 001–004 are install-once; 006 is safe to rerun. Each file is transactional, so a failed file rolls back its own changes. Previously completed files remain installed; correct the failed step before continuing.

## Existing database

Moving SQL files in Git does not change your deployed database. An already working database does not need reinstallation. Historical scripts are preserved unchanged at `supabase/old/bootstrap.sql` and `supabase/old/migrations/`, for history and carefully selected upgrades only. Some old scripts broaden policies or merge data; do not replay the archive in filename order. Its old date prefixes are not a new-project installation sequence.

Before replacing an existing project with a separate new one, export a backup and complete an application import test. After validating the new project, update the frontend URL/publishable key and deploy. Keep the old project available until the transfer is verified.

## Auth, application and Storage setup

1. Configure Auth Site URL and redirect allowlist for the deployed app. For GitHub Pages the application URL includes `/body-reconstruction-20/`.
2. Configure email delivery/confirmation and the PL/EN templates in `supabase/email-templates/`.
3. Configure only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the frontend. Never expose secret/service-role credentials in Vite.
4. New users receive their application profile and starter template through `create_profile_with_template`, called by the app after authentication. Do not insert fake production users through this installer.
5. Deploy the account-deletion Edge Function separately. SQL does not deploy server code.

```sh
supabase secrets set APP_ORIGIN=https://grzegorzlucki.github.io --project-ref YOUR_PROJECT_REF
supabase functions deploy delete-account --project-ref YOUR_PROJECT_REF
```

Keep JWT verification enabled. The function validates the bearer identity and current password. Supabase supplies its server-only credentials. Account cleanup spans Storage, a database transaction and Auth; it is not a distributed transaction. Test only disposable accounts. MFA deletion remains refused until an MFA-aware flow is implemented. OAuth-only users must establish a password first.

## Verification

Run `npm run test:sql` locally after `npm ci`. It creates an ephemeral PGlite PostgreSQL database and minimal Auth/Storage interface fixtures, then executes the same six files. It tests actual SQL/RLS, ownership isolation, multiple daily reports, transactional RPCs, keyset pages, rollback, import, session deletion and privileged account cleanup. It simulates permissive default grants to verify explicit revocations. No real project, credentials, production data or network API are used.

PGlite does not run Supabase Auth, PostgREST, Edge Functions or object storage. On a disposable Supabase project additionally test registration/login, JWT-backed REST/RPC calls for two accounts, signed avatar URLs, upload constraints, timer settings, backup import/export and account deletion. SQL permission checks alone do not prove the complete hosted flow.

## Schema notes

- Each Auth user owns one profile; child records are protected by ownership RLS.
- Areas and contexts belong to a profile; archived areas remain available to historic measurements.
- Multiple pain reports per day are supported. Reports can link to sessions and injuries in the same profile.
- Workout exercises/sets are snapshots; bilateral and unilateral timers are supported.
- Profile language, identity, private avatars, analytics links and cursor read APIs are included from the start.
- `pain_sites` is a read-only compatibility lookup. The obsolete `app_users` table and profile-merge staging tables are not created.
- No function ownership is transferred away from the SQL installer role. Browser RPCs use caller RLS; only the narrow cleanup/detachment functions retain their necessary definer behavior.
