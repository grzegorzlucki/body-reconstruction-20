-- Deploy before the frontend. Read-only, caller RLS preserved; no service-role access.
BEGIN;
CREATE OR REPLACE FUNCTION public.read_record_page_v1(
  target_profile uuid, resource text, page_size integer DEFAULT 50,
  before_time timestamptz DEFAULT NULL, before_id uuid DEFAULT NULL,
  since_date date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
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
REVOKE ALL ON FUNCTION public.read_record_page_v1(uuid,text,integer,timestamptz,uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_record_page_v1(uuid,text,integer,timestamptz,uuid,date) TO authenticated;
COMMIT;
