-- Single account-owned profile with configurable rehabilitation and diary settings.
-- Apply after the existing atomic write, canonical RLS, and safe import migrations.
BEGIN;

-- Keep all data when old accounts have multiple profiles: consolidate their rows
-- into one canonical profile (prefer id = auth user id, otherwise oldest row).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.pain_logs'::regclass AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE 'UNIQUE (profile_id, log_date)%'
  LOOP EXECUTE format('ALTER TABLE public.pain_logs DROP CONSTRAINT %I', c.conname); END LOOP;
END $$;
DROP INDEX IF EXISTS public.pain_logs_profile_day_uq;
DROP INDEX IF EXISTS public.pain_logs_profile_id_log_date_key;

-- Keep the staging map for the full editor transaction. Some SQL editors split
-- execution into batches; dropping the temp table at an intermediate commit
-- makes subsequent migration statements fail.
CREATE TEMP TABLE _profile_merge_map ON COMMIT PRESERVE ROWS AS
WITH ranked AS (
  SELECT id, owner_user_id,
    first_value(id) OVER (PARTITION BY owner_user_id ORDER BY (id = owner_user_id) DESC, created_at, id) AS canonical_id
  FROM public.profiles
)
SELECT id AS old_id, canonical_id FROM ranked;

-- Keep the most recently changed timer configuration when profiles merge.
WITH ranked AS (
  SELECT m.canonical_id, t.prepare_seconds, t.move1_seconds, t.hold_seconds,
    t.move2_seconds, t.reps, t.sets, t.rest_seconds, t.sound, t.updated_at,
    row_number() OVER (PARTITION BY m.canonical_id
      ORDER BY t.updated_at DESC, (t.profile_id = m.canonical_id) DESC, t.profile_id) AS row_number
  FROM public.timer_settings t
  JOIN _profile_merge_map m ON m.old_id = t.profile_id
)
INSERT INTO public.timer_settings AS current_settings
  (profile_id,prepare_seconds,move1_seconds,hold_seconds,move2_seconds,reps,sets,rest_seconds,sound,updated_at)
SELECT canonical_id,prepare_seconds,move1_seconds,hold_seconds,move2_seconds,reps,sets,rest_seconds,sound,updated_at
FROM ranked WHERE row_number = 1
ON CONFLICT (profile_id) DO UPDATE SET
  prepare_seconds=excluded.prepare_seconds, move1_seconds=excluded.move1_seconds,
  hold_seconds=excluded.hold_seconds, move2_seconds=excluded.move2_seconds,
  reps=excluded.reps, sets=excluded.sets, rest_seconds=excluded.rest_seconds,
  sound=excluded.sound, updated_at=excluded.updated_at;
