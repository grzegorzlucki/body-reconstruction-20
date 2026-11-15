# Architecture Map

A guide to the Body Reconstruction repository. The app is React + TypeScript built with Vite. With Supabase configured, signed-in users store data in PostgreSQL; the previous IndexedDB database remains available for local migration and development without cloud configuration.

## Quick Navigation

| If you are changing… | Start here | Related locations |
|---|---|---|
| A view, navigation, form, data save/edit flow, or import/export | `src/main.tsx` | `src/SessionFields.tsx`, `src/Plans.tsx`, `src/Calendar.tsx`, `src/PainCharts.tsx` |
| Workout rules, validation, backup format, pain monitoring, or session operations | `src/domain.ts` | `src/domain.test.ts`, `src/editing.test.ts` |
| IndexedDB tables, database migrations, or backup reads/writes | `src/db.ts` | `src/db.test.ts` |
| Exercises, equipment, labels, or the initial exercise selection | `src/catalog.ts` | `src/domain.ts`, `src/Plans.tsx` |
| Set fields or numeric input | `src/SessionFields.tsx` | `src/SetNumberInput.tsx` |
| Creating and editing plans or selecting exercises | `src/Plans.tsx` | `src/catalog.ts`, `src/domain.ts`, `src/plans.test.ts` |
| The calendar or navigation from a day to a form | `src/Calendar.tsx` | `src/main.tsx` |
| Pain charts and point tooltips/interactions | `src/PainCharts.tsx` | `src/main.tsx`, `e2e/pain-charts.spec.ts` |
| HSR timer logic and UI | `src/intervalTimer.ts`, `src/HsrTimer.tsx`, `src/ExerciseTimer.tsx` | `src/Plans.tsx`, `src/SessionFields.tsx` |
| App updates, offline support, and the service worker | `src/AppUpdater.tsx`, `vite.config.ts` | `src/main.tsx`, `e2e/update.spec.ts` |
| Global styling | `src/style.css` | JSX in `src/*.tsx` |
| Authentication and cloud access | `src/AuthGate.tsx`, `src/supabase.ts`, `src/cloudDb.ts` | `supabase/migrations/`, `src/main.tsx` |

## Modules and Responsibilities

- **`src/main.tsx` — application composition.** Initializes React, loads and refreshes data, manages view and form state, coordinates writes through `db`, and renders the tabs: Today, Workout, Diary, Calendar, History, Plans, HSR Timer, and Data. The Workout tab can save its current named exercise order and doses as a new or updated profile template without starting a session. It also handles the historical workout editor. Start here when changing view behavior or navigation between screens.
- **UI components:** `SessionFields.tsx` edits sets in active and historical workouts and mounts an optional per-exercise `ExerciseTimer.tsx`; `SetNumberInput.tsx` is a shared numeric input; `Plans.tsx` contains the exercise picker, plan editor, and optional timer settings; `Calendar.tsx` displays days with workouts and pain logs; `PainCharts.tsx` renders three pain charts; `HsrTimer.tsx` handles the standalone timer; `AppUpdater.tsx` handles service worker updates. The updater is mounted outside the data-ready view, in the desktop sidebar and above the mobile content, so it remains available when profile loading fails.
- **`src/domain.ts` — types and domain logic.** Contains Zod schemas and types for plans, sessions, sets, pain logs, and backups; validation and creation functions; set grouping and exercise replacement; local date handling; and pain-monitor lookups. Keep rules that do not depend on React or IndexedDB here.
- **`src/catalog.ts` — exercise catalog.** Defines the initial exercise set and the full picker catalog, including equipment, laterality, and defaults. `exerciseById` is used by domain logic to resolve exercise IDs.
- **`src/db.ts` — persistence.** Defines the Dexie database `body-reconstruction-v1`, the `profiles`, `logs`, `sessions`, and `templates` tables, migrations through version 3, and transactional JSON backup import/export. Version 3 assigns existing records to the default profile. Import validates data with schemas from `domain.ts` and replaces only the selected profile's data.
- **Cloud mode:** `src/supabase.ts` creates a browser client with the public project URL and publishable key. `src/AuthGate.tsx` handles sign-in, registration, password recovery, and session changes. `src/cloudDb.ts` maps the existing UI model to PostgreSQL tables and calls SQL functions for atomic writes. Profile ownership references `auth.users` directly. The SQL files in `supabase/migrations/` define RLS policies, lookup data, write functions, and the ownership foreign key; apply them in order before enabling cloud mode. `20261115_profiles_rls_repair.sql` replaces policies only on `profiles`. `20261115_exercise_timers.sql` adds optional timer configuration to template/session exercises and per-session exercise progress, then updates atomic write functions.
- **Timer:** `src/intervalTimer.ts` contains pure settings, validation, position calculation, and formatting logic; `HsrTimer.tsx` implements the standalone UI and `ExerciseTimer.tsx` uses a saved session exercise configuration. The final `min(prepare, rest)` seconds of each between-set rest are shown as preparation for the next set and remain part of the rest duration. Standalone timer settings use `timer_settings` in cloud mode and per-profile `localStorage`; per-exercise timer configuration is included in templates, session snapshots, and backups.
- **Styles and assets:** `src/style.css` contains global styles. `public/` contains icons, the source manifest, and static files. `index.html` is the app entry document.

