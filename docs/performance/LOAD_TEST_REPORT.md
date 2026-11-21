# API, data loading and cache performance review

Date: 2026-11-21. Scope: current repository, actual cloud adapter and local HTTP simulation.

## Conclusion

The application cannot currently be described as equally responsive for a few and 125 simultaneous users. The local adapter test completes successful reads without truncation, but request fan-out and full-history transfers increase markedly with account history. The largest simulated workload becomes slow enough to put the application's 15-second loading stages at risk.

**This is not a production database capacity result.** No staging project, test accounts, database connection, Docker, PostgreSQL tools or local Supabase configuration were available. No production load, account creation, SQL execution, health-data extraction or service-role access was performed. Actual PostgreSQL query plans, RLS cost, connection pooling, locks, limits, writes and durability remain unverified.

## What was executed

`npm run test:load` uses `vitest.performance.config.ts` and `src/performance/cloud-load.perf.ts`. A loopback-only HTTP fixture serves the real Supabase JS/PostgREST client used by the real `cloudDb` adapter. AsyncLocalStorage assigns a separate synthetic client to each virtual user. Full refresh follows profiles first, then `readProfileRecords` (sessions, logs and templates in parallel). Counts and ownership-shaped IDs are checked after assembly.

The fixture is intentionally not a database implementation. Its owner scoping is synthetic and does not test real RLS. It returns successful write acknowledgements without persisting data. Simulated users are concurrent asynchronous API actors, not 125 browsers/devices or real authenticated Supabase accounts. Fixture timestamps, exercise IDs and profiles are synthetic; load fixtures target adapter assembly, not full domain validation or UI rendering.

- Baseline: 5, 25, 100, 125 actors; two full refreshes per actor.
- Repeated refresh stress: 125 actors, 20 refreshes each, no think time.
- Small history per actor: 12 sessions, 18 set rows/session, 30 reports with three values each, one template.
- Large history per actor: 150 sessions, 36 set rows/session, 600 reports with three values each, one template. Tested at 5 and 125 actors.
- Slow fixture: 80 ms artificial response delay, 125 actors.
- Writes: 125 actors, 10 pairs each of targeted set update plus diary write (2,500 RPCs).
- Failure: five actors, REST responses 503; failures must propagate rather than produce a partial success.

GET fixtures have a 5 ms delay unless noted. All clients and the single-process fixture share one machine/event loop, CPU, memory and TCP stack. The fixture generates and filters rows in memory; it does not implement PostgreSQL query planning, column projection, RLS, transactions, disk caching or real Auth validation. This becomes a bottleneck at high load. Do not extrapolate these latencies to Supabase or compare them as an SLA. Response bytes exclude HTTP headers, compression, TLS and request bytes. Upload bytes are recorded separately. Repeated runs differ due to scheduling and warm-up.

## Recorded results

See `results.json` for the final measured run and per-endpoint counters. The table below is generated from that run.

| Scenario | Actors | Operations | HTTP requests | Requests/op | Body bytes/op | p50 ms | p95 ms | p99 ms | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-history | 5 | 10 | 140 | 14 | 42785 | 121 | 175 | 175 | 0 |
| small-history | 25 | 50 | 700 | 14 | 43030 | 299 | 398 | 404 | 0 |
| small-history | 100 | 200 | 2800 | 14 | 43153 | 861 | 1131 | 1891 | 0 |
| small-history | 125 | 250 | 3500 | 14 | 43243 | 916 | 1030 | 1097 | 0 |
| repeated-refresh-stress | 125 | 2500 | 35000 | 14 | 43243 | 871 | 977 | 1026 | 0 |
| large-history | 5 | 5 | 250 | 50 | 951447 | 823 | 837 | 837 | 0 |
| large-history | 125 | 125 | 6250 | 50 | 961367 | 16315 | 20587 | 20668 | 0 |
| slow-network | 125 | 125 | 1750 | 14 | 43243 | 1080 | 1239 | 1244 | 0 |
| targeted-set-and-diary-writes | 125 | 1250 | 2500 | 2 | 8 | 172 | 205 | 230 | 0 |
| 503-propagation | 5 | 5 | 25 | 5 | 249 | 7096 | 7096 | 7096 | 5 |

The 503 scenario is an expected error test; its errors must not be combined with successful-load error rates. Percentiles are per virtual-user operation, not per individual HTTP call. The write operation consists of two sequential RPCs. p99 at five actors is effectively the maximum; it has limited statistical value. This is a short stress test, not an hours-long soak test.

## Request and cache findings

