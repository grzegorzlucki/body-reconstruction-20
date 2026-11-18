-- Optional unilateral mode. Old settings remain bilateral.
BEGIN;
ALTER TABLE public.timer_settings
  ADD COLUMN IF NOT EXISTS unilateral boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS side_prepare_seconds integer NOT NULL DEFAULT 5
    CHECK (side_prepare_seconds BETWEEN 0 AND 3600),
  ADD COLUMN IF NOT EXISTS first_side text NOT NULL DEFAULT 'L'
    CHECK (first_side IN ('L','P'));
-- Per-exercise options already live in timer_config JSONB, copied to session snapshots.
COMMIT;
NOTIFY pgrst, 'reload schema';
