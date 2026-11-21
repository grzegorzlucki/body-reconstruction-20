-- Read-only diagnostics. Run manually on an isolated staging database.
-- No user records, access tokens or SQL query texts are returned.
SELECT relname, n_live_tup, n_dead_tup, seq_scan, seq_tup_read, idx_scan,
       last_analyze, last_autoanalyze
FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname;

SELECT tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;

SELECT relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY relname, indexrelname;

SELECT datname, numbackends, xact_commit, xact_rollback, blks_read, blks_hit,
       round(100.0 * blks_hit / NULLIF(blks_hit + blks_read, 0), 2) AS buffer_hit_percent,
       deadlocks, temp_files, temp_bytes, stats_reset
FROM pg_stat_database WHERE datname = current_database();

SELECT state, wait_event_type, wait_event, count(*) AS connections
FROM pg_stat_activity WHERE datname = current_database()
GROUP BY state, wait_event_type, wait_event;

SELECT locktype, mode, granted, count(*) AS locks
FROM pg_locks GROUP BY locktype, mode, granted ORDER BY locks DESC;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- Capture before/after each stage; these are cumulative counters, not latency measurements.
-- Do not reset shared statistics. A high buffer hit ratio does not prove fast queries.
-- EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) must be run separately on representative
-- SELECTs under authenticated role and real fixture JWT claims. SQL Editor's
-- privileged role bypasses RLS and is not a representative application benchmark.
