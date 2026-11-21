-- Apply after relations, catalog seed, canonical RLS, and atomic write functions.
-- Validate referenced lookup rows before replacing profile data. The function
-- call is one PostgreSQL transaction; any error rolls back the replacement.
BEGIN;
CREATE OR REPLACE FUNCTION public.replace_profile_data(target_profile uuid, payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb; entry jsonb; exercise_key text;
BEGIN
  PERFORM 1 FROM public.profiles p
  WHERE p.id = target_profile AND p.owner_user_id = (SELECT auth.uid())
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile unavailable' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(payload->'templates') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload->'sessions') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload->'logs') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid backup arrays' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(payload->'templates') > 200
     OR jsonb_array_length(payload->'sessions') > 10000
     OR jsonb_array_length(payload->'logs') > 30000 THEN
    RAISE EXCEPTION 'Backup exceeds limits' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.pain_sites WHERE id IN ('achilles','pht','quadriceps')) <> 3 THEN
    RAISE EXCEPTION 'Pain site catalog incomplete' USING ERRCODE = '23503';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'templates') LOOP
    FOR entry IN SELECT value FROM jsonb_array_elements(item->'entries') LOOP
      exercise_key := entry->>'exerciseId';
      IF NOT EXISTS (SELECT 1 FROM public.exercises WHERE id = exercise_key) THEN
        RAISE EXCEPTION 'Missing exercise: %', exercise_key USING ERRCODE = '23503';
      END IF;
    END LOOP;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'sessions') LOOP
    FOR entry IN SELECT value FROM jsonb_array_elements(item->'plan') LOOP
      exercise_key := entry->>'exerciseId';
      IF NOT EXISTS (SELECT 1 FROM public.exercises WHERE id = exercise_key) THEN
        RAISE EXCEPTION 'Missing exercise: %', exercise_key USING ERRCODE = '23503';
      END IF;
    END LOOP;
  END LOOP;

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
COMMIT;
NOTIFY pgrst, 'reload schema';