1. **Full refresh downloads everything.** `src/app/useProfileData.ts` reads profiles on every refresh, then `src/app/profileRepository.ts` loads all sessions, reports and templates. `cloudDb.ts` follows parents with batched child reads. The small fixture requires 14 HTTP requests and about 43 KB of response bodies per refresh; the large fixture needs 50 requests and about 960 KB. 125 large-account refreshes require 6,250 requests and about 120 MB of uncompressed response bodies. The large fixture is only 150 sessions/600 reports, not an extreme multi-year history.
2. **No API response cache, TTL or in-flight deduplication in these repository reads.** Successive refreshes repeat endpoint reads. React state avoids extra reads during ordinary navigation, which is useful, but this is not a persistent/offline cloud-data cache. No explicit cross-tab cache exists. Dexie is the local adapter/migration source, not a transparent cache of authenticated cloud records.
3. **The service worker only caches same-origin app files.** `vite.config.ts` excludes cross-origin requests, so Supabase data is not cached by the PWA worker. This is appropriate separation for private data. Clearing the app's static cache cannot improve database query performance.
4. **Several mutations trigger expensive reloads.** `main.tsx`'s shared `action()` calls `refresh()` after success and also tries it after failure; `finishExercise` explicitly refreshes. A successful single RPC can therefore cause 14–50 additional HTTP requests. This is source-traced, not an end-to-end measured write-plus-refresh scenario. The fixture write benchmark deliberately measures the two RPCs alone.
5. **Targeted set writes are already good.** `useWorkoutActions.ts` uses `saveCloudSessionSets` for one/two changed rows and updates React state. The test observed one targeted RPC per set update, not replacement of all historic sessions. Missing-RPC fallback still serializes the whole current session. RPC write throughput in the fixture says nothing about transaction locking/durability.
6. **Batching works, but total fan-out is high.** Child IDs are batched by 50 and processed four batches at a time per relationship. Pages are 500 rows. All expected set/report-value rows survived large fixture loading. This avoids N+1 per exercise but does not bound the sum across parallel relationships and 125 clients. Empty relationship reads also cost requests.
7. **A timeout does not cancel the request.** `useProfileData.withTimeout` rejects after 15 seconds but never passes AbortSignal to PostgREST; its request counter suppresses stale React updates without aborting network work. Retrying may overlap old downloads. Actual timeout/cancellation UI was source-inspected, not browser-load-tested.
8. **SDK retries amplify REST failures.** A 503 profile read generates multiple attempts before rejecting (see endpoint counters in results). No new application retry loop was introduced. The injected failure affected REST only; fixture Auth identity resolution remained available. Retries can turn many concurrent users into a burst of extra work during an outage.

## Database findings: source evidence, not live verification

Migration files contain useful indexes: owner profile lookup, templates by profile, sessions `(profile_id, started_at DESC)`, logs `(profile_id, log_date DESC)`, child position constraints and analytics/session-link indexes. This does not establish which migrations/indexes exist on the deployed project, whether statistics are current, or which plans the authenticated RLS role chooses. Do not add speculative duplicate indexes based only on this report.

Use `database-observability.sql` to inspect staging counters, indexes and policies. Capture statistics deltas and representative `EXPLAIN (ANALYZE, BUFFERS)` plans under authenticated test claims; privileged SQL Editor timings alone omit RLS cost. Buffer-cache hit rate is distinct from frontend cache and does not prove low latency.

## Prioritized changes

1. Load only the active session and recent summary on startup; fetch history lazily for the selected period. Preserve import/export as a separate full-data path. Account for analytics follow-up windows across range boundaries.
2. Replace mutation-triggered global reloads with scoped refetch or confirmed server results applied to state. Preserve transaction/error semantics, particularly workout saved but diary failed.
3. Add auth/profile-keyed in-flight deduplication and bounded stale time, explicit invalidation after mutation and clearing on logout/account switch. Do not cache private data in the public/static service-worker cache. An IndexedDB offline cache needs its own ownership, retention and sign-out design.
4. Add AbortSignal propagation, a per-client request concurrency budget and bounded retries with jitter. Cancel stale profile loads; manual retry must not multiply still-running loads.
5. Replace deep offset pagination with stable keyset pagination where appropriate, aligned to measured query plans/indexes. Parent/child snapshots need coherent deletion/edit handling.
6. Then benchmark a profile summary RPC or materialized aggregates. Do not move all history into one enormous RPC: that reduces round trips but keeps the payload/assembly bottleneck.

These are recommendations; production persistence/caching logic was not silently changed during the measurement task.

## Required staging acceptance test

Create an isolated Supabase project with the same migrations, plan/resources, region and database settings. Seed at least 125 separate test Auth users and profiles, not one shared token. Use synthetic histories of small/large and multi-year sizes. Keep test credentials in ignored local files/environment, never commits or reports. Configure test emails without sending 125 real emails. Use normal publishable key and distinct user JWTs for application traffic; admin provisioning credentials stay outside the load client.

Run 5 → 25 → 50 → 100 → 125 actors with gradual ramp-up and realistic think time. Cover cold and repeated startup, navigation, diary saves, targeted unilateral set updates, finish workout, plan saves and concurrent edits. Run each plateau at least 10 minutes and repeat three times. Add a 60-minute soak at expected concurrency, then a bounded short burst. Set an explicit traffic/cost limit and stop on sustained 5xx, lock queues, cross-account results or database saturation.

Record API and operation p50/p95/p99, success rates, request counts/bytes, retry attempts, 429/5xx, RLS isolation failures, read-after-write correctness, data-loss/duplicate checks, CPU/RAM, database connections, lock waits, query plans, disk/cache hit ratios and provider metrics. Use `pg_stat_statements` only if available; it is not assumed installed. Exercise multiple real browser/device sessions separately for rendering responsiveness and token refresh behavior.

Proposed criteria: zero cross-user leakage/data loss; zero silent truncation; unexpected errors below 0.1%; p95 ordinary reads below 1 s and user operations below 2 s on the target network; p99 below 5 s; no growth in connections/locks/memory over the soak; navigation should not reload all history. These are proposed product goals, not claims achieved by this fixture. The owner must validate resource/cost budgets before real staging execution.

## Reproduction

With dependencies available: `npm run test:load`. Output: ignored `test-results/performance/cloud-load.json`. Ordinary `npm test` excludes `.perf.ts`, so CI does not accidentally run the load simulation. No production URL, key, token or `.env` is used; the server binds only to 127.0.0.1 and a random port. Do not point the fixture test at production: it has no remote-target option.

In this workspace, Node/npm are not on PATH; the same test was executed with `.tools/i18n-runtime/node.exe node_modules/vitest/vitest.mjs run --config vitest.performance.config.ts`, with TEMP/TMP set to the local runtime directory. TypeScript and ordinary tests are checked separately.
