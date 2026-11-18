# Code Generation and Maintenance Practices

These practices apply when generating, changing, or reviewing code in this repository.

## Use the Architecture Map

- Read `docs/architecture.md` before making code changes. Use it to find the relevant modules, data flow, and tests.
- Keep `docs/architecture.md` accurate. Update it in the same change whenever a change adds, removes, renames, or materially changes a module, feature flow, data model, persistence behavior, deployment setup, or test location described there.
- When a code change does not affect the architecture map, do not edit it just for the sake of making a documentation change.

## Fit the Existing Project

- Follow the existing React, TypeScript, Vite, Dexie, and Zod patterns. Prefer the smallest change that fits the current structure.
- Keep domain rules and validation in `src/domain.ts` when they do not depend on React or browser storage. Keep persistence and migrations in `src/db.ts`.
- Keep UI responsibilities in the existing components; avoid growing `src/main.tsx` with logic that belongs in a focused component or domain helper.
- Preserve local-first behavior and the user's control over their data. Do not add a backend, analytics, or synchronization without an explicit product requirement.
- Preserve compatibility with existing IndexedDB data and supported backup versions. Treat schema changes and imports as data-integrity-sensitive operations.

## Make Changes Safely

- Inspect relevant implementation and tests before editing. Search for all call sites when changing shared types, schemas, helpers, or component props.
- Keep TypeScript strict and validate untrusted input with the existing Zod schemas.
- Preserve accessibility and mobile behavior, including keyboard and touch interactions where relevant.
- Do not put personal or real health data in source, tests, fixtures, logs, or documentation. Use synthetic test data.
- Keep deployment paths consistent. For GitHub Pages, ensure `VITE_BASE_PATH` matches the repository URL path and generated asset URLs.

## Verification and Documentation

- Run the checks relevant to the change when the user asks for verification or when verification is part of the task. Common commands are `npm test`, `npm run build`, and `npx playwright test`.
- Report which checks were run and their outcome. Do not imply that a check passed if it was not run.
- Update user-facing documentation when behavior, setup, privacy, backup, or deployment instructions change. Keep `README.md` and `docs/TESTOWANIE.md` aligned with the implementation where applicable.
