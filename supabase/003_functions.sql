-- Fresh Supabase project only. Run complete files in numerical order.
BEGIN;
--
-- Name: create_profile_with_template(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_profile_with_template(payload jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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



--
-- Name: delete_account_records(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_account_records(account_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE pid uuid;
BEGIN
  FOR pid IN SELECT id FROM public.profiles WHERE owner_user_id=account_user_id FOR UPDATE LOOP
    DELETE FROM public.pain_log_injuries WHERE profile_id=pid;
    DELETE FROM public.injury_rehab_sites WHERE profile_id=pid;
    DELETE FROM public.profile_injuries WHERE profile_id=pid;
    DELETE FROM public.pain_logs WHERE profile_id=pid;
    DELETE FROM public.workout_sessions WHERE profile_id=pid;
    DELETE FROM public.workout_templates WHERE profile_id=pid;
    DELETE FROM public.timer_settings WHERE profile_id=pid;
    DELETE FROM public.profile_rehab_sites WHERE profile_id=pid;
    DELETE FROM public.profile_pain_contexts WHERE profile_id=pid;
    DELETE FROM public.profiles WHERE id=pid;
  END LOOP;
  -- Fresh schema has no obsolete app_users table; Auth cleanup is external.
END $$;



--
-- Name: detach_session_measurements(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detach_session_measurements() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE public.pain_logs SET session_id=NULL WHERE session_id=OLD.id AND profile_id=OLD.profile_id;
  RETURN OLD;
END $$;



--
-- Name: read_record_page_v1(uuid, text, integer, timestamp with time zone, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.read_record_page_v1(target_profile uuid, resource text, page_size integer DEFAULT 50, before_time timestamp with time zone DEFAULT NULL::timestamp with time zone, before_id uuid DEFAULT NULL::uuid, since_date date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=target_profile AND p.owner_user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='42501';
  END IF;
  IF page_size IS NULL OR page_size<1 OR page_size>100 OR resource NOT IN ('sessions','logs') OR resource IS NULL
    OR ((before_time IS NULL) <> (before_id IS NULL)) THEN
    RAISE EXCEPTION 'Invalid page arguments' USING ERRCODE='22023';
  END IF;
  IF resource='sessions' THEN
    SELECT coalesce(jsonb_agg(row_data ORDER BY started_at DESC,id DESC),'[]'::jsonb) INTO result FROM (
      SELECT s.id,s.started_at,to_jsonb(s)||jsonb_build_object(
        'plans',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.position) FROM public.session_exercises e WHERE e.session_id=s.id),'[]'::jsonb),
        'sets',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.exercise_id,t.side,t.set_index) FROM public.session_sets t WHERE t.session_id=s.id),'[]'::jsonb)
      ) AS row_data FROM public.workout_sessions s WHERE s.profile_id=target_profile
        AND (since_date IS NULL OR s.ended_at IS NULL OR s.started_at >= (since_date::timestamp AT TIME ZONE 'UTC')
          OR s.id=(SELECT latest.id FROM public.workout_sessions latest WHERE latest.profile_id=target_profile AND latest.ended_at IS NOT NULL
            AND EXISTS (SELECT 1 FROM public.session_sets performed WHERE performed.session_id=latest.id AND performed.done AND performed.reps>0)
            ORDER BY latest.ended_at DESC,latest.id DESC LIMIT 1))
        AND (before_time IS NULL OR (s.started_at,s.id)<(before_time,before_id))
      ORDER BY s.started_at DESC,s.id DESC LIMIT page_size
    ) page;
  ELSE
    SELECT coalesce(jsonb_agg(row_data ORDER BY measured_at DESC,id DESC),'[]'::jsonb) INTO result FROM (
      SELECT l.id,l.measured_at,to_jsonb(l)||jsonb_build_object(
        'values',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.site_id) FROM public.pain_log_values v WHERE v.pain_log_id=l.id),'[]'::jsonb),
        'injuries',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.injury_id) FROM public.pain_log_injuries i WHERE i.pain_log_id=l.id),'[]'::jsonb)
      ) AS row_data FROM public.pain_logs l WHERE l.profile_id=target_profile
        AND (since_date IS NULL OR l.log_date>=since_date OR l.session_id=(SELECT latest.id FROM public.workout_sessions latest
          WHERE latest.profile_id=target_profile AND latest.ended_at IS NOT NULL
          AND EXISTS (SELECT 1 FROM public.session_sets performed WHERE performed.session_id=latest.id AND performed.done AND performed.reps>0)
          ORDER BY latest.ended_at DESC,latest.id DESC LIMIT 1))
        AND (before_time IS NULL OR (l.measured_at,l.id)<(before_time,before_id))
      ORDER BY l.measured_at DESC,l.id DESC LIMIT page_size
    ) page;
  END IF;
  RETURN jsonb_build_object('items',result);
