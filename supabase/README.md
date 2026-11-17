# Supabase schema and migrations

The browser uses only the Supabase project URL and publishable key. Run SQL in the Supabase SQL Editor with an administrator account. Never include the secret or service-role key in the web app or GitHub Pages build.

## Existing project

1. Export a backup. Run `migrations/20261116_schema_audit.sql` and inspect duplicate and orphan counts.
2. Apply `migrations/20261115_exercise_catalog_seed.sql`.
3. Apply `migrations/20261116_relations_and_indexes.sql`.
4. Apply `migrations/20261116_canonical_rls.sql`. Review any custom policies first.
5. Apply `migrations/20261115_atomic_writes.sql`, then `migrations/20261115_exercise_timers.sql`.
6. Apply, in order, `migrations/20261116_session_set_updates.sql`, `migrations/20261116_atomic_profile_create.sql`, and `migrations/20261116_safe_profile_import.sql`.
7. Apply `migrations/20261116_account_profile_settings.sql`. It consolidates each account to one profile and creates profile-specific tracked areas and diary contexts. Export a current database backup before running it.
8. Apply `migrations/20261117_injuries_analytics.sql`. It adds profile-owned injury episodes and atomic links from diary reports to injuries.
9. Apply `migrations/20261118_rehab_site_archiving.sql`. It adds soft removal for tracked rehabilitation areas. Removed areas disappear from settings and new reports while historical measurements and injury associations remain available.
10. Verify profile settings, area removal, injury creation, linked diary reports, analytics, workout writes, and backup import using a test account.

The GitHub Pages workflow does not run SQL migrations. Do not run the old broad `20261115_profile_access.sql` after the canonical RLS migration.

## New project

Run `bootstrap.sql` on an empty project, then apply all migrations above in their listed order. The bootstrap enables RLS before policies are installed.

## Model

- Each authenticated user owns one profile. The profile owns plans, workout sessions, diary logs, timer settings, tracked rehabilitation areas, and context choices.
- Rehab area IDs are scoped to a profile. Disabling an area hides it from new measurements; removing an area archives it from settings while preserving old measurements and injury associations.
- Workout session exercises are snapshots, so later template edits do not alter history.
- Diary logs support multiple entries on a date; values refer to profile-owned tracked areas.
- Injuries are profile-owned episodes linked to configured tracked areas. Diary reports may reference multiple injuries; completed injuries and their report links remain in history.
- Backup version 5 includes profile settings, injuries, and report-to-injury links. Imports replace one profile atomically.
