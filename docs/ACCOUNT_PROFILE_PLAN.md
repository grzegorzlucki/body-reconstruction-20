# Account profile and settings implementation plan

Status: frontend and additive migration/Edge Function implemented locally. TypeScript/build, 30 unit tests and 9 targeted browser scenarios passed. Live Supabase policies, email/password changes, avatar ownership and account deletion still require deployment and manual verification with synthetic accounts. MFA account deletion is deliberately refused until an MFA-aware flow exists. No commits or pushes created.

## Product decisions

- Reuse the existing single account-owned `public.profiles` row. Do not reintroduce profile selection or create a second identity table.
- Desktop/tablet: avatar, display name and disclosure button at the top right of the application header. Show account email inside the expanded panel, not permanently above content.
- Mobile: first bottom navigation item is Profile at the left, followed by Today, Workout, Diary and More. Plans remains available through More and Workout/My plans. Keep labels on all items.
- Profile opens a real page. Desktop account disclosure provides shortcuts to Profile, Rehabilitation, Security, Data and Sign out. Mobile Profile opens the page directly rather than a small dropdown.
- Separate account identity, rehabilitation settings, app preferences and data management. Save each section independently and guard navigation when that section is dirty.
- Use existing sea/sand/coral tokens, dark readable text, outlined focus and at least 44px targets (48px for primary touch actions).

## 1. Entry points and responsive navigation

Files: `src/app/AppShell.tsx`, `src/app/AppNavigation.tsx`, `src/app/navigation.ts`, `src/app/useNavigation.ts`, `src/main.tsx`, `src/styles/shell.css`, `src/styles/responsive.css`.

1. Add Profile to the view model; canonical URL `?view=profile&section=personal`.
2. Support sections `personal`, `rehabilitation`, `security`, `preferences`, `data`, `application`. Preserve `?view=settings` as a compatible alias and preserve unrelated query parameters.
3. Back/Forward must restore the selected section. Invalid sections fall back to personal. Opening menus must not create browser history entries.
4. Replace duplicate sidebar account/settings actions with one coherent entry. Keep Settings alias available until all callers and imported links have been updated.
5. Create `src/app/AccountMenu.tsx`: ordinary disclosure button (`aria-expanded`, `aria-controls`) and links/buttons. Do not assign ARIA menu roles without implementing their full interaction model.
6. Support Enter/Space, Tab, Escape, pointer outside and close after successful navigation. Return focus to the trigger on Escape. Do not close and navigate if the dirty guard is rejected.
7. Position desktop disclosure inside the viewport, below the trigger. Allow wrapping long names/emails and scrolling in short windows; never cover the focused element.
8. Mobile primary order: Profile / Today / Workout / Diary / More. More contains Plans, History, Calendar, Analyses, HSR clock and Data. Use an outlined/filled icon plus text and `aria-current` for active location.
9. Account menu availability must not depend on loading diary/workout data. If loading the database profile fails, security and sign-out remain accessible using authenticated account data.

Acceptance: one clear entry per device; 320px through 1440px layouts; short windows; safe-area padding; keyboard navigation; no overlaps or horizontal document scrolling; existing URLs still work.

## 2. Profile page and personal information

New files: `src/views/AccountProfileView.tsx`, `src/profile/PersonalInfoForm.tsx`, `src/profile/AvatarEditor.tsx`, `src/styles/profile.css`.

- Profile header: avatar/initials, display name, email and verified/pending email state. If name is unavailable, show a neutral Account label without deriving a public full name from email.
- Personal fields: display name (existing `profiles.name`, trimmed 1–80 characters), avatar, time zone. Do not require birth date, phone, address, body weight or other unrelated data.
- Use semantic section navigation: desktop vertical list, mobile full-width section list. The same section content must work at every breakpoint; avoid duplicated forms with independent state.
- Include explicit Save and Cancel per editable section. Do not save on each keystroke. Dirty state compares against the last successful server response, not the initial page forever.
- Show field errors inline, focus the first invalid input and announce save status. Preserve typed values on failed save or background refresh; handle profile/account changes deliberately.
- Update display name/avatar in the header only after successful persistence. Cancel restores the last saved values.
- Never overwrite an existing profile name during sign-in or initialization. Existing profiles keep their IDs, settings and data.

