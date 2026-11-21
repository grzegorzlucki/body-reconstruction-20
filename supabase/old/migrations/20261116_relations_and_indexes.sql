-- Apply after taking a backup. The transaction rolls back if existing rows
-- violate a proposed foreign key or unique index. Review the duplicate audit
-- in 20261116_schema_audit.sql before running this migration.
BEGIN;
DO $$
DECLARE old_fk record;
BEGIN
  FOR old_fk IN
    SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.confrelid = 'auth.users'::regclass AND c.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', old_fk.conname);
  END LOOP;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_owner_auth_user_fk
    FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;
DO $$
DECLARE relation record; old_fk record;
BEGIN
  FOR relation IN
    SELECT * FROM (VALUES
      ('workout_templates', 'profiles', 'profile_id', 'id', 'workout_templates_profile_owner_fk'),
      ('workout_sessions', 'profiles', 'profile_id', 'id', 'workout_sessions_profile_owner_fk'),
      ('pain_logs', 'profiles', 'profile_id', 'id', 'pain_logs_profile_owner_fk'),
      ('timer_settings', 'profiles', 'profile_id', 'id', 'timer_settings_profile_owner_fk'),
      ('template_exercises', 'workout_templates', 'template_id', 'id', 'template_exercises_template_fk'),
      ('session_exercises', 'workout_sessions', 'session_id', 'id', 'session_exercises_session_fk'),
      ('session_sets', 'session_exercises', 'session_id, exercise_id', 'session_id, exercise_id', 'session_sets_exercise_fk'),
      ('pain_log_values', 'pain_logs', 'pain_log_id', 'id', 'pain_log_values_log_fk')
    ) AS r(child_table, parent_table, child_columns, parent_columns, constraint_name)
  LOOP
    FOR old_fk IN
      SELECT c.conname FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', relation.child_table)::regclass
        AND c.confrelid = format('public.%I', relation.parent_table)::regclass
        AND c.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', relation.child_table, old_fk.conname);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.%I (%s) ON DELETE CASCADE',
      relation.child_table, relation.constraint_name, relation.child_columns,
      relation.parent_table, relation.parent_columns);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS profiles_owner_user_id_idx
  ON public.profiles (owner_user_id);
CREATE INDEX IF NOT EXISTS workout_templates_profile_id_idx
  ON public.workout_templates (profile_id);
CREATE INDEX IF NOT EXISTS workout_sessions_profile_started_idx
  ON public.workout_sessions (profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS pain_logs_profile_date_idx
  ON public.pain_logs (profile_id, log_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS template_exercises_position_uq
  ON public.template_exercises (template_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS session_exercises_position_uq
  ON public.session_exercises (session_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS pain_logs_profile_day_uq
  ON public.pain_logs (profile_id, log_date);
COMMIT;
