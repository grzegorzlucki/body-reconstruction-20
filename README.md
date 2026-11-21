# Body Reconstruction

A personal rehabilitation and activity diary built with React, TypeScript and Vite. Track workouts, pain measurements, injury episodes and progress in Polish or English.

[Open the application](https://grzegorzlucki.github.io/body-reconstruction-20/)

## Documentation

Project documentation lives in `docs/`. Before changing code, read the [repository instructions](docs/AGENTS.md), [architecture map](docs/architecture.md) and [coding practices](docs/CODE_PRACTICES.md).

- [Testing and verification](docs/TESTOWANIE.md)
- [Supabase setup and migrations](docs/supabase/README.md)
- [PWA icons and Pages artifact checks](docs/PAGES_ASSETS.md)
- [UI refinement plan](docs/UI_REFINEMENT_PLAN.md)
- [Polish and English deployment](docs/I18N_PL_EN_DEPLOYMENT.md)

Local skill packages live in `docs/skills/` with their supporting files. Tools that only discover a root-level AGENTS.md must be explicitly directed to `docs/AGENTS.md`.

## Features

- **Today:** a profile greeting, compact progress summaries, workout continuation and pain check-in.
- **Workouts and plans:** named templates, exercise ordering, copying, notes, weights, repetitions and 1-10 sets per exercise. The exercise catalog includes 30 lower-body exercises with search and equipment filters. Loads are entered manually; replacing an exercise does not copy its load from a different machine.
- **Workout history:** every session keeps its own plan snapshot. Editing or deleting a template does not change previous sessions. Resume an active workout, finish an exercise early or save a partial workout after confirming the summary. Unperformed sets remain unmarked. Add historical workouts from Workout or History.
- **Other activities:** record running or another activity without artificial sets. Optionally link a saved plan so it counts towards the weekly goal. Strength workouts and other activities are also counted separately; pain reports can be linked afterwards.
- **Diary:** record multiple pain measurements per day using accessible 0-10 sliders, date, time, context and optional notes. Link reports explicitly to workouts, workout phases and injuries. An optional post-workout pain report is also available when finishing a session.
- **History charts:** measurements appear beside their charts on wide screens and below them on mobile. Hover, touch and keyboard selection link the exact report to its chart points. The first 50 measurements are shown initially; load more when needed.
- **Calendar:** select a day to see separate workout and pain sections. On desktop, the calendar sits beside day details. Markers distinguish completed workouts, measurements and ongoing sessions.
- **Analyses:** Overview, Timeline, Workout response, Dose and regularity, and Areas and injuries. Filter by date, area, injury, context, phase, plan and exercise. Timeline overlays selectable area-specific daily pain medians with workout count, completed sets or activity duration on separate axes. Missing pain remains missing, and daily readouts support mouse, touch and keyboard. The comparison chart displays up to 366 days; narrow the range for longer histories. Temporal associations do not establish causation.
- **Profile:** each authenticated account has one database-backed profile with a display name, avatar, weekly workout target, default check-in time, rehabilitation areas, diary contexts and injury episodes. Selecting an area for an injury also adds it to monitoring. Areas can be deactivated or archived while historical values remain available.
- **HSR timer:** configurable preparation, three movement phases, repetitions, sets, rests, sound, pause and resume. Zero skips a phase; at least one movement phase must have positive duration. Preparation appears before the first set and during the final part of each rest. No rest follows the last set.
- **Unilateral exercises:** complete repetitions on the first side, prepare to switch, complete the other side and then rest. One set includes both sides; the first side and switch preparation are configurable.
- **Exercise timers:** optionally save a timer with each exercise in a plan. Its configuration is copied into sessions, preserving history after plan edits. Completed and interrupted exercise states survive reloads; an active countdown must be restarted. The standalone timer does not mark workout sets complete.
- **Backups:** JSON export version 7 includes profile settings, injuries, report links, templates, session snapshots and external activities. Earlier backup formats remain importable. Standalone timer preferences are excluded; exercise-specific timer settings are included.

The app displays recorded pain without automatic progression or regression prescriptions. Users decide their training loads.

## Navigation and language

On desktop, open the account menu at the top right. On mobile, use **More > Profile**. Profile sections cover personal details, rehabilitation, security, preferences, data and updates. Plans are accessible from the bottom navigation and **Workout > My plans**.

Choose **Polski**, **English** or **Automatic** on the sign-in screen or under **Profile > Preferences**. Changing language preserves timers and unsaved input. User-created names, notes and history are not translated.

Views use `?view=...` URLs and support browser Back navigation. Previously downloaded app views can open offline, but cloud account reads and writes require a connection to Supabase.

## Privacy and storage

- The repository and application shell are public. User records are stored in Supabase, not committed to GitHub.
- Initial templates use neutral loads: 0 kg of additional weight. Enter personal values in the app.
- Older local records may remain in the browser's IndexedDB until manually removed. A different browser, device or site origin has a separate local database.
- Local storage and exported JSON backups are **not password-encrypted**. Do not publish exports or use a shared browser profile for private records.
- Private documents, exports, local tools and test artifacts are excluded from Git. Only `dist` is published.
- The Data section can import a local profile into the account profile. Import replaces destination profile data transactionally while keeping the local copy. Export a backup first.
- Failed cloud writes are reported; offline changes are not silently treated as saved to Supabase.

## Local development

Use Node.js 22.12 or a newer supported LTS release:

```powershell
npm ci
npm run dev
```

For a production preview:

```powershell
npm run build
npm run preview -- --port 4173
```

Open http://localhost:4173. The original development machine can also use `powershell -ExecutionPolicy Bypass -File .\START.ps1`.

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. These values are public browser configuration. Never pass `SUPABASE_SECRET_KEY` or a service-role key to Vite or GitHub Pages.

## Supabase

For an **empty project**, run these complete SQL files in order:

1. `supabase/001_schema.sql`
2. `supabase/002_catalog.sql`
3. `supabase/003_functions.sql`
4. `supabase/004_rls.sql`
5. `supabase/005_storage.sql`
6. `supabase/006_verify.sql` (expects `Installation checks passed`)
7. `supabase/007_external_activities.sql`
8. `supabase/008_optional_monitoring.sql`

File 007 adds external activities and version-7 imports. File 008 allows all monitored areas to be inactive without deleting areas or historical measurements.

**Do not reinstall a working database using the fresh-install scripts.** Existing installations should apply only the missing upgrades described in the [Supabase guide](docs/supabase/README.md). `supabase/old/` contains archived migrations and repair scripts, not an additional installation sequence. Frontend deployment does not migrate the database.

For older installations, the archive contains migrations for exercise timers (`20261115_exercise_timers.sql`), account details and avatars (`20261119_account_profile.sql`), unilateral timing (`20261120_unilateral_timer.sql`), analytics links (`20261121_analytics_links.sql`) and account language (`20261122_profile_language.sql`). Follow their prerequisites in the database guide. Account deletion additionally requires deployment of the `delete-account` Edge Function.

Configure Supabase Auth redirect URLs for email confirmation and password resets. Email-template language is configured separately from the interface language; see the [language deployment guide](docs/I18N_PL_EN_DEPLOYMENT.md).

## GitHub Pages and updates

In **Settings > Secrets and variables > Actions > Variables**, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The workflow requires both.

The workflow in `.github/workflows/pages.yml` tests and builds with base path `/body-reconstruction-20/`, publishes only the output to `gh-pages` and triggers Pages deployment. In **Settings > Pages**, choose **Deploy from a branch > gh-pages > /(root)**. Publication runs after changes to `main` or a manual Actions run. `.nojekyll` prevents Jekyll processing of the built files.

Free GitHub Pages hosting requires a public repository. Check the workflow result if the new version is not visible at [the application URL](https://grzegorzlucki.github.io/body-reconstruction-20/).

**Refresh application** checks for an update, activates the downloaded offline version and reloads without deleting the local database. It needs internet and is unavailable while saving. Storage restrictions may prevent service-worker updates; do not clear site data without backing up local records. Destructive actions and leaving unsaved forms require confirmation.

On iPhone, open the HTTPS URL in Safari and choose **Share > Add to Home Screen**. Keep the timer visible during use. Sound, screen wake-lock and offline behaviour require verification on a real device. Closing or reloading the page does not resume an active countdown.

## Verification

```powershell
npm test
npm run test:sql
npm run build
npx playwright install chromium
npx playwright test
```

For the GitHub Pages subdirectory build:

```powershell
$env:VITE_BASE_PATH = '/body-reconstruction-20/'
npm run build
npx playwright test
Remove-Item Env:VITE_BASE_PATH
```

`npm run test:sql` verifies the installation against an ephemeral PostgreSQL/PGlite environment with Auth/Storage fixtures; it does not replace hosted-service acceptance testing. `npm run test:load` uses a synthetic loopback API, not production Supabase. See [testing documentation](docs/TESTOWANIE.md) and [performance findings](docs/performance/) for scope and limitations.