## Data Flow

1. On startup, `src/main.tsx` selects Supabase when both public environment variables are present. Authenticated users load profiles and their records through `src/cloudDb.ts`; otherwise the app uses `src/db.ts` (Dexie). Switching profiles clears view state before loading the next person's records.
2. User interactions pass through view/form handlers in `main.tsx` and specialized components. Rules and validation live in `src/domain.ts` (Zod); exercise data comes from `src/catalog.ts`.
3. Changes are saved to IndexedDB. After write operations, the app refreshes its local state from the database. Each workout session stores its own copy of the plan, so later template edits do not change workout history.
4. Export creates a v3 JSON file containing the selected profile's name, pain logs, sessions, and templates. Import accepts v1, v2, and v3 and replaces only the selected profile's data. Cloud import runs in one PostgreSQL function call. The Data tab can transfer an existing local profile into the signed-in account without deleting the local copy.
5. In production, `src/main.tsx` registers the service worker generated by `vite.config.ts`. The Vite configuration builds the manifest and offline cache using `VITE_BASE_PATH` (including for GitHub Pages).

## Tests and Tooling

- Vitest unit tests live alongside the code in `src/*.test.ts`. They cover domain rules, validation and editing (`domain.test.ts`, `editing.test.ts`), the database and backups (`db.test.ts`), plans (`plans.test.ts`), and timer calculations (`intervalTimer.test.ts`). Vitest includes `src/**/*.test.ts`.
- Playwright end-to-end tests are in `e2e/`; phone emulation, the `Europe/Warsaw` timezone, and the preview server are configured in `playwright.config.ts`. Scenarios cover the app, history, pain tracking, plans, workouts/sets, the timer, and updates/offline behavior.
- `TESTOWANIE.md` documents test coverage and environment notes; `README.md` describes setup, Pages hosting, features, and privacy.
- Commands from `package.json`: `npm run dev` starts Vite, `npm run build` runs the TypeScript check and builds `dist`, `npm run preview` serves the build, and `npm test` runs Vitest. For E2E tests, build the app first, then run `npx playwright test`.

## Deployment Configuration

- `vite.config.ts` reads the base path from `VITE_BASE_PATH`, validates its format, and generates the manifest and service worker in `dist`. Builds for a subpath should use the same path as the Playwright configuration.
- `vitest.config.ts` limits unit tests to `src/**/*.test.ts`; `playwright.config.ts` points to `e2e/` and starts `npm run preview` on port 4176.
- `START.ps1` is a local startup script. `public/manifest.webmanifest` is a static manifest asset; the production manifest is generated for the build by the Vite configuration.
