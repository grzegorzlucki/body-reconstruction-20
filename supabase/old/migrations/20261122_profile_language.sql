-- Existing profiles retain Polish. New profiles follow device preferences.
BEGIN;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'pl';
ALTER TABLE public.profiles ALTER COLUMN preferred_language SET DEFAULT 'auto';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.profiles'::regclass AND conname='profiles_preferred_language_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_preferred_language_check
      CHECK (preferred_language IN ('pl','en','auto'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_profile_language(target_profile_id uuid, language_preference text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF language_preference IS NULL OR language_preference NOT IN ('pl','en','auto') THEN
    RAISE EXCEPTION 'Invalid language preference' USING ERRCODE='22023';
  END IF;
  UPDATE public.profiles SET preferred_language=language_preference, updated_at=now()
    WHERE id=target_profile_id AND owner_user_id=uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.update_profile_language(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_language(uuid,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
