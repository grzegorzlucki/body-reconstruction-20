-- Keep removed rehabilitation areas available to historic pain entries and injury links.
ALTER TABLE public.profile_rehab_sites
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Save profile settings and injury links first, then persist the archived state atomically.
CREATE OR REPLACE FUNCTION public.save_profile_settings_with_archiving(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  pid uuid := (payload->>'profileId')::uuid;
BEGIN
  IF jsonb_typeof(payload->'rehabSites') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid rehabilitation areas' USING ERRCODE='22023';
  END IF;

  PERFORM public.save_profile_settings_with_injuries(payload);

  UPDATE public.profile_rehab_sites AS site
  SET archived = coalesce((item.value->>'archived')::boolean, false),
      updated_at = now()
  FROM jsonb_array_elements(payload->'rehabSites') AS item(value)
  WHERE site.profile_id = pid
    AND site.id = item.value->>'id';
END;
$$;

REVOKE ALL ON FUNCTION public.save_profile_settings_with_archiving(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_profile_settings_with_archiving(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
