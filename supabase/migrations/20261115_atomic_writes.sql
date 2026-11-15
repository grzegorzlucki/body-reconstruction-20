-- These functions use the caller's privileges and the RLS policies from
-- 20261115_profile_access.sql. Each call is one PostgreSQL transaction.
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
      (template_id, exercise_id, position, set_count, weight, reps, note)
    VALUES ((payload->>'id')::uuid, item->>'exerciseId', i,
      (item->>'sets')::smallint, (item->>'weight')::numeric,
      (item->>'reps')::smallint, item->>'note');
    i := i + 1;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.save_pain_log(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE profile uuid := (payload->>'profileId')::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile AND p.owner_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Profile unavailable';
  END IF;
  INSERT INTO public.pain_logs
    (id, profile_id, log_date, measured_at, context, note)
  VALUES ((payload->>'id')::uuid, profile, (payload->>'date')::date,
    (payload->>'at')::timestamptz, payload->>'context', payload->>'note')
  ON CONFLICT (id) DO UPDATE SET log_date = EXCLUDED.log_date,
    measured_at = EXCLUDED.measured_at, context = EXCLUDED.context,
    note = EXCLUDED.note, updated_at = now()
    WHERE public.pain_logs.profile_id = profile;
  INSERT INTO public.pain_log_values (pain_log_id, site_id, value)
  SELECT (payload->>'id')::uuid, site, (payload->'values'->>(ordinality - 1))::smallint
  FROM unnest(ARRAY['achilles','pht','quadriceps']) WITH ORDINALITY AS s(site, ordinality)
  ON CONFLICT (pain_log_id, site_id) DO UPDATE SET value = EXCLUDED.value;
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
     edited_at, note, decision, rule_version)
  VALUES ((payload->>'id')::uuid, profile, NULLIF(payload->>'templateId','')::uuid,
    payload->>'planName', (payload->>'started')::timestamptz,
    (payload->>'ended')::timestamptz, (payload->>'editedAt')::timestamptz,
    payload->>'note', payload->>'decision', payload->>'ruleVersion')
  ON CONFLICT (id) DO UPDATE SET plan_name = EXCLUDED.plan_name,
    source_template_id = EXCLUDED.source_template_id, started_at = EXCLUDED.started_at,
    ended_at = EXCLUDED.ended_at, edited_at = EXCLUDED.edited_at,
    note = EXCLUDED.note, decision = EXCLUDED.decision,
    rule_version = EXCLUDED.rule_version, updated_at = now()
    WHERE public.workout_sessions.profile_id = profile;
  DELETE FROM public.session_exercises WHERE session_id = (payload->>'id')::uuid;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'plan') LOOP
    INSERT INTO public.session_exercises
      (session_id, exercise_id, exercise_name, unilateral, position,
       planned_sets, planned_weight, planned_reps, note)
    VALUES ((payload->>'id')::uuid, item->>'exerciseId', item->>'exerciseName',
      (item->>'unilateral')::boolean, i, (item->>'sets')::smallint,
      (item->>'weight')::numeric, (item->>'reps')::smallint, item->>'note');
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

REVOKE ALL ON FUNCTION public.save_workout_template(jsonb),
  public.save_pain_log(jsonb), public.save_workout_session(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_workout_template(jsonb),
  public.save_pain_log(jsonb), public.save_workout_session(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_profile_data(target_profile uuid, payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = target_profile AND p.owner_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Profile unavailable';
  END IF;
  DELETE FROM public.workout_sessions WHERE profile_id = target_profile;
  DELETE FROM public.workout_templates WHERE profile_id = target_profile;
  DELETE FROM public.pain_logs WHERE profile_id = target_profile;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'templates') LOOP
    PERFORM public.save_workout_template(item || jsonb_build_object('profileId', target_profile));
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'sessions') LOOP
    PERFORM public.save_workout_session(item || jsonb_build_object('profileId', target_profile));
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'logs') LOOP
    PERFORM public.save_pain_log(item || jsonb_build_object('profileId', target_profile));
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.replace_profile_data(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_profile_data(uuid,jsonb) TO authenticated;
