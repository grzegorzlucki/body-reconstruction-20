-- Apply in Supabase SQL Editor after the profiles RLS repair.
-- Keep plan headers and exercise rows accessible only to the profile owner.
BEGIN;
DO $$
DECLARE old_policy record;
BEGIN
  FOR old_policy IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('workout_templates', 'template_exercises')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',
      old_policy.policyname, old_policy.schemaname, old_policy.tablename);
  END LOOP;
END $$;

ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY workout_templates_select_own ON public.workout_templates
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY workout_templates_insert_own ON public.workout_templates
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY workout_templates_update_own ON public.workout_templates
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY workout_templates_delete_own ON public.workout_templates
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));

CREATE POLICY template_exercises_select_own ON public.template_exercises
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.workout_templates t
      JOIN public.profiles p ON p.id = t.profile_id
      WHERE t.id = template_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY template_exercises_insert_own ON public.template_exercises
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.workout_templates t
      JOIN public.profiles p ON p.id = t.profile_id
      WHERE t.id = template_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY template_exercises_update_own ON public.template_exercises
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_templates t
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.id = template_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_templates t
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.id = template_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY template_exercises_delete_own ON public.template_exercises
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.workout_templates t
      JOIN public.profiles p ON p.id = t.profile_id
      WHERE t.id = template_id AND p.owner_user_id = (SELECT auth.uid())));

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.workout_templates, public.template_exercises TO authenticated;
COMMIT;
