# Architecture Map

Project documentation lives under `docs/`; the root `README.md` is the entry point. File paths in this map and command examples in project documentation are relative to the repository root, unless stated otherwise. Local skill packages live in `docs/skills/` and remain excluded from version control; their internal directory structure and supporting assets are preserved.

Body Reconstruction is a React + TypeScript single-page app built with Vite. Supabase is the authenticated cloud persistence layer; Dexie IndexedDB remains available for local use and migration. Read this file before code changes and keep it aligned with the implementation. Follow `docs/AGENTS.md` and relevant instructions in `docs/skills/*/SKILL.md`; use `docs/CODE_PRACTICES.md`.

## Quick Navigation

| Task | Start here | Related modules |
|---|---|---|
| Compose app, select views, wire persistence/actions | `src/main.tsx` | `src/app/`, `src/views/` |
| Account profile settings and tracked body areas | `src/views/ProfileSettingsView.tsx` | `src/domain.ts`, `src/db.ts`, `src/cloudDb.ts`, `supabase/migrations/20261116_account_profile_settings.sql`, `supabase/migrations/20261118_rehab_site_archiving.sql` |
| Injury episodes and report associations | `src/views/ProfileSettingsView.tsx`, `src/views/DiaryView.tsx` | `src/domain.ts`, `src/cloudDb.ts`, `supabase/migrations/20261117_injuries_analytics.sql` |
| User progress analytics | `src/views/AnalyticsView.tsx`, `src/analytics.ts` | `src/main.tsx`, `src/views/TodayView.tsx`, `src/PainCharts.tsx` |
| Profile-scoped loading and storage adapters | `src/app/useProfileData.ts`, `src/app/repository.ts` | `src/db.ts`, `src/cloudDb.ts`, `src/app/profileRepository.ts` |
| Diary values and context options | `src/app/usePainLogActions.ts`, `src/views/DiaryView.tsx`, `src/PainSlider.tsx` | `src/domain.ts`, `src/Calendar.tsx`, `src/PainCharts.tsx`, `src/views/HistoryView.tsx` |
| Navigation and URL view state | `src/app/navigation.ts`, `src/app/useNavigation.ts` | `src/app/AppNavigation.tsx`, `src/main.tsx` |
| Workouts, plans, exercise timers | `src/Plans.tsx`, `src/views/WorkoutView.tsx`, `src/SessionFields.tsx` | `src/app/useWorkoutActions.ts`, `src/domain.ts`, `src/intervalTimer.ts`, `src/views/HistoryView.tsx`, `src/PainSlider.tsx` |
| Data validation, schemas, backup compatibility | `src/domain.ts` | `src/db.ts`, `src/cloudDb.ts`, `src/app/useBackupActions.ts` |
| Database schema and migrations | `supabase/bootstrap.sql` | `supabase/migrations/`, `docs/supabase/README.md` |
| Global styles and responsive behavior | `src/style.css` | `src/styles/tokens.css`, `shell.css`, `forms.css`, `responsive.css`, `views.css`, `timer.css` |

## Data Ownership and Flow

