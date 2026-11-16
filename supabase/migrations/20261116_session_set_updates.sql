-- Apply after 20261115_exercise_timers.sql. Only existing set rows can be
-- changed, and the caller must own the session's profile. One RPC is atomic.
BEGIN;
CREATE OR REPLACE FUNCTION public.update_session_sets(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  target_session uuid := (payload->>'sessionId')::uuid;
  item jsonb;
  changed integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workout_sessions s
    JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.id = target_session AND p.owner_user_id = (SELECT auth.uid())
      AND s.ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Active session unavailable' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(payload->'sets') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Expected set rows' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(payload->'sets') NOT BETWEEN 1 AND 2 THEN
    RAISE EXCEPTION 'Expected one or two set rows' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'sets') LOOP
    UPDATE public.session_sets
    SET weight = (item->>'weight')::numeric,
        reps = (item->>'reps')::smallint,
        done = (item->>'done')::boolean
    WHERE session_id = target_session
      AND exercise_id = item->>'exerciseId'
      AND side = item->>'side'
      AND set_index = (item->>'index')::smallint;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN
      RAISE EXCEPTION 'Set row unavailable' USING ERRCODE = '42501';
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.update_session_sets(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_session_sets(jsonb) TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
