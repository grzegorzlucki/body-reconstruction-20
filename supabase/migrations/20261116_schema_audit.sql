-- Read-only audit for Supabase SQL Editor. Results contain schema metadata and
-- counts only; no account, workout, or health records are returned.
SELECT c.table_name, c.column_name, c.data_type, c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('app_users','profiles','exercises','pain_sites',
    'workout_templates','template_exercises','workout_sessions',
    'session_exercises','session_sets','pain_logs','pain_log_values','timer_settings')
ORDER BY c.table_name, c.ordinal_position;

SELECT con.conrelid::regclass AS table_name, con.conname,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
WHERE con.connamespace = 'public'::regnamespace
ORDER BY con.conrelid::regclass::text, con.conname;

SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public'
ORDER BY tablename, indexname;

SELECT 'template_exercises position duplicates' AS issue, count(*) AS groups
FROM (SELECT template_id, position FROM public.template_exercises
  GROUP BY template_id, position HAVING count(*) > 1) d
UNION ALL
SELECT 'session_exercises position duplicates', count(*)
FROM (SELECT session_id, position FROM public.session_exercises
  GROUP BY session_id, position HAVING count(*) > 1) d
UNION ALL
SELECT 'pain_logs profile/day duplicates', count(*)
FROM (SELECT profile_id, log_date FROM public.pain_logs
  GROUP BY profile_id, log_date HAVING count(*) > 1) d
UNION ALL
SELECT 'session_sets without exercise', count(*)
FROM public.session_sets s LEFT JOIN public.session_exercises e
  ON e.session_id = s.session_id AND e.exercise_id = s.exercise_id
WHERE e.session_id IS NULL;
