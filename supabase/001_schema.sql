-- Fresh Supabase project only. Run complete files in numerical order.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.profiles') IS NOT NULL THEN RAISE EXCEPTION 'Application schema already exists. This installer is for a fresh project only.'; END IF;
 IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL THEN RAISE EXCEPTION 'A Supabase project with Auth and Storage is required.'; END IF;
END $$;
--
-- Name: exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercises (
    id text NOT NULL,
    name text NOT NULL,
    detail text DEFAULT ''::text NOT NULL,
    equipment text,
    unilateral boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: injury_rehab_sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.injury_rehab_sites (
    profile_id uuid NOT NULL,
    injury_id text NOT NULL,
    site_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: pain_log_injuries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pain_log_injuries (
    profile_id uuid NOT NULL,
    pain_log_id uuid NOT NULL,
    injury_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: pain_log_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pain_log_values (
    pain_log_id uuid NOT NULL,
    site_id text NOT NULL,
    value smallint NOT NULL,
    profile_id uuid NOT NULL,
    CONSTRAINT pain_log_values_value_check CHECK (((value >= 0) AND (value <= 10)))
);



--
-- Name: pain_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pain_logs (
    id uuid NOT NULL,
    profile_id uuid NOT NULL,
    log_date date NOT NULL,
    measured_at timestamp with time zone NOT NULL,
    context character varying DEFAULT ''::character varying NOT NULL,
    note character varying DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    session_id uuid,
    measurement_phase text DEFAULT 'unspecified'::text NOT NULL,
    CONSTRAINT pain_logs_measurement_phase_check CHECK ((measurement_phase = ANY (ARRAY['unspecified'::text, 'daily'::text, 'pre'::text, 'during'::text, 'post'::text, 'followup'::text])))
);



--
-- Name: pain_sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pain_sites (
    id text NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL
);



--
-- Name: profile_injuries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_injuries (
    profile_id uuid NOT NULL,
    id text NOT NULL,
    name character varying(100) NOT NULL,
    side text NOT NULL,
    started_on date NOT NULL,
    resolved_on date,
    status text NOT NULL,
    note character varying(1000) DEFAULT ''::character varying NOT NULL,
    "position" smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_injuries_check CHECK (((resolved_on IS NULL) OR (resolved_on >= started_on))),
    CONSTRAINT profile_injuries_id_check CHECK (((length(id) >= 1) AND (length(id) <= 80))),
    CONSTRAINT profile_injuries_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT profile_injuries_position_check CHECK ((("position" >= 0) AND ("position" <= 100))),
    CONSTRAINT profile_injuries_side_check CHECK ((side = ANY (ARRAY['left'::text, 'right'::text, 'both'::text, 'unspecified'::text]))),
    CONSTRAINT profile_injuries_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'resolved'::text])))
);



--
-- Name: profile_pain_contexts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_pain_contexts (
    profile_id uuid NOT NULL,
    value text NOT NULL,
    label character varying(100) NOT NULL,
    "position" smallint NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_pain_contexts_label_check CHECK ((length(TRIM(BOTH FROM label)) > 0)),
    CONSTRAINT profile_pain_contexts_position_check CHECK ((("position" >= 0) AND ("position" <= 100))),
    CONSTRAINT profile_pain_contexts_position_check1 CHECK (("position" >= 0)),
    CONSTRAINT profile_pain_contexts_value_check CHECK (((length(value) >= 1) AND (length(value) <= 80)))
);



--
-- Name: profile_rehab_sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_rehab_sites (
    profile_id uuid NOT NULL,
    id text NOT NULL,
    name character varying(100) NOT NULL,
    body_area character varying(100) NOT NULL,
    "position" smallint NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    CONSTRAINT profile_rehab_sites_body_area_check CHECK ((length(TRIM(BOTH FROM body_area)) > 0)),
    CONSTRAINT profile_rehab_sites_id_check CHECK (((length(id) >= 1) AND (length(id) <= 80))),
    CONSTRAINT profile_rehab_sites_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT profile_rehab_sites_position_check CHECK ((("position" >= 0) AND ("position" <= 100))),
    CONSTRAINT profile_rehab_sites_position_check1 CHECK (("position" >= 0))
);