## 3. Rehabilitation settings

Files: `src/views/ProfileSettingsView.tsx`, `src/domain.ts`, `src/app/profileRepository.ts`, `src/cloudDb.ts`.

- Extract rehabilitation configuration from the current monolithic settings page into `src/profile/RehabilitationSettings.tsx`.
- Retain monitored areas, injury episodes, side/dates/status, diary contexts, weekly goal and check-in time. Group the fields into descriptive subsections and keep current data validation.
- Preserve archive semantics and historical labels, injury associations, exercise plans and pain values. Do not replace archived records with new IDs.
- Separate display-name updates from rehabilitation writes. Saving account appearance must not submit stale injuries or area lists.
- Show an optional contextual link from Diary to rehabilitation configuration, returning to the original diary after editing if appropriate.

## 4. Authentication and security

New files: `src/profile/SecuritySettings.tsx`, `src/app/useAccountActions.ts`, `src/account/accountRepository.ts`.
Related files: `src/AuthGate.tsx`, `src/supabase.ts`, `src/main.tsx`.

1. Pass a typed account view model (ID, email, confirmation state, pending email), not an email string named accountId. Keep access/refresh tokens out of presentation props.
2. Email update: show current and requested email; validate email; request Supabase update; show pending confirmation. Display success as a completed change only after Auth confirms it.
3. Password update: use current/recent authentication when required, new password and confirmation, password-manager-compatible autocomplete and paste. Never store passwords in profile tables, logs, backups or local storage.
4. Preserve the existing recovery flow in AuthGate. Use a canonical app redirect URL under the correct GitHub Pages base; avoid carrying arbitrary stale view/section parameters into email actions.
5. Read account changes through the Auth subscription so header and security view update without reloading the page. Do not fetch all workout/diary data after every auth token refresh.
6. Sign-out: await errors, respect pending writes and unsaved form guard, prevent duplicate clicks, clear profile-specific in-memory state. Explain local-device sign-out scope; an all-session sign-out can be a separate explicit action.
7. Do not show an invented list of devices based on a local JWT. Session/device management requires actual backend support; add it only with verified data.
8. If offline, allow reading already loaded profile data and clearly mark server-required actions unavailable. Avoid implying that account changes were saved.

## 5. Data model, migrations and avatars

Existing data: one profile per auth user, `profiles.name`, `profiles.time_zone`, rehabilitation tables, Auth email and confirmation state.

- Keep `auth.users` as the source for authentication identity/email. Keep `public.profiles` as the source for display name, avatar reference and time zone. Do not duplicate email/password into profile rows.
- Inspect the current live schema and functions before writing migration SQL. Add optional `avatar_path` to profiles only if absent. Add user preference fields/table only for actual new preferences; reuse current columns where available.
- Add a focused RPC for account presentation/time-zone updates with authenticated ownership checks. Avoid replacing the rehabilitation save wrappers or allowing arbitrary JSON column updates.
- Use partial updates and current server response to avoid resetting unrelated fields. Match ownership using auth.uid(), not user-provided owner IDs. Test that another user cannot read/write private rows.
- Avatar bucket: private, user-owned path `<auth-user-id>/<random-id>.webp` (or allowed image type), owner-scoped SELECT/INSERT/UPDATE/DELETE policies. Store the path, not an expiring signed URL.
- Allow JPEG/PNG/WebP; reject SVG and arbitrary remote image URLs. Enforce a size limit (initial proposal 2 MB) and allowed MIME types on the bucket; decode/re-encode client uploads, resize to a modest avatar dimension and discard unnecessary metadata.
- Upload replacement first, save the profile path second, then clean up the previous file. On failure keep the previous working avatar and remove the new orphan where possible. Explicit removal falls back to initials.
- Generate authorized short-lived download URLs at runtime; never put private images in service worker precache or JSON export. Initials must work while loading, offline, on expiration and on image errors.
- Migration must be additive and rerunnable; no deletion/consolidation of existing profiles. Update SQL setup instructions and provide one copyable migration when implementing this stage.

