-- Run after the original schema and RLS migrations. Profiles belong directly
-- to Supabase Auth users; the browser no longer writes to public.app_users.
DO $$
DECLARE fk record;
BEGIN
  FOR fk IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.app_users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_owner_auth_user_fk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_owner_auth_user_fk
      FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
