# Architecture Map

Body Reconstruction is a React + TypeScript single-page app built with Vite. Supabase is the authenticated cloud persistence layer; Dexie IndexedDB remains available for local use and migration. Read this file before code changes and keep it aligned with the implementation. Follow `AGENTS.md` and relevant instructions in `skills/*/SKILL.md`; use `skills/CODE_PRACTICES.md`.

## Quick Navigation

| Task | Start here | Related modules |
|---|---|---|
| Compose app, select views, wire persistence/actions | `src/main.tsx` | `src/app/`, `src/views/` |
| Account profile settings and tracked body areas | `src/views/ProfileSettingsView.tsx` | `src/domain.ts`, `src/cloudDb.ts`, `supabase/migrations/20261116_account_profile_settings.sql` |
| Profile-scoped loading and storage adapters | `src/app/useProfileData.ts`, `src/app/repository.ts` | `src/db.ts`, `src/cloudDb.ts`, `src/app/profileRepository.ts` |
| Diary values and context options | `src/app/usePainLogActions.ts`, `src/views/DiaryView.tsx` | `src/domain.ts`, `src/Calendar.tsx`, `src/PainCharts.tsx`, `src/views/HistoryView.tsx` |
| Navigation and URL view state | `src/app/navigation.ts`, `src/app/useNavigation.ts` | `src/app/AppNavigation.tsx`, `src/main.tsx` |
| Workouts, plans, exercise timers | `src/Plans.tsx`, `src/views/WorkoutView.tsx` | `src/app/useWorkoutActions.ts`, `src/domain.ts`, `src/intervalTimer.ts` |
| Data validation, schemas, backup compatibility | `src/domain.ts` | `src/db.ts`, `src/cloudDb.ts`, `src/app/useBackupActions.ts` |
| Database schema and migrations | `supabase/bootstrap.sql` | `supabase/migrations/`, `supabase/README.md` |
| Global styles and responsive behavior | `src/style.css` | `src/styles/tokens.css`, `shell.css`, `forms.css`, `responsive.css`, `views.css`, `timer.css` |

## Data Ownership and Flow

- Every authenticated Supabase user owns exactly one `public.profiles` row. The profile ID is resolved from the database at startup; there is no account-profile picker or add/rename dialog. Profile configuration is changed in the Settings view and persisted with `save_profile_settings`.
- The profile stores its display name, weekly workout target, default diary check-in time, ordered monitored rehabilitation areas, and diary context choices. `profile_rehab_sites` and `profile_pain_contexts` are profile-owned rows protected by RLS. Deactivating an area hides it from future diary forms but preserves its identity and historic pain values.
- Diary `PainLog.values` is a list of `{ siteId, value }`, so user-defined tracked areas work throughout the form, history, calendar, workout comparison, charts, and backup. The domain schema and Dexie migration accept the former fixed three-number format and convert it to the standard IDs. Backups are version 4; versions 1?3 remain readable.
- Cloud reads and writes flow through `src/cloudDb.ts`; untrusted imports and writes are validated in `src/domain.ts`. SQL functions perform atomic writes. Browser code uses only the Supabase URL and publishable key; row-level security enforces account ownership. Never put a secret key in the frontend.
- The account consolidation migration moves all prior profile-owned workouts, templates, logs, and timer settings under one canonical account profile before adding unique ownership. It preserves multiple diary rows on the same date and leaves old global `pain_sites` lookup rows unused for compatibility.
- Local Dexie remains multi-profile only to support old local data and source selection during local-to-cloud migration. The normal app shell no longer offers profile switching.

## UI and Responsive Structure

`src/app/AppShell.tsx` owns the sidebar, account sign-out, update controls, status and app landmarks. `src/app/AppNavigation.tsx` renders desktop navigation and the mobile More dialog. `src/main.tsx` composes the screen views and action hooks. `ProfileSettingsView.tsx` edits account-owned configuration; `DiaryView.tsx` renders configured body areas and contexts. `TodayView.tsx`, `HistoryView.tsx`, `Calendar.tsx`, `PainCharts.tsx`, and `WorkoutView.tsx` consume the same profile-defined rehab sites. Shared responsive tokens and breakpoints live in `src/styles/`.

## Supabase Setup

For an existing project, apply the migration sequence in `supabase/README.md`, ending with `20261116_account_profile_settings.sql`. This migration is applied manually in Supabase SQL Editor; GitHub Pages deployment does not modify the database. New projects use `supabase/bootstrap.sql` and then the documented migrations.

## Checks

Unit tests are colocated in `src/*.test.ts`; end-to-end scenarios are under `e2e/`. `npm run build` performs TypeScript checking and creates the Vite build; `npm test` runs Vitest. Do not claim checks passed unless they were run.
