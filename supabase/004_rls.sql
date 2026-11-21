-- Fresh Supabase project only. Run complete files in numerical order.
BEGIN;
--
-- Name: exercises exercise_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exercise_catalog_read ON public.exercises FOR SELECT TO authenticated USING (true);



--
-- Name: injury_rehab_sites injury_rehab_sites_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY injury_rehab_sites_owner ON public.injury_rehab_sites TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = injury_rehab_sites.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = injury_rehab_sites.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: pain_log_injuries pain_log_injuries_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pain_log_injuries_owner ON public.pain_log_injuries TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = pain_log_injuries.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = pain_log_injuries.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: pain_logs pain_logs_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pain_logs_owner ON public.pain_logs TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = pain_logs.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = pain_logs.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: pain_sites pain_sites_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pain_sites_read ON public.pain_sites FOR SELECT TO authenticated USING (true);



--
-- Name: pain_log_values pain_values_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pain_values_owner ON public.pain_log_values TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.pain_logs l
     JOIN public.profiles p ON ((p.id = l.profile_id)))
  WHERE ((l.id = pain_log_values.pain_log_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.pain_logs l
     JOIN public.profiles p ON ((p.id = l.profile_id)))
  WHERE ((l.id = pain_log_values.pain_log_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: profile_injuries profile_injuries_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_injuries_owner ON public.profile_injuries TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = profile_injuries.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = profile_injuries.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: profile_pain_contexts profile_pain_contexts_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_pain_contexts_owner ON public.profile_pain_contexts TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = profile_pain_contexts.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = profile_pain_contexts.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: profile_rehab_sites profile_rehab_sites_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_rehab_sites_owner ON public.profile_rehab_sites TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = profile_rehab_sites.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = profile_rehab_sites.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: profiles profiles_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_owner ON public.profiles TO authenticated USING ((owner_user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_user_id = ( SELECT auth.uid() AS uid)));



--
-- Name: session_exercises session_entries_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_entries_owner ON public.session_exercises TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.workout_sessions s
     JOIN public.profiles p ON ((p.id = s.profile_id)))
  WHERE ((s.id = session_exercises.session_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.workout_sessions s
     JOIN public.profiles p ON ((p.id = s.profile_id)))
  WHERE ((s.id = session_exercises.session_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: session_sets session_sets_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_sets_owner ON public.session_sets TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.workout_sessions s
     JOIN public.profiles p ON ((p.id = s.profile_id)))
  WHERE ((s.id = session_sets.session_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.workout_sessions s
     JOIN public.profiles p ON ((p.id = s.profile_id)))
  WHERE ((s.id = session_sets.session_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: workout_sessions sessions_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_owner ON public.workout_sessions TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = workout_sessions.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = workout_sessions.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: template_exercises template_entries_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY template_entries_owner ON public.template_exercises TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.workout_templates t
     JOIN public.profiles p ON ((p.id = t.profile_id)))
  WHERE ((t.id = template_exercises.template_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.workout_templates t
     JOIN public.profiles p ON ((p.id = t.profile_id)))
  WHERE ((t.id = template_exercises.template_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: workout_templates templates_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY templates_owner ON public.workout_templates TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = workout_templates.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = workout_templates.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: timer_settings timer_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY timer_owner ON public.timer_settings TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = timer_settings.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = timer_settings.profile_id) AND (p.owner_user_id = ( SELECT auth.uid() AS uid))))));



--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO authenticated;



--
-- Name: TABLE exercises; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.exercises TO authenticated;



--
-- Name: TABLE injury_rehab_sites; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.injury_rehab_sites TO authenticated;



--
-- Name: TABLE pain_log_injuries; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pain_log_injuries TO authenticated;



--
-- Name: TABLE pain_log_values; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pain_log_values TO authenticated;



--
-- Name: TABLE pain_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pain_logs TO authenticated;



--
-- Name: TABLE pain_sites; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.pain_sites TO authenticated;



--
-- Name: TABLE profile_injuries; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.profile_injuries TO authenticated;



--
-- Name: TABLE profile_pain_contexts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.profile_pain_contexts TO authenticated;



--
-- Name: TABLE profile_rehab_sites; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.profile_rehab_sites TO authenticated;



--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.profiles TO authenticated;



--
-- Name: TABLE session_exercises; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.session_exercises TO authenticated;



--
-- Name: TABLE session_sets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.session_sets TO authenticated;



--
-- Name: TABLE template_exercises; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.template_exercises TO authenticated;



--
-- Name: TABLE timer_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.timer_settings TO authenticated;



--
-- Name: TABLE workout_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workout_sessions TO authenticated;



--
-- Name: TABLE workout_templates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workout_templates TO authenticated;


--
-- PostgreSQL database dump complete
--



COMMIT;
