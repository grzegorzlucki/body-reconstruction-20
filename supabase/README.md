# Supabase schema and migrations

The browser uses only the project URL and publishable key. Run SQL in the
Supabase SQL Editor with a database administrator account. Do not put a secret
or service-role key in the web app or GitHub Pages build.

## Existing project

1. Export a backup of the project/database. Run `migrations/20261116_schema_audit.sql` and review its duplicate counts. The `relations_and_indexes` migration will stop and roll back if duplicates or orphan rows violate a new constraint.
2. Apply `migrations/20261115_exercise_catalog_seed.sql` to fill the exercise and pain-site lookups.
3. Apply `migrations/20261116_relations_and_indexes.sql` to add cascading relationships and indexes. Review any existing custom foreign-key behavior first.
4. Apply `migrations/20261116_canonical_rls.sql`. It replaces policies on the active application tables and revokes access to the unused `app_users` table. Review custom policies first.
5. Ensure `migrations/20261115_atomic_writes.sql` has been applied, then apply `migrations/20261115_exercise_timers.sql` **after it**. The latter replaces the template/session write functions with timer-aware versions.
6. Apply `migrations/20261116_session_set_updates.sql`, `migrations/20261116_atomic_profile_create.sql`, and `migrations/20261116_safe_profile_import.sql`, in that order.
7. Run the audit again. Verify with two test accounts that each can read/write only its own profiles, plans, sessions, pain logs, and timer settings. Check plan deletion and backup import on a test profile before using them on real data.

The SQL files are not applied by the GitHub Pages workflow. A frontend deploy
does not change the database. Do not run the old broad
`20261115_profile_access.sql` after the canonical RLS migration; it drops and
recreates policies and could undo later fixes.

## New project

Run `bootstrap.sql` on an empty Supabase project. Then apply the files in steps
2–6 above. `bootstrap.sql` deliberately enables RLS before any policy is
created, so application tables deny browser access until canonical RLS is
installed. The legacy `app_users` table is not created in a new project.

## Current model

- `auth.users` owns `profiles`. `app_users` is legacy and unused.
- A profile owns plans, sessions, pain logs, and standalone timer settings.
- Plan exercise rows store order, doses, and optional timer configuration.
- Session exercise rows are snapshots of the chosen plan. Set rows store actual
  performance. Deleting a plan does not delete session snapshots.
- Exercise and pain-site IDs are shared lookups; seed them before importing
  backups or saving plans.
- Each profile/day has one pain log. Imports replace one profile atomically.

Migrations do not delete user profiles or workouts. The relationship migration
changes dependent-row deletion to cascade; use the audit and backup first.
