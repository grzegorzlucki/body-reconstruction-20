-- Fresh Supabase project only. Run complete files in numerical order.
BEGIN;
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


NOTIFY pgrst, 'reload schema';
COMMIT;
