-- NEW PROJECTS ONLY. Do not run against an existing application database.
-- Apply the follow-up migrations listed in README.md before exposing the API.
BEGIN;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL CHECK (length(trim(name)) > 0),
  time_zone text NOT NULL DEFAULT 'Europe/Warsaw',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.exercises (
  id text PRIMARY KEY,
  name text NOT NULL,
  detail text NOT NULL DEFAULT '',
  equipment text,
  unilateral boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pain_sites (
  id text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.workout_templates (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL CHECK (length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.template_exercises (
  template_id uuid NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_id text NOT NULL REFERENCES public.exercises(id),
  position smallint NOT NULL CHECK (position >= 0),
  set_count smallint NOT NULL CHECK (set_count BETWEEN 1 AND 10),
  weight numeric NOT NULL CHECK (weight BETWEEN 0 AND 500),
  reps smallint NOT NULL CHECK (reps BETWEEN 0 AND 50),
  note varchar NOT NULL DEFAULT '',
  timer_config jsonb,
  PRIMARY KEY (template_id, exercise_id),
  UNIQUE (template_id, position)
);
CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_template_id uuid,
  plan_name varchar(80),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  edited_at timestamptz,
  note varchar NOT NULL DEFAULT '',
  decision varchar,
  rule_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  exercise_progress jsonb NOT NULL DEFAULT '[]'::jsonb,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE TABLE public.session_exercises (
  session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id text NOT NULL REFERENCES public.exercises(id),
  exercise_name text NOT NULL,
  unilateral boolean NOT NULL,
  position smallint NOT NULL CHECK (position >= 0),
  planned_sets smallint NOT NULL CHECK (planned_sets BETWEEN 1 AND 10),
  planned_weight numeric NOT NULL CHECK (planned_weight BETWEEN 0 AND 500),
  planned_reps smallint NOT NULL CHECK (planned_reps BETWEEN 0 AND 50),
  note varchar NOT NULL DEFAULT '',
  timer_config jsonb,
  PRIMARY KEY (session_id, exercise_id),
  UNIQUE (session_id, position)
);
CREATE TABLE public.session_sets (
  session_id uuid NOT NULL,
  exercise_id text NOT NULL,
  side text NOT NULL CHECK (side IN ('L','P','both')),
  set_index smallint NOT NULL CHECK (set_index BETWEEN 0 AND 9),
  weight numeric NOT NULL CHECK (weight BETWEEN 0 AND 500),
  reps smallint NOT NULL CHECK (reps BETWEEN 0 AND 50),
  done boolean NOT NULL DEFAULT false,
  PRIMARY KEY (session_id, exercise_id, side, set_index),
  FOREIGN KEY (session_id, exercise_id)
    REFERENCES public.session_exercises(session_id, exercise_id) ON DELETE CASCADE
);
CREATE TABLE public.pain_logs (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  measured_at timestamptz NOT NULL,
  context varchar NOT NULL DEFAULT '',
  note varchar NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, log_date)
);
CREATE TABLE public.pain_log_values (
  pain_log_id uuid NOT NULL REFERENCES public.pain_logs(id) ON DELETE CASCADE,
  site_id text NOT NULL REFERENCES public.pain_sites(id),
  value smallint NOT NULL CHECK (value BETWEEN 0 AND 10),
  PRIMARY KEY (pain_log_id, site_id)
);
CREATE TABLE public.timer_settings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  prepare_seconds integer NOT NULL DEFAULT 5 CHECK (prepare_seconds BETWEEN 0 AND 3600),
  move1_seconds integer NOT NULL DEFAULT 3 CHECK (move1_seconds BETWEEN 0 AND 3600),
  hold_seconds integer NOT NULL DEFAULT 1 CHECK (hold_seconds BETWEEN 0 AND 3600),
  move2_seconds integer NOT NULL DEFAULT 3 CHECK (move2_seconds BETWEEN 0 AND 3600),
  reps integer NOT NULL DEFAULT 8 CHECK (reps BETWEEN 1 AND 100),
  sets integer NOT NULL DEFAULT 3 CHECK (sets BETWEEN 1 AND 100),
  rest_seconds integer NOT NULL DEFAULT 90 CHECK (rest_seconds BETWEEN 0 AND 3600),
  sound boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fail closed until 20261116_canonical_rls.sql installs ownership policies.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pain_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pain_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pain_log_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timer_settings ENABLE ROW LEVEL SECURITY;
COMMIT;