--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    time_zone text DEFAULT 'Europe/Warsaw'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    weekly_goal smallint DEFAULT 2 NOT NULL,
    check_in_time time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    avatar_path text,
    preferred_language text DEFAULT 'auto'::text NOT NULL,
    CONSTRAINT profiles_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT profiles_preferred_language_check CHECK ((preferred_language = ANY (ARRAY['pl'::text, 'en'::text, 'auto'::text]))),
    CONSTRAINT profiles_weekly_goal_check CHECK (((weekly_goal >= 0) AND (weekly_goal <= 14)))
);



--
-- Name: session_exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_exercises (
    session_id uuid NOT NULL,
    exercise_id text NOT NULL,
    exercise_name text NOT NULL,
    unilateral boolean NOT NULL,
    "position" smallint NOT NULL,
    planned_sets smallint NOT NULL,
    planned_weight numeric NOT NULL,
    planned_reps smallint NOT NULL,
    note character varying DEFAULT ''::character varying NOT NULL,
    timer_config jsonb,
    CONSTRAINT session_exercises_planned_reps_check CHECK (((planned_reps >= 0) AND (planned_reps <= 50))),
    CONSTRAINT session_exercises_planned_sets_check CHECK (((planned_sets >= 1) AND (planned_sets <= 10))),
    CONSTRAINT session_exercises_planned_weight_check CHECK (((planned_weight >= (0)::numeric) AND (planned_weight <= (500)::numeric))),
    CONSTRAINT session_exercises_position_check CHECK (("position" >= 0))
);



--
-- Name: session_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_sets (
    session_id uuid NOT NULL,
    exercise_id text NOT NULL,
    side text NOT NULL,
    set_index smallint NOT NULL,
    weight numeric NOT NULL,
    reps smallint NOT NULL,
    done boolean DEFAULT false NOT NULL,
    CONSTRAINT session_sets_reps_check CHECK (((reps >= 0) AND (reps <= 50))),
    CONSTRAINT session_sets_set_index_check CHECK (((set_index >= 0) AND (set_index <= 9))),
    CONSTRAINT session_sets_side_check CHECK ((side = ANY (ARRAY['L'::text, 'P'::text, 'both'::text]))),
    CONSTRAINT session_sets_weight_check CHECK (((weight >= (0)::numeric) AND (weight <= (500)::numeric)))
);



--
-- Name: template_exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_exercises (
    template_id uuid NOT NULL,
    exercise_id text NOT NULL,
    "position" smallint NOT NULL,
    set_count smallint NOT NULL,
    weight numeric NOT NULL,
    reps smallint NOT NULL,
    note character varying DEFAULT ''::character varying NOT NULL,
    timer_config jsonb,
    CONSTRAINT template_exercises_position_check CHECK (("position" >= 0)),
    CONSTRAINT template_exercises_reps_check CHECK (((reps >= 0) AND (reps <= 50))),
    CONSTRAINT template_exercises_set_count_check CHECK (((set_count >= 1) AND (set_count <= 10))),
    CONSTRAINT template_exercises_weight_check CHECK (((weight >= (0)::numeric) AND (weight <= (500)::numeric)))
);



