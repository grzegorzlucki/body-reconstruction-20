-- Allow all configured areas to be inactive without removing history.
BEGIN;
CREATE OR REPLACE FUNCTION public.save_profile_settings(payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
DECLARE pid uuid := (payload->>'profileId')::uuid; item jsonb; n integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF length(trim(coalesce(payload->>'name',''))) NOT BETWEEN 1 AND 80
     OR coalesce((payload->>'weeklyGoal')::integer,-1) NOT BETWEEN 0 AND 14
     OR coalesce(payload->>'checkInTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]+)?)?$'
     OR jsonb_typeof(payload->'rehabSites') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload->'painContexts') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid profile settings' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.profiles WHERE id=pid AND owner_user_id=(SELECT auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='42501'; END IF;
  IF jsonb_array_length(payload->'rehabSites') NOT BETWEEN 1 AND 50
     OR jsonb_array_length(payload->'painContexts') > 30 THEN
    RAISE EXCEPTION 'Invalid profile configuration size' USING ERRCODE='22023';
  END IF;
  UPDATE public.profiles SET name=trim(payload->>'name'), weekly_goal=(payload->>'weeklyGoal')::smallint,
    check_in_time=(payload->>'checkInTime')::time, updated_at=now() WHERE id=pid;
  UPDATE public.profile_rehab_sites SET active=false, updated_at=now() WHERE profile_id=pid;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'rehabSites') LOOP
    INSERT INTO public.profile_rehab_sites(profile_id,id,name,body_area,position,active,updated_at)
    VALUES(pid,item->>'id',trim(item->>'name'),trim(item->>'bodyArea'),(item->>'position')::smallint,(item->>'active')::boolean,now())
    ON CONFLICT(profile_id,id) DO UPDATE SET name=excluded.name, body_area=excluded.body_area,
      position=excluded.position, active=excluded.active, updated_at=now();
  END LOOP;
  UPDATE public.profile_pain_contexts SET active=false, updated_at=now() WHERE profile_id=pid;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'painContexts') LOOP
    INSERT INTO public.profile_pain_contexts(profile_id,value,label,position,active,updated_at)
    VALUES(pid,item->>'value',trim(item->>'label'),(item->>'position')::smallint,(item->>'active')::boolean,now())
    ON CONFLICT(profile_id,value) DO UPDATE SET label=excluded.label, position=excluded.position,
      active=excluded.active, updated_at=now();
  END LOOP;
END $_$;
REVOKE ALL ON FUNCTION public.save_profile_settings(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_profile_settings(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
