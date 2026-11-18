# Plan: mobile avatar, native date controls and loading screen

Status: implemented. Shared loading states, bounded authentication resolution, mobile avatar geometry and native control bounds are covered by regression tests. No SQL, backup format changes, commits or pushes. Native WebKit-specific overrides were not added without a reproduced WebKit issue; physical Safari acceptance remains outstanding because only Chromium is installed here.

## Findings and scope

- `src/styles/base.css`: `.more-dialog nav button span` sets every span to 32px wide and inline-block. This also matches the `ProfileAvatar` root. `src/styles/profile.css` gives that avatar a 48px height, so the More entry can become an ellipse. The 26px mobile avatar rule only targets `.phone-nav`, whereas Profile now lives in `.more-dialog`.
- `ProfileAvatar.tsx` is shared by More, desktop account menu, profile overview and photo form. Fix the shared size contract and icon selector rather than adjusting every occurrence independently.
- Date/time fields appear in Diary, Analytics filters, injury settings, default check-in settings and the historical session editor. Existing border-box and minmax grid rules already exist; inspect native control intrinsic width and ancestor sizing instead of adding a blanket overflow clip. The exact date-control overflow must be reproduced in the affected browser before claiming its cause is proven.
- `AuthGate.tsx` currently renders plain "Sprawdzanie sesji…". Its initial `getSession()` promise has no rejection path. `main.tsx` separately renders text while profile records load; lazy views also have text fallbacks. These are distinct loading phases and need coordinated presentation.
- Follow local React Best Practices and Web Design Guidelines, including reduced motion, announced status, safe areas, stable image sizes and shrinking flex/grid children.

## Batch 1 — Avatar geometry and mobile More entry

Files: `src/profile/ProfileAvatar.tsx`, `src/app/AppNavigation.tsx`, `src/styles/profile.css`, `src/styles/base.css`; inspect `PersonalInfoForm.tsx` and `AccountProfileView.tsx` as consumers.

1. Give ordinary navigation symbols an explicit `.nav-icon` class; replace the broad `.more-dialog nav button span` rule with a selector that cannot match avatar roots or text wrappers.
2. Introduce explicit avatar sizes (small/navigation, medium/form, large/overview), preferably through a size prop and CSS variable. Each root has equal inline/block size, aspect-ratio 1, flex-shrink 0, border-radius 50% and clipped image content. Keep control sizing independent of avatar sizing.
3. Make the More Profile row flex, vertically centered, with a 32px avatar and text alongside it. Keep the row's touch target at least 44px, preferably 48px. Text gets min-width 0 and wraps or truncates deliberately; long names cannot push the circle outside the row.
4. Preserve Profile inside More on mobile. Keep desktop account access and existing navigation/dirty guards unchanged. The decorative avatar stays aria-hidden; the button retains the readable Profile label.
5. Preserve initials while a photo loads or fails. Verify photo crop, fallback and size stability. Do not change Storage access, signed URL security or account identity persistence for a geometry fix.

Acceptance: More, profile overview and photo form show circles at 320/360/390/430px; width/height differ by at most 1px; a loaded photo or failed request does not shift neighboring text. More opens/closes with touch and keyboard and returns focus to its trigger.

## Batch 2 — Date/time fields and containing forms

Files: `src/styles/base.css`, `forms.css`, `responsive.css`, `profile.css`; `DiaryView.tsx`, `SessionEditorView.tsx`, `ProfileSettingsView.tsx`, `PersonalInfoForm.tsx`, `src/analytics/` and `AnalyticsView.tsx` where applicable.

1. Inventory all date, time and datetime-local controls and reproduce with filled/empty values, including Diary seconds. Inspect input, label, grid track and card bounds separately. Check narrow viewports and desktop with 200% zoom.
2. Ensure each relevant label and grid/flex child can shrink (`min-inline-size: 0`); controls use border-box, `inline-size: 100%`, `max-inline-size: 100%` and `min-inline-size: 0`. Audit existing rules first to avoid duplicate overrides.
3. Give date/time groups a dedicated class. Stack on narrow screens; preserve two columns only when both controls fit. Do not depend solely on `:has(datetime-local)` because Diary uses separate date and time fields.
4. Inspect WebKit native date/time internals in Safari. Add narrowly scoped pseudo-element sizing/alignment only if needed and verified. Keep native pickers, seconds, labels, required/min/max/step and existing parsing/time-zone behavior.
5. Keep input text at least 16px on mobile and a practical 44–48px control height. Preserve full focus indicators and native calendar/clock buttons. Do not conceal the issue with global overflow-x:hidden, smaller text or disabled browser zoom.
6. Fix any analogous controls found in injury dates, analytics ranges and session start/end during the same audit. Do not change ordinary checkbox/slider sizing.

