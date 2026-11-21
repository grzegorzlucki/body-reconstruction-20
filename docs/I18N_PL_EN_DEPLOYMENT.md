# Polish and English release

## Deployment order

1. Back up the Supabase project as usual.
2. Run the complete file `supabase/old/migrations/20261122_profile_language.sql` in Supabase SQL Editor. This follows the existing migrations through `20261121_analytics_links.sql`. Pages does not execute SQL.
3. Deploy the frontend through the existing GitHub Actions workflow. No additional environment variables, translation API keys or secrets are needed.
4. Activate the updated PWA with **Odśwież aplikację / Refresh application**. Both dictionaries are bundled and cached with the application.

The migration adds `profiles.preferred_language` (`pl`, `en`, `auto`) and `update_profile_language(target_profile_id uuid, language_preference text)`. Existing profiles get Polish; newly inserted profiles default to automatic detection. Re-execution preserves saved choices. The RPC is SECURITY INVOKER, requires authentication, checks both profile ID and owner, and keeps existing RLS in force.

## Product behaviour

- Before sign-in: the language selector is available on the authentication screens, including session failure/retry.
- After sign-in: **My profile → Preferences → Application language**. On mobile, enter through **More → Profile**.
- Automatic selection checks `navigator.languages` in order, accepts Polish/English regional variants and falls back to Polish. English formatting uses `en-GB`; the week still starts on Monday and weights remain in kg.
- Changing language rerenders the existing components. It does not change route IDs, restart the timer, remount App, sign out, discard drafts or reload profile records.
- Guest and profile caches have different versioned keys. The database preference takes precedence when loading an account, except for a locally pending selection that failed to save. Such a selection displays a retry message in Preferences.
- Writes are serialised per profile. An old response cannot replace the latest UI choice. The RPC explicitly targets a profile, so a queued request cannot change another signed-in account.
- New cloud profiles adopt an explicit pre-login choice; existing accounts retain their account preference.
- Stored profile/plan/area/injury/context names and notes are not automatically translated. The exercise catalogue, system labels and enum presentation are translated. Search accepts both Polish and English exercise names.
- UTC timestamps, calendar date keys, kg values, internal `L/P/both`, backup version 6 and database IDs remain unchanged. English presents the right side as R; the stored value is still P.
- The typed account-deletion phrase is localised, but the existing server token remains `USUŃ KONTO`. Changing language clears the typed phrase, not the password.
- Dexie upgrades from version 7 to 8, adding Polish to existing profiles without rewriting history. Account language is not included in rehabilitation backups and is not overwritten by importing one.

## Auth emails: separate Supabase configuration

Frontend deployment does not configure Supabase email templates. Bilingual templates for the existing signup, recovery and email-change flows are in `supabase/email-templates/`. Paste each file into the corresponding Authentication → Email templates entry in the Supabase dashboard. Use bilingual subjects as well, for example **Potwierdź e-mail / Confirm email**.

The templates intentionally contain both languages. This also supports old accounts without language metadata and password recovery initiated before authentication. They use the existing Supabase `ConfirmationURL`; do not replace the token/redirect mechanism. Keep the deployed Pages URL in the permitted redirect URLs. Test SMTP delivery, expiration, recovery and email confirmation on a staging project; those are not exercised by local tests.

## Code map and implementation decisions

- `src/i18n/translations.ts`: reviewed Polish/English UI pairs, including catalogue text and accessibility labels.
- `src/i18n/config.ts`: synchronous bundled resources, English semantic resource keys indexed by source labels, locale detection, safe storage, transient message descriptors and plural rules.
- `src/i18n/LanguageProvider.tsx`: provider above AuthGate/App, HTML language/description, automatic detection and account preference application.
- `src/i18n/formatters.ts`: cached locale-aware number presentation. Dates use the same effective locale with their existing time-zone rules.
- `src/profile/LanguageSettings.tsx`: immediate UI selection, save/retry feedback and serial writes without refreshing all records.
- `src/account/accountRepository.ts`: focused RPC and write queue.
- Existing navigation IDs are intentionally retained as internal constants. Only their visible labels are translated. This avoids rewriting every guard and preserves old URLs; navigation never compares translated labels.
- UI pairs are kept in one typed resource module rather than many namespace JSON files. This release bundles both small language resources together for reliable offline switching. No translation service or DOM text replacement is used.
- `message()` descriptors exist only in transient notices/confirmations; never persist them as user text. Rendering uses React text escaping, not HTML interpolation.

When adding UI copy, add both language values and use `ui()` in a subscribed component. For dynamic messages stored in state, use `message(source, values)` and translate when rendering. Do not wrap user-defined names/notes in translation lookups. Do not translate option values or other wire-format identifiers.

## Verification and limits

Local result (18 November 2026): TypeScript and production build passed; 59 unit tests and 45 selected Chromium browser scenarios passed. Browser coverage includes English diary, analytics and profile screens at 320, 390, 1024, 1440 and 1920 px, plus the existing Polish layout suite. Main JavaScript bundle: approximately 644 kB minified / 200 kB gzip; Vite reports the >500 kB chunk-size warning. Heavy views remain lazy-loaded. This warning is not a failed build; further chunk splitting can be measured separately.

Automated checks cover TypeScript/build, resource and interpolation completeness, plural forms, language detection, Dexie upgrade and backup compatibility. Browser tests cover persisted selection, lazy views, bilingual search, mobile layout, and switching while a timer runs or a plan has unsaved input. Existing Polish account, timer, analytics and mobile scenarios are retained.

Before production acceptance, additionally verify real Supabase account A/B ownership and rapid language writes, reload on a second device, language retry after denied/offline writes, and actual authentication emails. Chromium mobile emulation does not certify physical iOS Safari. SQL and SMTP deployment are manual and have not been applied to the remote project by this change.