DELETE FROM public.timer_settings extra USING _profile_merge_map m
WHERE extra.profile_id = m.old_id AND m.old_id <> m.canonical_id;
UPDATE public.workout_templates t SET profile_id = m.canonical_id
FROM _profile_merge_map m WHERE t.profile_id = m.old_id AND m.old_id <> m.canonical_id;
UPDATE public.workout_sessions s SET profile_id = m.canonical_id
FROM _profile_merge_map m WHERE s.profile_id = m.old_id AND m.old_id <> m.canonical_id;
UPDATE public.pain_logs l SET profile_id = m.canonical_id
FROM _profile_merge_map m WHERE l.profile_id = m.old_id AND m.old_id <> m.canonical_id;
DELETE FROM public.profiles p USING _profile_merge_map m
WHERE p.id = m.old_id AND m.old_id <> m.canonical_id;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_owner_user_id_uq ON public.profiles(owner_user_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_goal smallint NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS check_in_time time NOT NULL DEFAULT time '08:00';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND conname='profiles_weekly_goal_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_weekly_goal_check CHECK (weekly_goal BETWEEN 0 AND 14);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profile_rehab_sites (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 80),
  name varchar(100) NOT NULL CHECK (length(trim(name)) > 0),
  body_area varchar(100) NOT NULL CHECK (length(trim(body_area)) > 0),
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, id),
  CHECK (position >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS profile_rehab_sites_active_position_uq ON public.profile_rehab_sites(profile_id,position) WHERE active;
CREATE UNIQUE INDEX IF NOT EXISTS profile_rehab_sites_name_uq ON public.profile_rehab_sites(profile_id, lower(name)) WHERE active;
CREATE TABLE IF NOT EXISTS public.profile_pain_contexts (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  value text NOT NULL CHECK (length(value) BETWEEN 1 AND 80),
  label varchar(100) NOT NULL CHECK (length(trim(label)) > 0),
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, value),
  CHECK (position >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS profile_pain_contexts_active_position_uq ON public.profile_pain_contexts(profile_id,position) WHERE active;
CREATE UNIQUE INDEX IF NOT EXISTS profile_pain_contexts_label_uq ON public.profile_pain_contexts(profile_id, lower(label)) WHERE active;

-- Seed the old global catalog values under each user's profile.
INSERT INTO public.profile_rehab_sites(profile_id,id,name,body_area,position,active)
SELECT p.id, seed.id, seed.name, seed.body_area, seed.position, true
FROM public.profiles p CROSS JOIN (VALUES
  ('achilles','Achilles','Staw skokowy',0),
  ('pht','PHT',U&'Ty\0142 uda',1),
  ('quadriceps',U&'Czworog\0142owy',U&'Prz\00f3d uda',2)
) AS seed(id,name,body_area,position)
WHERE NOT EXISTS (SELECT 1 FROM public.profile_rehab_sites existing WHERE existing.profile_id=p.id)
ON CONFLICT (profile_id,id) DO NOTHING;
INSERT INTO public.profile_pain_contexts(profile_id,value,label,position,active)
SELECT p.id, seed.value, seed.label, seed.position, true
FROM public.profiles p CROSS JOIN (VALUES
  ('spacer','Spacer',0), ('cwiczenie',U&'\0106wiczenie',1), ('spoczynek','Spoczynek',2), ('inne','Inne',3)
) AS seed(value,label,position)
WHERE NOT EXISTS (SELECT 1 FROM public.profile_pain_contexts existing WHERE existing.profile_id=p.id)
ON CONFLICT (profile_id,value) DO NOTHING;

-- Give pain values a composite FK to the profile-specific body-area catalog.
-- The composite unique index may already exist if a previous attempt stopped
-- after creating it. A unique index is sufficient as the target of the FK.
CREATE UNIQUE INDEX IF NOT EXISTS pain_logs_id_profile_uq
  ON public.pain_logs(id, profile_id);
ALTER TABLE public.pain_log_values ADD COLUMN IF NOT EXISTS profile_id uuid;
UPDATE public.pain_log_values v SET profile_id = l.profile_id
FROM public.pain_logs l WHERE l.id = v.pain_log_id AND v.profile_id IS DISTINCT FROM l.profile_id;
ALTER TABLE public.pain_log_values ALTER COLUMN profile_id SET NOT NULL;
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid='public.pain_log_values'::regclass AND contype='f'
  LOOP EXECUTE format('ALTER TABLE public.pain_log_values DROP CONSTRAINT %I', c.conname); END LOOP;
END $$;
ALTER TABLE public.pain_log_values
  ADD CONSTRAINT pain_values_log_profile_fk FOREIGN KEY (pain_log_id,profile_id)
    REFERENCES public.pain_logs(id,profile_id) ON DELETE CASCADE,
  ADD CONSTRAINT pain_values_profile_site_fk FOREIGN KEY (profile_id,site_id)
    REFERENCES public.profile_rehab_sites(profile_id,id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS pain_log_values_profile_site_idx ON public.pain_log_values(profile_id,site_id);

-- RLS: new config rows are accessible only through their owning account.
ALTER TABLE public.profile_rehab_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_pain_contexts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_rehab_sites_owner ON public.profile_rehab_sites;
CREATE POLICY profile_rehab_sites_owner ON public.profile_rehab_sites TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.owner_user_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.owner_user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS profile_pain_contexts_owner ON public.profile_pain_contexts;
CREATE POLICY profile_pain_contexts_owner ON public.profile_pain_contexts TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.owner_user_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.owner_user_id=(SELECT auth.uid())));
REVOKE ALL ON public.profile_rehab_sites, public.profile_pain_contexts FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_rehab_sites, public.profile_pain_contexts TO authenticated;

CREATE OR REPLACE FUNCTION public.save_profile_settings(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
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
     OR jsonb_array_length(payload->'painContexts') > 30
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(payload->'rehabSites') x WHERE (x->>'active')::boolean) THEN
    RAISE EXCEPTION 'Invalid profile configuration size or no active rehabilitation area' USING ERRCODE='22023';
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
END $$;
REVOKE ALL ON FUNCTION public.save_profile_settings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_profile_settings(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_pain_log(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE pid uuid := (payload->>'profileId')::uuid; logid uuid := (payload->>'id')::uuid; item jsonb;
  context_value text := CASE payload->>'context' WHEN U&'\0107wiczenie' THEN 'cwiczenie' ELSE coalesce(payload->>'context','') END;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id=pid AND owner_user_id=(SELECT auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(payload->'values') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'values') > 50 THEN
    RAISE EXCEPTION 'Invalid pain values' USING ERRCODE='22023';
  END IF;
  IF context_value <> '' AND NOT EXISTS (
    SELECT 1 FROM public.profile_pain_contexts c WHERE c.profile_id=pid AND c.value=context_value
  ) THEN RAISE EXCEPTION 'Unknown or inactive pain context' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.pain_logs WHERE id=logid AND profile_id<>pid) THEN
    RAISE EXCEPTION 'Diary entry unavailable' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.pain_logs(id,profile_id,log_date,measured_at,context,note,updated_at)
  VALUES(logid,pid,(payload->>'date')::date,(payload->>'at')::timestamptz,context_value,
    coalesce(payload->>'note',''),now())
  ON CONFLICT(id) DO UPDATE SET profile_id=excluded.profile_id, log_date=excluded.log_date,
    measured_at=excluded.measured_at, context=excluded.context, note=excluded.note, updated_at=now();
  DELETE FROM public.pain_log_values WHERE pain_log_id=logid;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'values') LOOP
    IF coalesce((item->>'value')::integer,-1) NOT BETWEEN 0 AND 10 THEN RAISE EXCEPTION 'Pain score out of range' USING ERRCODE='22023'; END IF;
    INSERT INTO public.pain_log_values(pain_log_id,profile_id,site_id,value)
    VALUES(logid,pid,item->>'siteId',(item->>'value')::smallint);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.save_pain_log(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_pain_log(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_profile_with_template(payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE new_id uuid := (payload->>'id')::uuid; owner_id uuid := (SELECT auth.uid());
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE owner_user_id=owner_id) THEN
    RAISE EXCEPTION 'Account already has its profile' USING ERRCODE='23505';
  END IF;
  IF payload->>'name' IS NULL OR length(trim(payload->>'name')) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Invalid profile name' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.profiles(id,owner_user_id,name) VALUES(new_id,owner_id,trim(payload->>'name'));
  INSERT INTO public.profile_rehab_sites(profile_id,id,name,body_area,position) VALUES
    (new_id,'achilles','Achilles','Staw skokowy',0),(new_id,'pht','PHT',U&'Ty\0142 uda',1),(new_id,'quadriceps',U&'Czworog\0142owy',U&'Prz\00f3d uda',2);
  INSERT INTO public.profile_pain_contexts(profile_id,value,label,position) VALUES
    (new_id,'spacer','Spacer',0),(new_id,'cwiczenie',U&'\0106wiczenie',1),(new_id,'spoczynek','Spoczynek',2),(new_id,'inne','Inne',3);
  PERFORM public.save_workout_template(payload->'template' || jsonb_build_object('profileId',new_id));
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_profile_with_template(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile_with_template(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_profile_data(target_profile uuid, payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb; entry jsonb; exercise_key text;
BEGIN
  PERFORM 1 FROM public.profiles p WHERE p.id=target_profile AND p.owner_user_id=(SELECT auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(payload->'templates') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload->'sessions') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload->'logs') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid backup arrays' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(payload->'templates')>200 OR jsonb_array_length(payload->'sessions')>10000
     OR jsonb_array_length(payload->'logs')>30000 THEN RAISE EXCEPTION 'Backup exceeds limits' USING ERRCODE='22023'; END IF;
  IF payload ? 'profileSettings' THEN
    PERFORM public.save_profile_settings((payload->'profileSettings') || jsonb_build_object('profileId',target_profile));
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'templates') LOOP
    FOR entry IN SELECT value FROM jsonb_array_elements(item->'entries') LOOP
      exercise_key := entry->>'exerciseId';
      IF NOT EXISTS (SELECT 1 FROM public.exercises WHERE id=exercise_key) THEN RAISE EXCEPTION 'Missing exercise: %',exercise_key USING ERRCODE='23503'; END IF;
    END LOOP;
  END LOOP;
  DELETE FROM public.workout_sessions WHERE profile_id=target_profile;
  DELETE FROM public.workout_templates WHERE profile_id=target_profile;
  DELETE FROM public.pain_logs WHERE profile_id=target_profile;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'templates') LOOP
    PERFORM public.save_workout_template(item || jsonb_build_object('profileId',target_profile));
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'sessions') LOOP
    PERFORM public.save_workout_session(item || jsonb_build_object('profileId',target_profile));
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'logs') LOOP
    PERFORM public.save_pain_log(item || jsonb_build_object('profileId',target_profile));
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.replace_profile_data(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_profile_data(uuid,jsonb) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
