-- Existing projects: run after the previous application schema/migrations.
-- Fresh projects: run after 006_verify.sql, then rerun 006 if desired.
BEGIN;
ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS activity_type text NOT NULL DEFAULT 'strength';
ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS activity_name varchar(80);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.workout_sessions'::regclass AND conname='workout_activity_type_check') THEN
    ALTER TABLE public.workout_sessions ADD CONSTRAINT workout_activity_type_check CHECK (activity_type IN ('strength','external'));
    ALTER TABLE public.workout_sessions ADD CONSTRAINT workout_external_details_check CHECK (activity_type<>'external' OR (activity_name IS NOT NULL AND length(trim(activity_name))>0 AND ended_at IS NOT NULL AND ended_at>started_at));
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.save_workout_session_analytics(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE kind text := coalesce(payload->>'activityType','strength'); pid uuid := (payload->>'profileId')::uuid; sid uuid := (payload->>'id')::uuid; tid uuid := nullif(payload->>'templateId','')::uuid;
BEGIN
  IF kind NOT IN ('strength','external') THEN RAISE EXCEPTION 'Invalid activity type' USING ERRCODE='22023'; END IF;
  IF kind='external' AND (length(trim(coalesce(payload->>'activityName',''))) NOT BETWEEN 1 AND 80
    OR jsonb_typeof(payload->'sets') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'sets')<>0
    OR jsonb_typeof(payload->'plan') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'plan')<>0
    OR payload->>'ended' IS NULL OR (payload->>'ended')::timestamptz <= (payload->>'started')::timestamptz) THEN
    RAISE EXCEPTION 'Invalid external activity' USING ERRCODE='22023';
  END IF;
  IF tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.workout_templates WHERE id=tid AND profile_id=pid)
    AND NOT EXISTS (SELECT 1 FROM public.workout_sessions WHERE id=sid AND profile_id=pid AND source_template_id=tid) THEN
    RAISE EXCEPTION 'Plan unavailable' USING ERRCODE='42501';
  END IF;
  PERFORM public.save_workout_session(payload);
  UPDATE public.workout_sessions SET completion_reason=coalesce(nullif(payload->>'completionReason',''),'unspecified'),
    activity_type=kind, activity_name=CASE WHEN kind='external' THEN trim(payload->>'activityName') ELSE NULL END
    WHERE id=sid AND profile_id=pid;
END $$;
-- Import's base function writes sessions before their analytics metadata.
CREATE OR REPLACE FUNCTION public.replace_profile_data_analytics(target_profile uuid,payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item jsonb;
BEGIN
  PERFORM public.replace_profile_data_with_injuries(target_profile,payload);
  IF jsonb_typeof(payload->'profileSettings')='object' THEN PERFORM public.save_profile_settings_with_archiving((payload->'profileSettings')||jsonb_build_object('profileId',target_profile)); END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'sessions') LOOP
    PERFORM public.save_workout_session_analytics(item||jsonb_build_object('profileId',target_profile));
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(payload->'logs') LOOP
    UPDATE public.pain_logs SET session_id=nullif(item->>'sessionId','')::uuid, measurement_phase=coalesce(nullif(item->>'measurementPhase',''),'unspecified')
    WHERE id=(item->>'id')::uuid AND profile_id=target_profile;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.save_workout_session_analytics(jsonb),public.replace_profile_data_analytics(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_workout_session_analytics(jsonb),public.replace_profile_data_analytics(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_external_activity(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF payload->>'activityType' IS DISTINCT FROM 'external' THEN RAISE EXCEPTION 'Expected external activity' USING ERRCODE='22023'; END IF;
  PERFORM public.save_workout_session_analytics(payload);
END $$;
CREATE OR REPLACE FUNCTION public.replace_profile_data_v7(target_profile uuid,payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN PERFORM public.replace_profile_data_analytics(target_profile,payload); END $$;
REVOKE ALL ON FUNCTION public.save_external_activity(jsonb),public.replace_profile_data_v7(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_external_activity(jsonb),public.replace_profile_data_v7(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.read_record_page_v1(target_profile uuid, resource text, page_size integer DEFAULT 50, before_time timestamp with time zone DEFAULT NULL::timestamp with time zone, before_id uuid DEFAULT NULL::uuid, since_date date DEFAULT NULL::date) RETURNS jsonb
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
            AND (latest.activity_type='external' OR EXISTS (SELECT 1 FROM public.session_sets performed WHERE performed.session_id=latest.id AND performed.done AND performed.reps>0))
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
          AND (latest.activity_type='external' OR EXISTS (SELECT 1 FROM public.session_sets performed WHERE performed.session_id=latest.id AND performed.done AND performed.reps>0))
          ORDER BY latest.ended_at DESC,latest.id DESC LIMIT 1))
        AND (before_time IS NULL OR (l.measured_at,l.id)<(before_time,before_id))
      ORDER BY l.measured_at DESC,l.id DESC LIMIT page_size
    ) page;
  END IF;
  RETURN jsonb_build_object('items',result);
END $$;
REVOKE ALL ON FUNCTION public.read_record_page_v1(uuid,text,integer,timestamptz,uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_record_page_v1(uuid,text,integer,timestamptz,uuid,date) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
