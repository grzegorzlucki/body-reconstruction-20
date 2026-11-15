-- Apply after reviewing against the live schema. Existing policies on these tables
-- must be removed because permissive PostgreSQL policies are combined with OR.
DO $$
DECLARE row record;
BEGIN
  FOR row IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY (ARRAY[
      'app_users','profiles','workout_templates','template_exercises',
      'workout_sessions','session_exercises','session_sets',
      'pain_logs','pain_log_values','timer_settings','exercises','pain_sites'])
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', row.policyname, row.schemaname, row.tablename);
  END LOOP;
END $$;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
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

CREATE POLICY own_user ON public.app_users TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()) AND auth_subject = (SELECT auth.uid())::text);
CREATE POLICY own_profile ON public.profiles TO authenticated
  USING (owner_user_id = (SELECT auth.uid())) WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY own_template ON public.workout_templates TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY own_template_exercise ON public.template_exercises TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_templates t JOIN public.profiles p ON p.id = t.profile_id WHERE t.id = template_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_templates t JOIN public.profiles p ON p.id = t.profile_id WHERE t.id = template_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY own_session ON public.workout_sessions TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY own_session_exercise ON public.session_exercises TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_sessions s JOIN public.profiles p ON p.id = s.profile_id WHERE s.id = session_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_sessions s JOIN public.profiles p ON p.id = s.profile_id WHERE s.id = session_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY own_session_set ON public.session_sets TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_sessions s JOIN public.profiles p ON p.id = s.profile_id WHERE s.id = session_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_sessions s JOIN public.profiles p ON p.id = s.profile_id WHERE s.id = session_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY own_pain_log ON public.pain_logs TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY own_pain_value ON public.pain_log_values TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pain_logs l JOIN public.profiles p ON p.id = l.profile_id WHERE l.id = pain_log_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pain_logs l JOIN public.profiles p ON p.id = l.profile_id WHERE l.id = pain_log_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY own_timer ON public.timer_settings TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.owner_user_id = (SELECT auth.uid())));
CREATE POLICY read_exercises ON public.exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY read_pain_sites ON public.pain_sites FOR SELECT TO authenticated USING (true);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_users, public.profiles,
  public.workout_templates, public.template_exercises, public.workout_sessions,
  public.session_exercises, public.session_sets, public.pain_logs,
  public.pain_log_values, public.timer_settings TO authenticated;
GRANT SELECT ON public.exercises, public.pain_sites TO authenticated;

INSERT INTO public.pain_sites (id, name) VALUES
  ('achilles', 'Achilles'), ('pht', 'PHT'), ('quadriceps', 'Czworogłowy')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.exercises (id, name, detail, unilateral) VALUES
  ('calf','Wspięcia na palce','',true),
  ('rdl','Rumuński martwy ciąg','',false),
  ('curl','Uginanie nóg leżąc','',true),
  ('extension','Prostowanie kolana','',true),
  ('leg-press','Leg press na maszynie','',false),
  ('curl-seated','Uginanie nóg siedząc','',false),
  ('calf-seated','Wspięcia na palce siedząc','',false),
  ('clamshell','Clamshells z gumą','',true),
  ('squat','Przysiad ze sztangą z tyłu','',false),
  ('front-squat','Przysiad przedni','',false),
  ('goblet','Goblet squat','',false),
  ('hack-squat','Hack squat','',false),
  ('split-squat','Split squat','',true),
  ('bulgarian','Przysiad bułgarski','',true),
  ('lunge','Wykroki w przód','',true),
  ('reverse-lunge','Wykroki w tył','',true),
  ('step-up','Wejścia na podest','',true),
  ('deadlift','Klasyczny martwy ciąg','',false),
  ('sumo','Martwy ciąg sumo','',false),
  ('rdl-single','Rumuński martwy ciąg jednonóż','',true),
  ('bridge','Glute bridge obunóż','',false),
  ('bridge-single','Glute bridge jednonóż','',true),
  ('hip-thrust','Hip thrust obunóż','',false),
  ('hip-thrust-single','Hip thrust jednonóż','',true),
  ('abduction','Odwodzenie nóg na maszynie','',false),
  ('adduction','Przywodzenie nóg na maszynie','',false),
  ('calf-press','Wspięcia na palce na suwnicy','',false),
  ('band-abduction','Odwodzenie nogi z gumą','',true),
  ('band-walk','Chodzenie bokiem z gumą','',true),
  ('tibialis','Unoszenie palców stóp','',false)
ON CONFLICT (id) DO NOTHING;
