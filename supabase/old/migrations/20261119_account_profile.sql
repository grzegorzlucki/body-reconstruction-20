-- Add account presentation without rewriting rehabilitation settings.
-- Run after the documented 20261118 migration.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path text;

CREATE OR REPLACE FUNCTION public.update_account_identity(display_name text, account_time_zone text, new_avatar_path text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF length(trim(coalesce(display_name,''))) NOT BETWEEN 1 AND 80
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=account_time_zone) THEN
    RAISE EXCEPTION 'Invalid account name or time zone' USING ERRCODE='22023';
  END IF;
  IF new_avatar_path IS NOT NULL AND (
    split_part(new_avatar_path,'/',1) <> uid::text
    OR new_avatar_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='avatars' AND name=new_avatar_path)
  ) THEN RAISE EXCEPTION 'Invalid avatar path' USING ERRCODE='42501'; END IF;
  UPDATE public.profiles SET name=trim(display_name), time_zone=account_time_zone,
    avatar_path=new_avatar_path, updated_at=now() WHERE owner_user_id=uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.update_account_identity(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_account_identity(text,text,text) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('avatars','avatars',false,2097152,ARRAY['image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=2097152,allowed_mime_types=ARRAY['image/webp'];

DROP POLICY IF EXISTS account_avatar_read ON storage.objects;
CREATE POLICY account_avatar_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
DROP POLICY IF EXISTS account_avatar_insert ON storage.objects;
CREATE POLICY account_avatar_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');
DROP POLICY IF EXISTS account_avatar_update ON storage.objects;
CREATE POLICY account_avatar_update ON storage.objects FOR UPDATE TO authenticated
USING(bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text)
WITH CHECK(bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');
DROP POLICY IF EXISTS account_avatar_delete ON storage.objects;
CREATE POLICY account_avatar_delete ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);

-- Server-only transactional cleanup. Auth and Storage are cleaned by the Edge Function.
CREATE OR REPLACE FUNCTION public.delete_account_records(account_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid uuid;
BEGIN
  FOR pid IN SELECT id FROM public.profiles WHERE owner_user_id=account_user_id FOR UPDATE LOOP
    DELETE FROM public.pain_log_injuries WHERE profile_id=pid;
    DELETE FROM public.injury_rehab_sites WHERE profile_id=pid;
    DELETE FROM public.profile_injuries WHERE profile_id=pid;
    DELETE FROM public.pain_logs WHERE profile_id=pid;
    DELETE FROM public.workout_sessions WHERE profile_id=pid;
    DELETE FROM public.workout_templates WHERE profile_id=pid;
    DELETE FROM public.timer_settings WHERE profile_id=pid;
    DELETE FROM public.profile_rehab_sites WHERE profile_id=pid;
    DELETE FROM public.profile_pain_contexts WHERE profile_id=pid;
    DELETE FROM public.profiles WHERE id=pid;
  END LOOP;
  DELETE FROM public.app_users WHERE id=account_user_id;
END $$;
REVOKE ALL ON FUNCTION public.delete_account_records(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_records(uuid) TO service_role;
COMMIT;
NOTIFY pgrst,'reload schema';
