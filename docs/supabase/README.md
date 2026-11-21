# Supabase schema and migrations

Paths below are relative to the repository root. SQL files remain in `supabase/`; only this documentation moved to `docs/supabase/`.

The browser uses only the Supabase project URL and publishable key. Run SQL in the Supabase SQL Editor with an administrator account. Never include the secret or service-role key in the web app or GitHub Pages build.

## Existing project

For optimized reads, apply `supabase/migrations/20261123_read_record_pages.sql` after the existing migrations, first on staging. This adds bounded, owner-checked, security-invoker keyset reads with nested child rows. The frontend falls back to legacy reads only when the function is missing. Deployment steps and outstanding work: `docs/performance/OPTIMIZATION_DEPLOYMENT.md`. The migration has not been executed against a real PostgreSQL project by the local test harness.

For Polish/English UI, run `supabase/migrations/20261122_profile_language.sql` after the analytics migration and before deploying the frontend. It adds a language preference and owner-checked RPC without rewriting existing rehabilitation data. See `docs/I18N_PL_EN_DEPLOYMENT.md` for account/cache rules, staging checks and the bilingual Auth email templates under `supabase/email-templates/`.

For the new Analytics release, after the earlier migrations below, run the complete file `supabase/migrations/20261121_analytics_links.sql` in one SQL Editor execution **before deploying the frontend**. It is additive and rerunnable. It adds session-linked measurements, measurement phases and completion reasons; it does not guess relationships for old reports. Existing RLS policies remain active. New cloud save/import RPCs require this migration; deployment to Pages does not run SQL.

Manual acceptance on a staging project (not verified by local browser tests):

- Save two reports on one day, edit one, export/import v6 and verify each session relation points to the newly imported session ID.
- Under account A, try linking a report to account B's session: both direct writes and RPC must fail and roll back.
- Delete a session: reports and their profile ownership/values must remain, with `session_id` cleared.
- Reject pre measurements after start, during measurements outside the session, and post/follow-up before end. Reject session time edits that invalidate already linked measurements.
- Verify a failed import leaves existing data intact; rerun the migration without duplicate-relation errors.

1. Export a backup. Run `supabase/migrations/20261116_schema_audit.sql` and inspect duplicate and orphan counts.
2. Apply `supabase/migrations/20261115_exercise_catalog_seed.sql`.
3. Apply `supabase/migrations/20261116_relations_and_indexes.sql`.
4. Apply `supabase/migrations/20261116_canonical_rls.sql`. Review any custom policies first.
5. Apply `supabase/migrations/20261115_atomic_writes.sql`, then `supabase/migrations/20261115_exercise_timers.sql`.
6. Apply, in order, `supabase/migrations/20261116_session_set_updates.sql`, `supabase/migrations/20261116_atomic_profile_create.sql`, and `supabase/migrations/20261116_safe_profile_import.sql`.
7. Apply `supabase/migrations/20261116_account_profile_settings.sql`. It consolidates each account to one profile and creates profile-specific tracked areas and diary contexts. Export a current database backup before running it.
8. Apply `supabase/migrations/20261117_injuries_analytics.sql`. It adds profile-owned injury episodes and atomic links from diary reports to injuries.
9. Apply `supabase/migrations/20261118_rehab_site_archiving.sql`. It adds soft removal for tracked rehabilitation areas. Removed areas disappear from settings and new reports while historical measurements and injury associations remain available.
10. Apply `supabase/migrations/20261119_account_profile.sql`. It adds private avatars, focused account identity writes and a service-role-only account data cleanup function. Review any existing policies on an existing avatars bucket; permissive custom policies can broaden access.
11. Apply `supabase/migrations/20261120_unilateral_timer.sql` for standalone HSR unilateral settings. Per-exercise settings use existing timer_config JSONB and require no additional table.
12. Apply `supabase/migrations/20261121_analytics_links.sql` for session-linked pain reports, measurement phases, completion reasons and v6 atomic import wrappers. See the acceptance checks above.
12. Verify profile settings, area removal, injury creation, linked diary reports, analytics, workout writes, and backup import using a test account.

The GitHub Pages workflow does not run SQL migrations. Do not run the old broad `20261115_profile_access.sql` after the canonical RLS migration.

## New project

Run `supabase/bootstrap.sql` on an empty project, then apply all migrations above in their listed order. The bootstrap enables RLS before policies are installed.

## Account deletion function

Deploy `supabase/functions/delete-account/index.ts` after the latest migration. Set the function secret `APP_ORIGIN` to `https://grzegorzlucki.github.io` (origin only, no repository path). Keep JWT verification enabled. The function also verifies the supplied bearer token through Auth and requires the current password. It does not accept user IDs from the browser. Supabase supplies server-only `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in its Edge runtime; never place the service key in Vite variables.

Using the Supabase CLI from the repository root:

```sh
supabase secrets set APP_ORIGIN=https://grzegorzlucki.github.io --project-ref YOUR_PROJECT_REF
supabase functions deploy delete-account --project-ref YOUR_PROJECT_REF
```

Test deletion only using disposable accounts with synthetic data. Cleanup spans Storage, a database transaction and Auth; it is not a cross-service transaction. On a partial failure the same authenticated account can retry; some data might already be removed. MFA-enabled accounts are explicitly refused until a verified MFA deletion flow is implemented. OAuth-only accounts need to establish a password through recovery first. Security/email, avatar ownership and deletion require actual Supabase verification; local UI tests cannot prove these policies.

Display name and avatar are not duplicated into Auth metadata. Account time zone is stored separately; historical log dates and existing local-device form conventions remain unchanged. Backup v6 retains rehabilitation data; it does not include avatar images or security credentials.

## Model

- Each authenticated user owns one profile. The profile owns plans, workout sessions, diary logs, timer settings, tracked rehabilitation areas, and context choices.
- Rehab area IDs are scoped to a profile. Disabling an area hides it from new measurements; removing an area archives it from settings while preserving old measurements and injury associations.
- Workout session exercises are snapshots, so later template edits do not alter history.
- Diary logs support multiple entries on a date; values refer to profile-owned tracked areas.
- Injuries are profile-owned episodes linked to configured tracked areas. Diary reports may reference multiple injuries; completed injuries and their report links remain in history.
- Backup version 6 includes profile settings, injuries, and report-to-injury links. Imports replace one profile atomically.
