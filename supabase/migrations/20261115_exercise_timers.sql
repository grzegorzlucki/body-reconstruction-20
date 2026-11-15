-- Apply after 20261115_atomic_writes.sql. Timer settings are copied from a
-- template to each session; completed/stopped exercise state belongs to session.
BEGIN;
ALTER TABLE public.template_exercises ADD COLUMN IF NOT EXISTS timer_config jsonb;
ALTER TABLE public.session_exercises ADD COLUMN IF NOT EXISTS timer_config jsonb;
ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS exercise_progress jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.save_workout_template(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb; i integer := 0; profile uuid := (payload->>'profileId')::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile AND p.owner_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Profile unavailable';
  END IF;
  INSERT INTO public.workout_templates (id, profile_id, name)
    VALUES ((payload->>'id')::uuid, profile, payload->>'name')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
    WHERE public.workout_templates.profile_id = profile;
  DELETE FROM public.template_exercises WHERE template_id = (payload->>'id')::uuid;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'entries') LOOP
    INSERT INTO public.template_exercises
      (template_id, exercise_id, position, set_count, weight, reps, note, timer_config)
    VALUES ((payload->>'id')::uuid, item->>'exerciseId', i,
      (item->>'sets')::smallint, (item->>'weight')::numeric,
      (item->>'reps')::smallint, item->>'note', item->'timer');
    i := i + 1;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.save_workout_session(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb; i integer := 0; profile uuid := (payload->>'profileId')::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile AND p.owner_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Profile unavailable';
  END IF;
  INSERT INTO public.workout_sessions
    (id, profile_id, source_template_id, plan_name, started_at, ended_at,
     edited_at, note, decision, rule_version, exercise_progress)
  VALUES ((payload->>'id')::uuid, profile, NULLIF(payload->>'templateId','')::uuid,
    payload->>'planName', (payload->>'started')::timestamptz,
    (payload->>'ended')::timestamptz, (payload->>'editedAt')::timestamptz,
    payload->>'note', payload->>'decision', payload->>'ruleVersion',
    COALESCE(payload->'exerciseProgress', '[]'::jsonb))
  ON CONFLICT (id) DO UPDATE SET plan_name = EXCLUDED.plan_name,
    source_template_id = EXCLUDED.source_template_id, started_at = EXCLUDED.started_at,
    ended_at = EXCLUDED.ended_at, edited_at = EXCLUDED.edited_at,
    note = EXCLUDED.note, decision = EXCLUDED.decision,
    rule_version = EXCLUDED.rule_version, exercise_progress = EXCLUDED.exercise_progress,
    updated_at = now()
    WHERE public.workout_sessions.profile_id = profile;
  DELETE FROM public.session_exercises WHERE session_id = (payload->>'id')::uuid;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'plan') LOOP
    INSERT INTO public.session_exercises
      (session_id, exercise_id, exercise_name, unilateral, position,
       planned_sets, planned_weight, planned_reps, note, timer_config)
    VALUES ((payload->>'id')::uuid, item->>'exerciseId', item->>'exerciseName',
      (item->>'unilateral')::boolean, i, (item->>'sets')::smallint,
      (item->>'weight')::numeric, (item->>'reps')::smallint, item->>'note', item->'timer');
    i := i + 1;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'sets') LOOP
    INSERT INTO public.session_sets
      (session_id, exercise_id, side, set_index, weight, reps, done)
    VALUES ((payload->>'id')::uuid, item->>'exerciseId', item->>'side',
      (item->>'index')::smallint, (item->>'weight')::numeric,
      (item->>'reps')::smallint, (item->>'done')::boolean);
  END LOOP;
END $$;
COMMIT;
