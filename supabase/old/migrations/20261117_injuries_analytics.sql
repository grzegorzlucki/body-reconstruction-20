-- Profile-owned injury records and explicit links from diary reports.
-- Apply after 20261116_account_profile_settings.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS public.profile_injuries (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 80),
  name varchar(100) NOT NULL CHECK (length(trim(name)) > 0),
  side text NOT NULL CHECK (side IN ('left','right','both','unspecified')),
  started_on date NOT NULL,
  resolved_on date,
  status text NOT NULL CHECK (status IN ('active','paused','resolved')),
  note varchar(1000) NOT NULL DEFAULT '',
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id,id),
  CHECK (resolved_on IS NULL OR resolved_on >= started_on)
);
CREATE INDEX IF NOT EXISTS profile_injuries_profile_status_idx
  ON public.profile_injuries(profile_id,status,position);

CREATE TABLE IF NOT EXISTS public.injury_rehab_sites (
  profile_id uuid NOT NULL,
  injury_id text NOT NULL,
  site_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id,injury_id,site_id),
  FOREIGN KEY (profile_id,injury_id)
    REFERENCES public.profile_injuries(profile_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (profile_id,site_id)
    REFERENCES public.profile_rehab_sites(profile_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS injury_rehab_sites_profile_site_idx
  ON public.injury_rehab_sites(profile_id,site_id);

CREATE TABLE IF NOT EXISTS public.pain_log_injuries (
  profile_id uuid NOT NULL,
  pain_log_id uuid NOT NULL,
  injury_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id,pain_log_id,injury_id),
  FOREIGN KEY (pain_log_id,profile_id)
    REFERENCES public.pain_logs(id,profile_id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id,injury_id)
    REFERENCES public.profile_injuries(profile_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS pain_log_injuries_profile_injury_idx
  ON public.pain_log_injuries(profile_id,injury_id,pain_log_id);

ALTER TABLE public.profile_injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_rehab_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pain_log_injuries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_injuries_owner ON public.profile_injuries;
CREATE POLICY profile_injuries_owner ON public.profile_injuries TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.owner_user_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.owner_user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS injury_rehab_sites_owner ON public.injury_rehab_sites;
CREATE POLICY injury_rehab_sites_owner ON public.injury_rehab_sites TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.owner_user_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.owner_user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS pain_log_injuries_owner ON public.pain_log_injuries;
CREATE POLICY pain_log_injuries_owner ON public.pain_log_injuries TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.owner_user_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.owner_user_id=(SELECT auth.uid())));

REVOKE ALL ON public.profile_injuries,public.injury_rehab_sites,public.pain_log_injuries FROM anon,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.profile_injuries,public.injury_rehab_sites,public.pain_log_injuries TO authenticated;

-- Save the existing profile settings and its injury records in one RPC transaction.
CREATE OR REPLACE FUNCTION public.save_profile_settings_with_injuries(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE pid uuid := (payload->>'profileId')::uuid; item jsonb; site_value text; injury_key text;
BEGIN
  IF jsonb_typeof(payload->'injuries') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'injuries') > 50 THEN
    RAISE EXCEPTION 'Invalid injuries list' USING ERRCODE='22023';
  END IF;
  PERFORM public.save_profile_settings(payload);
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'injuries') LOOP
    injury_key := item->>'id';
    IF length(coalesce(injury_key,'')) NOT BETWEEN 1 AND 80
       OR length(trim(coalesce(item->>'name',''))) NOT BETWEEN 1 AND 100
       OR item->>'side' NOT IN ('left','right','both','unspecified')
       OR item->>'status' NOT IN ('active','paused','resolved')
       OR jsonb_typeof(item->'siteIds') IS DISTINCT FROM 'array'
       OR jsonb_array_length(item->'siteIds') NOT BETWEEN 1 AND 50 THEN
      RAISE EXCEPTION 'Invalid injury record' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.profile_injuries
      (profile_id,id,name,side,started_on,resolved_on,status,note,position,updated_at)
    VALUES
      (pid,injury_key,trim(item->>'name'),item->>'side',(item->>'startedOn')::date,
       nullif(item->>'resolvedOn','')::date,item->>'status',coalesce(item->>'note',''),
       (item->>'position')::smallint,now())
    ON CONFLICT (profile_id,id) DO UPDATE SET
      name=excluded.name,side=excluded.side,started_on=excluded.started_on,
      resolved_on=excluded.resolved_on,status=excluded.status,note=excluded.note,
      position=excluded.position,updated_at=now();
    DELETE FROM public.injury_rehab_sites WHERE profile_id=pid AND injury_id=injury_key;
    FOR site_value IN SELECT jsonb_array_elements_text(item->'siteIds') LOOP
      INSERT INTO public.injury_rehab_sites(profile_id,injury_id,site_id)
      VALUES(pid,injury_key,site_value);
    END LOOP;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.save_profile_settings_with_injuries(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_profile_settings_with_injuries(jsonb) TO authenticated;

-- Save a report and all selected injury links atomically.
CREATE OR REPLACE FUNCTION public.save_pain_log_with_injuries(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE pid uuid := (payload->>'profileId')::uuid; logid uuid := (payload->>'id')::uuid; injury_key text;
BEGIN
  IF jsonb_typeof(coalesce(payload->'injuryIds','[]'::jsonb)) IS DISTINCT FROM 'array'
     OR jsonb_array_length(coalesce(payload->'injuryIds','[]'::jsonb)) > 50 THEN
    RAISE EXCEPTION 'Invalid injury links' USING ERRCODE='22023';
  END IF;
  PERFORM public.save_pain_log(payload);
  DELETE FROM public.pain_log_injuries WHERE profile_id=pid AND pain_log_id=logid;
  FOR injury_key IN SELECT jsonb_array_elements_text(coalesce(payload->'injuryIds','[]'::jsonb)) LOOP
    INSERT INTO public.pain_log_injuries(profile_id,pain_log_id,injury_id)
    VALUES(pid,logid,injury_key);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.save_pain_log_with_injuries(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_pain_log_with_injuries(jsonb) TO authenticated;

-- Preserve injury settings and report associations when importing a v5 backup.
CREATE OR REPLACE FUNCTION public.replace_profile_data_with_injuries(target_profile uuid,payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb;
BEGIN
  PERFORM public.replace_profile_data(target_profile,payload);
  IF payload ? 'profileSettings' AND payload->'profileSettings' ? 'injuries' THEN
    DELETE FROM public.injury_rehab_sites
    WHERE profile_id=target_profile
      AND injury_id IN (SELECT id FROM public.profile_injuries WHERE profile_id=target_profile);
    DELETE FROM public.profile_injuries WHERE profile_id=target_profile;
    PERFORM public.save_profile_settings_with_injuries(
      (payload->'profileSettings') || jsonb_build_object('profileId',target_profile)
    );
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'logs') LOOP
    PERFORM public.save_pain_log_with_injuries(item || jsonb_build_object('profileId',target_profile));
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.replace_profile_data_with_injuries(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_profile_data_with_injuries(uuid,jsonb) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
