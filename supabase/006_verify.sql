-- Read-only acceptance checks. Safe to rerun after installation.
BEGIN;
DO $$
DECLARE table_name text; function_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['profiles','exercises','pain_sites','workout_templates','template_exercises','workout_sessions','session_exercises','session_sets','pain_logs','pain_log_values','timer_settings','profile_rehab_sites','profile_pain_contexts','profile_injuries','injury_rehab_sites','pain_log_injuries'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=table_name AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'Missing table or disabled RLS: %',table_name;
    END IF;
    IF has_table_privilege('anon',format('public.%I',table_name),'SELECT') THEN RAISE EXCEPTION 'Unexpected anonymous table access: %',table_name; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=table_name) THEN RAISE EXCEPTION 'Missing policies: %',table_name; END IF;
  END LOOP;
  FOREACH function_name IN ARRAY ARRAY[
    'public.create_profile_with_template(jsonb)','public.save_workout_template(jsonb)',
    'public.save_profile_settings_with_archiving(jsonb)','public.save_pain_log_analytics(jsonb)',
    'public.save_workout_session_analytics(jsonb)','public.update_session_sets(jsonb)',
    'public.replace_profile_data_analytics(uuid,jsonb)','public.update_account_identity(text,text,text)',
    'public.update_profile_language(uuid,text)','public.read_record_page_v1(uuid,text,integer,timestamptz,uuid,date)'
  ] LOOP
    IF to_regprocedure(function_name) IS NULL THEN RAISE EXCEPTION 'Missing RPC: %',function_name; END IF;
    IF NOT has_function_privilege('authenticated',function_name,'EXECUTE') OR has_function_privilege('anon',function_name,'EXECUTE') THEN RAISE EXCEPTION 'Invalid RPC privileges: %',function_name; END IF;
  END LOOP;
  IF has_function_privilege('authenticated','public.delete_account_records(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.delete_account_records(uuid)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.delete_account_records(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Invalid account cleanup privileges'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='avatars' AND public=false AND file_size_limit=2097152 AND allowed_mime_types=ARRAY['image/webp']) THEN RAISE EXCEPTION 'Invalid avatars bucket'; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.pain_logs'::regclass AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (profile_id, log_date)') THEN RAISE EXCEPTION 'Multiple daily reports are incorrectly prohibited'; END IF;
END $$;
COMMIT;
SELECT 'Installation checks passed' AS result;