--
-- Name: timer_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timer_settings (
    profile_id uuid NOT NULL,
    prepare_seconds integer DEFAULT 5 NOT NULL,
    move1_seconds integer DEFAULT 3 NOT NULL,
    hold_seconds integer DEFAULT 1 NOT NULL,
    move2_seconds integer DEFAULT 3 NOT NULL,
    reps integer DEFAULT 8 NOT NULL,
    sets integer DEFAULT 3 NOT NULL,
    rest_seconds integer DEFAULT 90 NOT NULL,
    sound boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    unilateral boolean DEFAULT false NOT NULL,
    side_prepare_seconds integer DEFAULT 5 NOT NULL,
    first_side text DEFAULT 'L'::text NOT NULL,
    CONSTRAINT timer_settings_first_side_check CHECK ((first_side = ANY (ARRAY['L'::text, 'P'::text]))),
    CONSTRAINT timer_settings_hold_seconds_check CHECK (((hold_seconds >= 0) AND (hold_seconds <= 3600))),
    CONSTRAINT timer_settings_move1_seconds_check CHECK (((move1_seconds >= 0) AND (move1_seconds <= 3600))),
    CONSTRAINT timer_settings_move2_seconds_check CHECK (((move2_seconds >= 0) AND (move2_seconds <= 3600))),
    CONSTRAINT timer_settings_prepare_seconds_check CHECK (((prepare_seconds >= 0) AND (prepare_seconds <= 3600))),
    CONSTRAINT timer_settings_reps_check CHECK (((reps >= 1) AND (reps <= 100))),
    CONSTRAINT timer_settings_rest_seconds_check CHECK (((rest_seconds >= 0) AND (rest_seconds <= 3600))),
    CONSTRAINT timer_settings_sets_check CHECK (((sets >= 1) AND (sets <= 100))),
    CONSTRAINT timer_settings_side_prepare_seconds_check CHECK (((side_prepare_seconds >= 0) AND (side_prepare_seconds <= 3600)))
);



--
-- Name: workout_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_sessions (
    activity_type text NOT NULL DEFAULT 'strength',
    activity_name character varying(80),
    id uuid NOT NULL,
    profile_id uuid NOT NULL,
    source_template_id uuid,
    plan_name character varying(80),
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    edited_at timestamp with time zone,
    note character varying DEFAULT ''::character varying NOT NULL,
    decision character varying,
    rule_version text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exercise_progress jsonb DEFAULT '[]'::jsonb NOT NULL,
    completion_reason text DEFAULT 'unspecified'::text NOT NULL,
    CONSTRAINT workout_sessions_check CHECK (((ended_at IS NULL) OR (ended_at >= started_at))),
    CONSTRAINT workout_sessions_completion_reason_check CHECK ((completion_reason = ANY (ARRAY['unspecified'::text, 'pain'::text, 'fatigue'::text, 'time'::text, 'other'::text])))
);



--
-- Name: workout_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workout_templates (
    id uuid NOT NULL,
    profile_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workout_templates_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0))
);


