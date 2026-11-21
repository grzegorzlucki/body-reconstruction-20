-- Requires the migrations through 20261120_unilateral_timer.sql.
-- Additive and rerunnable: existing reports are not heuristically linked.
BEGIN;
ALTER TABLE public.pain_logs ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE public.pain_logs ADD COLUMN IF NOT EXISTS measurement_phase text NOT NULL DEFAULT 'unspecified';
ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS completion_reason text NOT NULL DEFAULT 'unspecified';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.pain_logs'::regclass AND conname='pain_logs_measurement_phase_check') THEN
    ALTER TABLE public.pain_logs ADD CONSTRAINT pain_logs_measurement_phase_check
      CHECK (measurement_phase IN ('unspecified','daily','pre','during','post','followup'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.workout_sessions'::regclass AND conname='workout_sessions_completion_reason_check') THEN
    ALTER TABLE public.workout_sessions ADD CONSTRAINT workout_sessions_completion_reason_check
      CHECK (completion_reason IN ('unspecified','pain','fatigue','time','other'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS workout_sessions_id_profile_analytics_uq ON public.workout_sessions(id,profile_id);
CREATE INDEX IF NOT EXISTS pain_logs_profile_session_measured_idx ON public.pain_logs(profile_id,session_id,measured_at);
CREATE INDEX IF NOT EXISTS pain_logs_profile_measured_idx ON public.pain_logs(profile_id,measured_at);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.pain_logs'::regclass AND conname='pain_logs_session_profile_fk') THEN
    ALTER TABLE public.pain_logs ADD CONSTRAINT pain_logs_session_profile_fk
      FOREIGN KEY (session_id,profile_id) REFERENCES public.workout_sessions(id,profile_id);
  END IF;
END $$;

-- Only the session reference is cleared: ownership and measurements survive deletion.
-- Definer is needed for cascaded account deletion; scope is the row being deleted.
CREATE OR REPLACE FUNCTION public.detach_session_measurements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.pain_logs SET session_id=NULL WHERE session_id=OLD.id AND profile_id=OLD.profile_id;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.detach_session_measurements() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS detach_session_measurements ON public.workout_sessions;
CREATE TRIGGER detach_session_measurements BEFORE DELETE ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.detach_session_measurements();

-- Validate links for direct table writes as well as RPC callers.
CREATE OR REPLACE FUNCTION public.validate_measurement_session()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
REVOKE ALL ON FUNCTION public.validate_measurement_session() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS validate_measurement_session ON public.pain_logs;
CREATE TRIGGER validate_measurement_session BEFORE INSERT OR UPDATE OF session_id,profile_id,measurement_phase,measured_at
  ON public.pain_logs FOR EACH ROW EXECUTE FUNCTION public.validate_measurement_session();

CREATE OR REPLACE FUNCTION public.validate_session_measurement_times()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
REVOKE ALL ON FUNCTION public.validate_session_measurement_times() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS validate_session_measurement_times ON public.workout_sessions;
CREATE TRIGGER validate_session_measurement_times BEFORE UPDATE OF started_at,ended_at ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_session_measurement_times();

CREATE OR REPLACE FUNCTION public.save_pain_log_analytics(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
CREATE OR REPLACE FUNCTION public.save_workout_session_analytics(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM public.save_workout_session(payload);
  UPDATE public.workout_sessions SET completion_reason=coalesce(nullif(payload->>'completionReason',''),'unspecified')
    WHERE id=(payload->>'id')::uuid AND profile_id=(payload->>'profileId')::uuid;
END $$;
CREATE OR REPLACE FUNCTION public.replace_profile_data_analytics(target_profile uuid,payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
REVOKE ALL ON FUNCTION public.save_pain_log_analytics(jsonb),public.save_workout_session_analytics(jsonb),public.replace_profile_data_analytics(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_pain_log_analytics(jsonb),public.save_workout_session_analytics(jsonb),public.replace_profile_data_analytics(uuid,jsonb) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