## 6. Preferences, data and account deletion

- Preferences: time zone and only supported settings. Weekly goal/check-in remain in rehabilitation. Do not present notifications, translations or theme modes that the app does not implement.
- Time-zone changes require an explicit date convention: retain existing diary dates and timestamps; use a shared formatting helper for account-zone display; define local datetime inputs accordingly. Never silently re-date historical entries.
- Data section links to existing export/import/migration functions. Distinguish deleting application data from deleting the authentication account.
- Export remains compatible with existing backup versions. Introduce a new version only if needed; never export authentication secrets or signed avatar URLs.
- Account deletion requires an authenticated server operation (Supabase Edge Function), never an admin secret in GitHub Pages. Verify the user token server-side, use server-resolved identity, require recent authentication and explicit confirmation, offer export first.
- Audit all foreign keys before choosing delete order. Cover workout/session children, diary/injury associations, areas, settings, profile, avatar objects and auth user. Make retry safe and report partial failures; authentication removal happens only after required cleanup succeeds. Do not promise a cross-service database/storage transaction.
- Application section shows refresh, available update, connection state and version. Only one updater should be mounted per intended placement to avoid duplicate dialogs/statuses.

## 7. Component and persistence boundaries

- AppShell: layout and account entry points.
- AccountMenu: expansion/focus/shortcuts only.
- AccountProfileView: section routing and section layout.
- Section components: their own form draft, validation, save/cancel and dirty reporting.
- useAccountActions/accountRepository: Supabase Auth, avatar and account actions with explicit success/failure contracts.
- Existing profileRepository/cloudDb: profile-owned records and existing training/diary flows.
- main.tsx: compose these APIs; do not grow it into an account settings implementation.
- Local Dexie: retain the current local profile and migration path. Hide Auth-only actions in local mode and label local storage clearly; do not create fake verified accounts or local password fields.
- Make optional account/avatar fields backward compatible for existing IndexedDB data and imports.

## 8. Implementation batches and verification gates

1. Navigation and accessible account entry points: header/disclosure, mobile Profile item, URLs/aliases/Back/dirty guard. Test desktop, mobile and database-loading failure.
2. Profile overview and personal form: existing name/time zone, profile identity view model, independent form lifecycle, ownership and save errors.
3. Additive SQL and avatar storage: focused RPC, bucket/policies, upload/remove/fallback, two-user access denial, legacy data compatibility.
4. Rehabilitation section extraction: retain all validation/archives, prevent unrelated-field resets, regression checks for diary/injuries/plans.
5. Security: email pending/confirmed states, password/recovery, expired session, sign-out failures/dirty guard, allowed redirect paths.
6. Data/privacy/application: existing export/import links, supported preferences, refresh placement, server-side deletion with retries.
7. Final acceptance: TypeScript/build, existing relevant tests plus meaningful new account-flow cases. Verify 320/390/768/1024/1440px, short windows, 200% zoom, keyboard/screen-reader semantics, long names/emails, missing avatar, network/save errors, offline data, auth expiry, Back/Forward and installed-app update. Physical-device checks remain explicitly separate from browser emulation.

Update `docs/architecture.md`, `docs/TESTOWANIE.md`, `docs/supabase/README.md` and README links when the relevant implementation lands. Report results accurately and propose commit names, but do not create commits without a new explicit user instruction.

## Primary references

- https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- https://supabase.com/docs/reference/javascript/auth-updateuser
- https://supabase.com/docs/guides/storage/security/access-control
- Repository skills: `docs/skills/web-design-guidelines/SKILL.md`, `docs/skills/react-best-practices/SKILL.md`.