Acceptance: the complete control border stays inside its label/card; calendar/clock icon remains clickable; no page horizontal scroll; changing dates/times still saves the same intended values. Test portrait, landscape and keyboard-open behavior. Safari/WebKit emulation and physical iOS Safari are reported separately.

## Batch 3 — Shared loading screen

New files: `src/app/LoadingScreen.tsx`, `src/styles/loading.css`. Integrate via `src/AuthGate.tsx`, `src/main.tsx`, `src/app/useProfileData.ts`, `src/style.css` and, only where needed, `AppShell.tsx`.

Visual contract:

- Full startup screen uses one opaque background matching `--color-page`, without cards, navigation or old account content showing behind it.
- Center a 40px ring and the label **Wczytywanie…** with a small gap. Reuse theme colors with visible contrast; use a CSS ring, no new icon/animation dependency.
- Use min-height 100dvh with a 100vh fallback, border-box safe-area padding and a fixed-size ring. Respect device cutouts and browser chrome.
- `role="status"`/polite announcement names the loading state once. Mark the ring aria-hidden and the relevant content busy. Reduced-motion preference disables rotation while retaining the visible ring and text.

State transitions:

1. Startup session check: AuthGate shows the full-screen loader until session resolution. Handle rejected promises, stale completions after unmount and stalled requests with a bounded wait (align with the current 15s data-load timeout).
2. No authenticated session: render the normal login screen, not a loader or an error merely because the user is signed out.
3. Authenticated session, first profile load: keep the same full-screen appearance until records are ready. Do not flash login, an empty dashboard or another account's data between phases. Local startup follows the same visual contract.
4. Read failure/timeout: stop loading and show a clear error with Retry and an available sign-out action where appropriate. Spinner must not cover recovery controls indefinitely. Keep diagnostics separate from the neutral loading label.
5. Background refresh with existing ready data: retain the screen and its forms/timer; show a small nonblocking status. A normal save or token refresh must not remount the app, hide entered data or reset the workout timer.
6. Lazy Calendar/History/Analytics/Data: use a content-area variant of the shared loader inside the shell. Do not replace the entire page on each tab change; the full-screen version is for startup only.
7. Preserve account recovery/password update flows, URL navigation, browser Back, request race protection and existing persistence. Do not clear cache, IndexedDB or auth storage to implement loading.

## Batch 4 — Verification, documentation and delivery

1. Extend `e2e/account-profile.spec.ts` or add a mobile avatar regression test with geometric assertions and long names, missing/photo/error states; include More rather than only the bottom navigation.
2. Add `e2e/date-controls.spec.ts`: 320/360/390/430/768/1024/1440px, date/time/datetime-local, empty and populated controls. Assert bounds against the containing card as well as the viewport; a page-level overflow check alone misses clipped controls.
3. Add loading tests with delayed and failed Auth/profile responses: full startup screen, no login flash, signed-out resolution, successful resolution, timeout/retry, account recovery and background refresh without remounting. Verify reduced motion and status semantics. Use synthetic data and public test configuration only.
4. Include at least one completed Diary save and historical-session edit to ensure layout changes preserve parsing and validation. Re-run affected analytics, account and responsive-navigation regressions.
5. Run TypeScript, Vite build and relevant unit/browser suites. Perform visual inspection in Chromium and WebKit when available; state clearly if physical-device checks were not possible.
6. Update `docs/architecture.md` for the shared loading component/state flow and `docs/TESTOWANIE.md` for new test locations. No SQL or backup version change is expected.
7. Remove task-specific temporary tools/results. Do not commit or push automatically. Proposed future commit: `fix: stabilize mobile profile and date controls with unified loading states`.

Guidelines reference: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
