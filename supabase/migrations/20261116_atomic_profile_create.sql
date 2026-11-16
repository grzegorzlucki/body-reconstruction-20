-- Apply after 20261116_canonical_rls.sql and 20261115_exercise_timers.sql.
-- Creating a profile and its starter plan succeeds or rolls back together.
BEGIN;
CREATE OR REPLACE FUNCTION public.create_profile_with_template(payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  new_id uuid := (payload->>'id')::uuid;
  owner_id uuid := (SELECT auth.uid());
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF payload->>'name' IS NULL OR length(trim(payload->>'name')) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Invalid profile name' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.profiles (id, owner_user_id, name)
    VALUES (new_id, owner_id, trim(payload->>'name'));
  PERFORM public.save_workout_template(
    (payload->'template') || jsonb_build_object('profileId', new_id));
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_profile_with_template(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile_with_template(jsonb) TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
