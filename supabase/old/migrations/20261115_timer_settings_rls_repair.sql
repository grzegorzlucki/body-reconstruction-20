-- Apply in Supabase SQL Editor after the profiles RLS repair.
-- Replace only timer_settings policies; each profile is accessible to its owner.
BEGIN;
DO $$
DECLARE old_policy record;
BEGIN
  FOR old_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'timer_settings'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.timer_settings', old_policy.policyname);
  END LOOP;
END $$;
ALTER TABLE public.timer_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY timer_settings_select_own ON public.timer_settings
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY timer_settings_insert_own ON public.timer_settings
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY timer_settings_update_own ON public.timer_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY timer_settings_delete_own ON public.timer_settings
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timer_settings TO authenticated;
COMMIT;