END $$;



--
-- Name: replace_profile_data(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_profile_data(target_profile uuid, payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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



--
-- Name: replace_profile_data_analytics(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_profile_data_analytics(target_profile uuid, payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE item jsonb;
BEGIN
  PERFORM public.replace_profile_data_with_injuries(target_profile,payload);
  IF jsonb_typeof(payload->'profileSettings')='object' THEN
    PERFORM public.save_profile_settings_with_archiving((payload->'profileSettings') || jsonb_build_object('profileId',target_profile));
  END IF;
  -- Sessions exist before restoring log references, regardless of base import order.
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'sessions') LOOP
    UPDATE public.workout_sessions SET completion_reason=coalesce(nullif(item->>'completionReason',''),'unspecified')
      WHERE id=(item->>'id')::uuid AND profile_id=target_profile;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'logs') LOOP
    -- Values and injury links were already restored by the base importer.
    UPDATE public.pain_logs SET session_id=nullif(item->>'sessionId','')::uuid,
      measurement_phase=coalesce(nullif(item->>'measurementPhase',''),'unspecified')
      WHERE id=(item->>'id')::uuid AND profile_id=target_profile;
  END LOOP;
END $$;



--
-- Name: replace_profile_data_with_injuries(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_profile_data_with_injuries(target_profile uuid, payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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



--
-- Name: save_pain_log(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_pain_log(payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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



--
-- Name: save_pain_log_analytics(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_pain_log_analytics(payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  -- Existing function validates ownership and writes all values/injury links atomically.
  -- Clear the old relation first, so changing time and phase together is possible.
  UPDATE public.pain_logs SET session_id=NULL
    WHERE id=(payload->>'id')::uuid AND profile_id=(payload->>'profileId')::uuid;
  PERFORM public.save_pain_log_with_injuries(payload);
  UPDATE public.pain_logs SET session_id=nullif(payload->>'sessionId','')::uuid,
    measurement_phase=coalesce(nullif(payload->>'measurementPhase',''),'unspecified')
    WHERE id=(payload->>'id')::uuid AND profile_id=(payload->>'profileId')::uuid;
END $$;



--
-- Name: save_pain_log_with_injuries(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_pain_log_with_injuries(payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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



--
-- Name: save_profile_settings(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_profile_settings(payload jsonb) RETURNS void
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
END $_$;



--
-- Name: save_profile_settings_with_archiving(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_profile_settings_with_archiving(payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
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



--
-- Name: save_profile_settings_with_injuries(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_profile_settings_with_injuries(payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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



--
-- Name: save_workout_session(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_workout_session(payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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



--
-- Name: save_workout_session_analytics(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_workout_session_analytics(payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  PERFORM public.save_workout_session(payload);
  UPDATE public.workout_sessions SET completion_reason=coalesce(nullif(payload->>'completionReason',''),'unspecified')
    WHERE id=(payload->>'id')::uuid AND profile_id=(payload->>'profileId')::uuid;
END $$;



--
-- Name: save_workout_template(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_workout_template(payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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



--
-- Name: update_account_identity(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_account_identity(display_name text, account_time_zone text, new_avatar_path text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF length(trim(coalesce(display_name,''))) NOT BETWEEN 1 AND 80
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=account_time_zone) THEN
    RAISE EXCEPTION 'Invalid account name or time zone' USING ERRCODE='22023';
  END IF;
  IF new_avatar_path IS NOT NULL AND (
    split_part(new_avatar_path,'/',1) <> uid::text
    OR new_avatar_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='avatars' AND name=new_avatar_path)
  ) THEN RAISE EXCEPTION 'Invalid avatar path' USING ERRCODE='42501'; END IF;
  UPDATE public.profiles SET name=trim(display_name), time_zone=account_time_zone,
    avatar_path=new_avatar_path, updated_at=now() WHERE owner_user_id=uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='42501'; END IF;
END $_$;



--
-- Name: update_profile_language(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_profile_language(target_profile_id uuid, language_preference text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF language_preference IS NULL OR language_preference NOT IN ('pl','en','auto') THEN
    RAISE EXCEPTION 'Invalid language preference' USING ERRCODE='22023';
  END IF;
  UPDATE public.profiles SET preferred_language=language_preference, updated_at=now()
    WHERE id=target_profile_id AND owner_user_id=uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='42501'; END IF;
END $$;



--
-- Name: update_session_sets(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_session_sets(payload jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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



--
-- Name: validate_measurement_session(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_measurement_session() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE session_row public.workout_sessions;
BEGIN
  IF NEW.session_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO session_row FROM public.workout_sessions
    WHERE id=NEW.session_id AND profile_id=NEW.profile_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trening nie należy do profilu pomiaru' USING ERRCODE='23503'; END IF;
  IF (NEW.measurement_phase='pre' AND NEW.measured_at>session_row.started_at)
    OR (NEW.measurement_phase='during' AND (NEW.measured_at<session_row.started_at OR NEW.measured_at>session_row.ended_at))
    OR (NEW.measurement_phase IN ('post','followup') AND (session_row.ended_at IS NULL OR NEW.measured_at<session_row.ended_at)) THEN
    RAISE EXCEPTION 'Godzina pomiaru nie pasuje do fazy treningu' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END $$;



--
-- Name: validate_session_measurement_times(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_session_measurement_times() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pain_logs l WHERE l.session_id=NEW.id AND l.profile_id=NEW.profile_id AND (
    (l.measurement_phase='pre' AND l.measured_at>NEW.started_at)
    OR (l.measurement_phase='during' AND (l.measured_at<NEW.started_at OR l.measured_at>NEW.ended_at))
    OR (l.measurement_phase IN ('post','followup') AND (NEW.ended_at IS NULL OR l.measured_at<NEW.ended_at))
  )) THEN
    RAISE EXCEPTION 'Zmiana godzin treningu koliduje z powiązanymi pomiarami. Najpierw popraw ich fazę lub relację.' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;


--
-- Name: workout_sessions detach_session_measurements; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER detach_session_measurements BEFORE DELETE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION public.detach_session_measurements();



--
-- Name: pain_logs validate_measurement_session; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_measurement_session BEFORE INSERT OR UPDATE OF session_id, profile_id, measurement_phase, measured_at ON public.pain_logs FOR EACH ROW EXECUTE FUNCTION public.validate_measurement_session();



--
-- Name: workout_sessions validate_session_measurement_times; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_session_measurement_times BEFORE UPDATE OF started_at, ended_at ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION public.validate_session_measurement_times();



REVOKE ALL ON FUNCTION public.create_profile_with_template(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_account_records(account_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.detach_session_measurements() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.read_record_page_v1(target_profile uuid, resource text, page_size integer, before_time timestamp with time zone, before_id uuid, since_date date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.replace_profile_data(target_profile uuid, payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.replace_profile_data_analytics(target_profile uuid, payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.replace_profile_data_with_injuries(target_profile uuid, payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_pain_log(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_pain_log_analytics(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_pain_log_with_injuries(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_profile_settings(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_profile_settings_with_archiving(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_profile_settings_with_injuries(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_workout_session(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_workout_session_analytics(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_workout_template(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_account_identity(display_name text, account_time_zone text, new_avatar_path text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_profile_language(target_profile_id uuid, language_preference text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_session_sets(payload jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_measurement_session() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_session_measurement_times() FROM PUBLIC, anon, authenticated, service_role;
--
-- Name: FUNCTION create_profile_with_template(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_profile_with_template(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_profile_with_template(payload jsonb) TO authenticated;



--
-- Name: FUNCTION delete_account_records(account_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_account_records(account_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_account_records(account_user_id uuid) TO service_role;



--
-- Name: FUNCTION detach_session_measurements(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.detach_session_measurements() FROM PUBLIC;



--
-- Name: FUNCTION read_record_page_v1(target_profile uuid, resource text, page_size integer, before_time timestamp with time zone, before_id uuid, since_date date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.read_record_page_v1(target_profile uuid, resource text, page_size integer, before_time timestamp with time zone, before_id uuid, since_date date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.read_record_page_v1(target_profile uuid, resource text, page_size integer, before_time timestamp with time zone, before_id uuid, since_date date) TO authenticated;



--
-- Name: FUNCTION replace_profile_data(target_profile uuid, payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace_profile_data(target_profile uuid, payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.replace_profile_data(target_profile uuid, payload jsonb) TO authenticated;



--
-- Name: FUNCTION replace_profile_data_analytics(target_profile uuid, payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace_profile_data_analytics(target_profile uuid, payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.replace_profile_data_analytics(target_profile uuid, payload jsonb) TO authenticated;



--
-- Name: FUNCTION replace_profile_data_with_injuries(target_profile uuid, payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace_profile_data_with_injuries(target_profile uuid, payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.replace_profile_data_with_injuries(target_profile uuid, payload jsonb) TO authenticated;



--
-- Name: FUNCTION save_pain_log(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_pain_log(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_pain_log(payload jsonb) TO authenticated;



--
-- Name: FUNCTION save_pain_log_analytics(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_pain_log_analytics(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_pain_log_analytics(payload jsonb) TO authenticated;



--
-- Name: FUNCTION save_pain_log_with_injuries(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_pain_log_with_injuries(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_pain_log_with_injuries(payload jsonb) TO authenticated;



--
-- Name: FUNCTION save_profile_settings(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_profile_settings(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_profile_settings(payload jsonb) TO authenticated;



--
-- Name: FUNCTION save_profile_settings_with_archiving(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_profile_settings_with_archiving(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_profile_settings_with_archiving(payload jsonb) TO authenticated;



--
-- Name: FUNCTION save_profile_settings_with_injuries(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_profile_settings_with_injuries(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_profile_settings_with_injuries(payload jsonb) TO authenticated;



--
-- Name: FUNCTION save_workout_session(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_workout_session(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_workout_session(payload jsonb) TO authenticated;



--
-- Name: FUNCTION save_workout_session_analytics(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_workout_session_analytics(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_workout_session_analytics(payload jsonb) TO authenticated;



--
-- Name: FUNCTION save_workout_template(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_workout_template(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_workout_template(payload jsonb) TO authenticated;



--
-- Name: FUNCTION update_account_identity(display_name text, account_time_zone text, new_avatar_path text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_account_identity(display_name text, account_time_zone text, new_avatar_path text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_account_identity(display_name text, account_time_zone text, new_avatar_path text) TO authenticated;



--
-- Name: FUNCTION update_profile_language(target_profile_id uuid, language_preference text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_profile_language(target_profile_id uuid, language_preference text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_profile_language(target_profile_id uuid, language_preference text) TO authenticated;



--
-- Name: FUNCTION update_session_sets(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_session_sets(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_session_sets(payload jsonb) TO authenticated;



--
-- Name: FUNCTION validate_measurement_session(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_measurement_session() FROM PUBLIC;



--
-- Name: FUNCTION validate_session_measurement_times(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_session_measurement_times() FROM PUBLIC;



COMMIT;