--
-- Data for Name: exercises; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.exercises VALUES ('calf', 'Wspięcia na palce', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('rdl', 'Rumuński martwy ciąg', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('curl', 'Uginanie nóg leżąc', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('extension', 'Prostowanie kolana', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('leg-press', 'Leg press na maszynie', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('curl-seated', 'Uginanie nóg siedząc', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('calf-seated', 'Wspięcia na palce siedząc', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('clamshell', 'Clamshells z gumą', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('squat', 'Przysiad ze sztangą z tyłu', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('front-squat', 'Przysiad przedni', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('goblet', 'Goblet squat', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('hack-squat', 'Hack squat', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('split-squat', 'Split squat', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('bulgarian', 'Przysiad bułgarski', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('lunge', 'Wykroki w przód', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('reverse-lunge', 'Wykroki w tył', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('step-up', 'Wejścia na podest', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('deadlift', 'Klasyczny martwy ciąg', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('sumo', 'Martwy ciąg sumo', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('rdl-single', 'Rumuński martwy ciąg jednonóż', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('bridge', 'Glute bridge obunóż', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('bridge-single', 'Glute bridge jednonóż', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('hip-thrust', 'Hip thrust obunóż', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('hip-thrust-single', 'Hip thrust jednonóż', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('abduction', 'Odwodzenie nóg na maszynie', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('adduction', 'Przywodzenie nóg na maszynie', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('calf-press', 'Wspięcia na palce na suwnicy', '', NULL, false, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('band-abduction', 'Odwodzenie nogi z gumą', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('band-walk', 'Chodzenie bokiem z gumą', '', NULL, true, true, '2026-11-21 13:12:26.304+00');
INSERT INTO public.exercises VALUES ('tibialis', 'Unoszenie palców stóp', '', NULL, false, true, '2026-11-21 13:12:26.304+00');


--
-- Data for Name: injury_rehab_sites; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pain_log_injuries; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pain_log_values; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pain_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pain_sites; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pain_sites VALUES ('achilles', 'Achilles', true);
INSERT INTO public.pain_sites VALUES ('pht', 'PHT', true);
INSERT INTO public.pain_sites VALUES ('quadriceps', 'Czworogłowy', true);


--
-- Data for Name: profile_injuries; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: profile_pain_contexts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: profile_rehab_sites; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: session_exercises; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: session_sets; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: template_exercises; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: timer_settings; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: workout_sessions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: workout_templates; Type: TABLE DATA; Schema: public; Owner: -
--




--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);



--
-- Name: injury_rehab_sites injury_rehab_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.injury_rehab_sites
    ADD CONSTRAINT injury_rehab_sites_pkey PRIMARY KEY (profile_id, injury_id, site_id);



--
-- Name: pain_log_injuries pain_log_injuries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_log_injuries
    ADD CONSTRAINT pain_log_injuries_pkey PRIMARY KEY (profile_id, pain_log_id, injury_id);



--
-- Name: pain_log_values pain_log_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_log_values
    ADD CONSTRAINT pain_log_values_pkey PRIMARY KEY (pain_log_id, site_id);



--
-- Name: pain_logs pain_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_logs
    ADD CONSTRAINT pain_logs_pkey PRIMARY KEY (id);



--
-- Name: pain_sites pain_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_sites
    ADD CONSTRAINT pain_sites_pkey PRIMARY KEY (id);



--
-- Name: profile_injuries profile_injuries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_injuries
    ADD CONSTRAINT profile_injuries_pkey PRIMARY KEY (profile_id, id);



--
-- Name: profile_pain_contexts profile_pain_contexts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_pain_contexts
    ADD CONSTRAINT profile_pain_contexts_pkey PRIMARY KEY (profile_id, value);



--
-- Name: profile_rehab_sites profile_rehab_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_rehab_sites
    ADD CONSTRAINT profile_rehab_sites_pkey PRIMARY KEY (profile_id, id);



--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);



--
-- Name: session_exercises session_exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_exercises
    ADD CONSTRAINT session_exercises_pkey PRIMARY KEY (session_id, exercise_id);



--
-- Name: session_exercises session_exercises_session_id_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_exercises
    ADD CONSTRAINT session_exercises_session_id_position_key UNIQUE (session_id, "position");



--
-- Name: session_sets session_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_sets
    ADD CONSTRAINT session_sets_pkey PRIMARY KEY (session_id, exercise_id, side, set_index);



--
-- Name: template_exercises template_exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_exercises
    ADD CONSTRAINT template_exercises_pkey PRIMARY KEY (template_id, exercise_id);



--
-- Name: template_exercises template_exercises_template_id_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_exercises
    ADD CONSTRAINT template_exercises_template_id_position_key UNIQUE (template_id, "position");



--
-- Name: timer_settings timer_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_settings
    ADD CONSTRAINT timer_settings_pkey PRIMARY KEY (profile_id);



--
-- Name: workout_sessions workout_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_sessions
    ADD CONSTRAINT workout_sessions_pkey PRIMARY KEY (id);



--
-- Name: workout_templates workout_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_templates
    ADD CONSTRAINT workout_templates_pkey PRIMARY KEY (id);



--
-- Name: injury_rehab_sites_profile_site_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX injury_rehab_sites_profile_site_idx ON public.injury_rehab_sites USING btree (profile_id, site_id);



--
-- Name: pain_log_injuries_profile_injury_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pain_log_injuries_profile_injury_idx ON public.pain_log_injuries USING btree (profile_id, injury_id, pain_log_id);



--
-- Name: pain_log_values_profile_site_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pain_log_values_profile_site_idx ON public.pain_log_values USING btree (profile_id, site_id);



--
-- Name: pain_logs_id_profile_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pain_logs_id_profile_uq ON public.pain_logs USING btree (id, profile_id);



--
-- Name: pain_logs_profile_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pain_logs_profile_date_idx ON public.pain_logs USING btree (profile_id, log_date DESC);



--
-- Name: pain_logs_profile_measured_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pain_logs_profile_measured_idx ON public.pain_logs USING btree (profile_id, measured_at);



--
-- Name: pain_logs_profile_session_measured_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pain_logs_profile_session_measured_idx ON public.pain_logs USING btree (profile_id, session_id, measured_at);



--
-- Name: profile_injuries_profile_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_injuries_profile_status_idx ON public.profile_injuries USING btree (profile_id, status, "position");



--
-- Name: profile_pain_contexts_active_position_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profile_pain_contexts_active_position_uq ON public.profile_pain_contexts USING btree (profile_id, "position") WHERE active;



--
-- Name: profile_pain_contexts_label_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profile_pain_contexts_label_uq ON public.profile_pain_contexts USING btree (profile_id, lower((label)::text)) WHERE active;



--
-- Name: profile_rehab_sites_active_position_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profile_rehab_sites_active_position_uq ON public.profile_rehab_sites USING btree (profile_id, "position") WHERE active;



--
-- Name: profile_rehab_sites_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profile_rehab_sites_name_uq ON public.profile_rehab_sites USING btree (profile_id, lower((name)::text)) WHERE active;



--
-- Name: profiles_owner_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_owner_user_id_idx ON public.profiles USING btree (owner_user_id);



--
-- Name: profiles_owner_user_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_owner_user_id_uq ON public.profiles USING btree (owner_user_id);



--
-- Name: session_exercises_position_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX session_exercises_position_uq ON public.session_exercises USING btree (session_id, "position");



--
-- Name: template_exercises_position_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX template_exercises_position_uq ON public.template_exercises USING btree (template_id, "position");



--
-- Name: workout_sessions_id_profile_analytics_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX workout_sessions_id_profile_analytics_uq ON public.workout_sessions USING btree (id, profile_id);



--
-- Name: workout_sessions_profile_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workout_sessions_profile_started_idx ON public.workout_sessions USING btree (profile_id, started_at DESC);



--
-- Name: workout_templates_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workout_templates_profile_id_idx ON public.workout_templates USING btree (profile_id);



--
-- Name: injury_rehab_sites injury_rehab_sites_profile_id_injury_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.injury_rehab_sites
    ADD CONSTRAINT injury_rehab_sites_profile_id_injury_id_fkey FOREIGN KEY (profile_id, injury_id) REFERENCES public.profile_injuries(profile_id, id) ON DELETE RESTRICT;



--
-- Name: injury_rehab_sites injury_rehab_sites_profile_id_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.injury_rehab_sites
    ADD CONSTRAINT injury_rehab_sites_profile_id_site_id_fkey FOREIGN KEY (profile_id, site_id) REFERENCES public.profile_rehab_sites(profile_id, id) ON DELETE RESTRICT;



--
-- Name: pain_log_injuries pain_log_injuries_pain_log_id_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_log_injuries
    ADD CONSTRAINT pain_log_injuries_pain_log_id_profile_id_fkey FOREIGN KEY (pain_log_id, profile_id) REFERENCES public.pain_logs(id, profile_id) ON DELETE CASCADE;



--
-- Name: pain_log_injuries pain_log_injuries_profile_id_injury_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_log_injuries
    ADD CONSTRAINT pain_log_injuries_profile_id_injury_id_fkey FOREIGN KEY (profile_id, injury_id) REFERENCES public.profile_injuries(profile_id, id) ON DELETE RESTRICT;



--
-- Name: pain_logs pain_logs_profile_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_logs
    ADD CONSTRAINT pain_logs_profile_owner_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;



--
-- Name: pain_logs pain_logs_session_profile_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_logs
    ADD CONSTRAINT pain_logs_session_profile_fk FOREIGN KEY (session_id, profile_id) REFERENCES public.workout_sessions(id, profile_id);



--
-- Name: pain_log_values pain_values_log_profile_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_log_values
    ADD CONSTRAINT pain_values_log_profile_fk FOREIGN KEY (pain_log_id, profile_id) REFERENCES public.pain_logs(id, profile_id) ON DELETE CASCADE;



--
-- Name: pain_log_values pain_values_profile_site_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_log_values
    ADD CONSTRAINT pain_values_profile_site_fk FOREIGN KEY (profile_id, site_id) REFERENCES public.profile_rehab_sites(profile_id, id) ON UPDATE CASCADE ON DELETE RESTRICT;



--
-- Name: profile_injuries profile_injuries_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_injuries
    ADD CONSTRAINT profile_injuries_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;



--
-- Name: profile_pain_contexts profile_pain_contexts_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_pain_contexts
    ADD CONSTRAINT profile_pain_contexts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;



--
-- Name: profile_rehab_sites profile_rehab_sites_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_rehab_sites
    ADD CONSTRAINT profile_rehab_sites_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;



--
-- Name: profiles profiles_owner_auth_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_owner_auth_user_fk FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;



--
-- Name: session_exercises session_exercises_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_exercises
    ADD CONSTRAINT session_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);



--
-- Name: session_exercises session_exercises_session_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_exercises
    ADD CONSTRAINT session_exercises_session_fk FOREIGN KEY (session_id) REFERENCES public.workout_sessions(id) ON DELETE CASCADE;



--
-- Name: session_sets session_sets_exercise_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_sets
    ADD CONSTRAINT session_sets_exercise_fk FOREIGN KEY (session_id, exercise_id) REFERENCES public.session_exercises(session_id, exercise_id) ON DELETE CASCADE;



--
-- Name: template_exercises template_exercises_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_exercises
    ADD CONSTRAINT template_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);



--
-- Name: template_exercises template_exercises_template_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_exercises
    ADD CONSTRAINT template_exercises_template_fk FOREIGN KEY (template_id) REFERENCES public.workout_templates(id) ON DELETE CASCADE;



--
-- Name: timer_settings timer_settings_profile_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timer_settings
    ADD CONSTRAINT timer_settings_profile_owner_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;



--
-- Name: workout_sessions workout_sessions_profile_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_sessions
    ADD CONSTRAINT workout_sessions_profile_owner_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;



--
-- Name: workout_templates workout_templates_profile_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workout_templates
    ADD CONSTRAINT workout_templates_profile_owner_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;



--
-- Name: exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;


--
-- Name: injury_rehab_sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.injury_rehab_sites ENABLE ROW LEVEL SECURITY;


--
-- Name: pain_log_injuries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pain_log_injuries ENABLE ROW LEVEL SECURITY;


--
-- Name: pain_log_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pain_log_values ENABLE ROW LEVEL SECURITY;


--
-- Name: pain_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pain_logs ENABLE ROW LEVEL SECURITY;


--
-- Name: pain_sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pain_sites ENABLE ROW LEVEL SECURITY;


--
-- Name: profile_injuries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_injuries ENABLE ROW LEVEL SECURITY;


--
-- Name: profile_pain_contexts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_pain_contexts ENABLE ROW LEVEL SECURITY;


--
-- Name: profile_rehab_sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_rehab_sites ENABLE ROW LEVEL SECURITY;


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


--
-- Name: session_exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;


--
-- Name: session_sets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_sets ENABLE ROW LEVEL SECURITY;


--
-- Name: template_exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;


--
-- Name: timer_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.timer_settings ENABLE ROW LEVEL SECURITY;


--
-- Name: workout_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;


--
-- Name: workout_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON TABLE public.exercises FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.injury_rehab_sites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pain_log_injuries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pain_log_values FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pain_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pain_sites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.profile_injuries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.profile_pain_contexts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.profile_rehab_sites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.session_exercises FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.session_sets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.template_exercises FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.timer_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.workout_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.workout_templates FROM PUBLIC, anon, authenticated;
COMMIT;
