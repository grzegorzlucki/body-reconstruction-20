-- Apply after 20261116_relations_and_indexes.sql. This replaces policies only
-- on the application tables listed below. Review custom policies before use.
BEGIN;
DO $$
DECLARE old_policy record;
BEGIN
  FOR old_policy IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'profiles','workout_templates','template_exercises',
      'workout_sessions','session_exercises','session_sets',
      'pain_logs','pain_log_values','timer_settings','exercises','pain_sites')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',
      old_policy.policyname, old_policy.schemaname, old_policy.tablename);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pain_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pain_log_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pain_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_owner ON public.profiles TO authenticated
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY templates_owner ON public.workout_templates TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY template_entries_owner ON public.template_exercises TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_templates t JOIN public.profiles p ON p.id = t.profile_id WHERE t.id = template_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_templates t JOIN public.profiles p ON p.id = t.profile_id WHERE t.id = template_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY sessions_owner ON public.workout_sessions TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY session_entries_owner ON public.session_exercises TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_sessions s JOIN public.profiles p ON p.id = s.profile_id WHERE s.id = session_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_sessions s JOIN public.profiles p ON p.id = s.profile_id WHERE s.id = session_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY session_sets_owner ON public.session_sets TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_sessions s JOIN public.profiles p ON p.id = s.profile_id WHERE s.id = session_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_sessions s JOIN public.profiles p ON p.id = s.profile_id WHERE s.id = session_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY pain_logs_owner ON public.pain_logs TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY pain_values_owner ON public.pain_log_values TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pain_logs l JOIN public.profiles p ON p.id = l.profile_id WHERE l.id = pain_log_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pain_logs l JOIN public.profiles p ON p.id = l.profile_id WHERE l.id = pain_log_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY timer_owner ON public.timer_settings TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY exercise_catalog_read ON public.exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY pain_sites_read ON public.pain_sites FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.profiles, public.workout_templates, public.template_exercises,
  public.workout_sessions, public.session_exercises, public.session_sets,
  public.pain_logs, public.pain_log_values, public.timer_settings,
  public.exercises, public.pain_sites FROM anon, PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.workout_templates,
  public.template_exercises, public.workout_sessions, public.session_exercises,
  public.session_sets, public.pain_logs, public.pain_log_values,
  public.timer_settings TO authenticated;
GRANT SELECT ON public.exercises, public.pain_sites TO authenticated;

-- app_users remains for legacy data but is no longer used by the frontend.
DO $$ BEGIN
  IF to_regclass('public.app_users') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON public.app_users FROM anon, authenticated, PUBLIC';
  END IF;
END $$;
COMMIT;
