# Icons and GitHub Pages assets

The maintained source branch is `main`. `gh-pages` contains the generated `dist` output and `.nojekyll`; it does not contain React source, dependencies, `.env` files or development documentation. Pushes to main use the existing Pages workflow to build and publish the output.

## Icons

Edit `public/icon.svg`, then run `npm run generate:icons` with an already installed Playwright Chromium. This regenerates `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png` and `icon-512.png`. The logo uses the app's light background, coral tile and dark arrow. Important artwork stays inside the maskable safe area; the background is opaque for installed apps. No AI image generation, network resources or new rendering dependency is needed.

`index.html` links the SVG/32px browser favicon and 180px Apple icon. The PWA manifest is generated from one definition in `vite.config.ts` for both dev and production. Its scope, start URL and ID follow `VITE_BASE_PATH`. The duplicate `public/manifest.webmanifest` was removed; the published `manifest.webmanifest` remains present.

`public/connection.txt` is the static-delivery diagnostic, renamed from the former Polish filename. Its published URL is `/body-reconstruction-20/connection.txt`. Its English message checks static file delivery only and makes no claim about the database or authentication.

## Validation and publication

1. Build with the normal public Supabase configuration and `VITE_BASE_PATH=/body-reconstruction-20/`. Do not publish a local-mode build over the configured account application.
2. Run `npm run verify:pages -- /body-reconstruction-20/`. The validator fails on missing entry/lazy assets, wrong manifest paths or PNG dimensions, absent precached icons, source/environment files and privileged Supabase key patterns.
3. The workflow repeats validation after copying to its Pages worktree and before publication. Static outputs remain one Git commit.

Local checks for this update: TypeScript/build; the existing unit suite; `node --test scripts/verify-pages.test.mjs`; and `e2e/pages-assets.spec.ts` against the real project base. The browser check verifies metadata/icon delivery, PNG dimensions and offline icon/page loading. Production Auth/database behaviour is outside this asset change.

## Prepared local gh-pages worktree

The update is prepared, without an assistant-created commit or push, in `.tools/gh-pages-update` on branch `gh-pages`. It starts from the fetched `origin/gh-pages`. The old local, unpublished source commit `15d09ad` is preserved at `backup/gh-pages-before-assets-15d09ad`.

The local publication build reuses only the URL and publishable key already present in the deployed branch's public JavaScript; no administrative key was read or introduced. The normal workflow continues to obtain those public values from the repository variables.

Review the publication files with `git -C .tools/gh-pages-update diff --stat` and `git -C .tools/gh-pages-update status --short`. This worktree is ignored by main, so `git add .` on main stages source changes rather than generated publication files. Committing/pushing main yourself lets the existing workflow publish the source update. Do not force-push the old local source history to gh-pages or merge main into the generated branch. An eventual manual publication must also respect the project's prohibition on assistant-created commits until the user changes it.