- Every authenticated Supabase user owns exactly one `public.profiles` row. The profile ID is resolved from the database at startup; there is no account-profile picker or add/rename dialog. Profile configuration is changed in the Settings view and persisted atomically through `save_profile_settings_with_archiving`.
- The profile stores its display name, weekly workout target, default diary check-in time, ordered monitored rehabilitation areas, and diary context choices. `profile_rehab_sites` and `profile_pain_contexts` are profile-owned rows protected by RLS. Deactivating an area hides it from future diary forms; archiving removes it from settings and new forms while preserving its identity, injury links, and historic pain values. Dexie v6 defaults old areas to unarchived; Supabase migration `20261118_rehab_site_archiving.sql` adds the cloud column and atomic settings RPC.
- Diary `PainLog.values` is a list of `{ siteId, value }`, so user-defined tracked areas work throughout the form, history, calendar, workout comparison, charts, and backup. The domain schema and Dexie migration accept the former fixed three-number format and convert it to the standard IDs. Backups are version 5; versions 1–4 remain readable.
- Profile settings contain injury episodes with status, dates, side, notes, and links to monitored areas. Diary logs can reference multiple injuries through `injuryIds`; Supabase stores these links in `pain_log_injuries` while local Dexie and backup v5 keep the same app-level shape. Earlier backups remain importable with no injury associations.
- Progress summaries are derived from the profile's already loaded diary logs, sessions, contexts, and area definitions. `src/analytics.ts` owns period calculations; `AnalyticsView.tsx` supplies filters and detailed report/statistic views; `TodayView.tsx` shows a compact seven-day summary. These are descriptive measurements, not medical interpretation.
- Cloud reads and writes flow through `src/cloudDb.ts`; untrusted imports and writes are validated in `src/domain.ts`. SQL functions perform atomic writes. Browser code uses only the Supabase URL and publishable key; row-level security enforces account ownership. Never put a secret key in the frontend.
- A workout can end with fewer completed sets than planned. Unfinished exercise IDs receive `finishedEarly` in `exerciseProgress`, while their unfinished set rows keep `done=false`; the status and `ended` timestamp are saved in one session write. History displays completed versus planned set groups and distinguishes early completion.
- Diary and workout completion use a shared 0–10 pain slider. When opted in, workout completion saves a separate diary log at the completion time for every active rehabilitation area; that log is then included in history and analytics. The session is saved first, so a diary write failure leaves the completed session intact and shows a message to add the measurement in Diary.
- The account consolidation migration moves all prior profile-owned workouts, templates, logs, and timer settings under one canonical account profile before adding unique ownership. It preserves multiple diary rows on the same date and leaves old global `pain_sites` lookup rows unused for compatibility.
- Local Dexie remains multi-profile only to support old local data and source selection during local-to-cloud migration. The normal app shell no longer offers profile switching.

## UI and Responsive Structure

Account details and sign-out are displayed in Settings through `AppShell.tsx`; the desktop sidebar provides a direct account/settings action. Mobile refresh controls also live in Settings (reachable through More). The desktop updater remains in the sidebar footer.

UI refinement scope and acceptance results are tracked in `docs/UI_REFINEMENT_PLAN.md`. `TodayView.tsx` prioritizes workout progress and diary actions; `PainSlider.tsx` owns the shared labeled, initially unrated pain control. Responsive navigation and updater placement checks live in `e2e/responsive-navigation.spec.ts` and `e2e/update.spec.ts`.

`src/app/AppShell.tsx` owns the sidebar, account sign-out, update controls, status and app landmarks. `src/app/AppNavigation.tsx` renders desktop navigation and the mobile More dialog. `src/main.tsx` composes the screen views and action hooks. `ProfileSettingsView.tsx` edits account configuration, tracked areas, and injury episodes; `DiaryView.tsx` renders configured areas, contexts, and injury selectors. `AnalyticsView.tsx` filters and summarizes health/workout records. `TodayView.tsx`, `HistoryView.tsx`, `Calendar.tsx`, `PainCharts.tsx`, and `WorkoutView.tsx` consume the same profile-defined tracked areas. Shared responsive tokens and breakpoints live in `src/styles/`.

## Supabase Setup

The explicit refresh action in `src/AppUpdater.tsx` activates the waiting worker and clears only caches with this app's `rehab-<base>-` prefix before reloading. IndexedDB and authentication storage are preserved. `vite.config.ts` generates the production service worker and manifest, including the light theme colors.

For an existing project, apply the migration sequence in `docs/supabase/README.md`, ending with `20261118_rehab_site_archiving.sql`. Migrations are applied manually in Supabase SQL Editor; GitHub Pages deployment does not modify the database. New projects use `supabase/bootstrap.sql` and then the documented migrations.

## Checks

Unit tests are colocated in `src/*.test.ts`; end-to-end scenarios are under `e2e/`. `npm run build` performs TypeScript checking and creates the Vite build; `npm test` runs Vitest. Do not claim checks passed unless they were run.
