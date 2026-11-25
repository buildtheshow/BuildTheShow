-- Remove the private signup draft in the same transaction that creates the profile.
ALTER FUNCTION public.bts_create_circle_profile(uuid,jsonb,boolean,uuid) SET SCHEMA bts_private;
ALTER FUNCTION bts_private.bts_create_circle_profile(uuid,jsonb,boolean,uuid) RENAME TO create_circle_profile_before_draft_cleanup;
REVOKE ALL ON FUNCTION bts_private.create_circle_profile_before_draft_cleanup(uuid,jsonb,boolean,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_create_circle_profile(p_circle_id uuid,p_profile jsonb,p_guardian_confirmed boolean,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 result:=bts_private.create_circle_profile_before_draft_cleanup(p_circle_id,p_profile,p_guardian_confirmed,p_request_id);
 UPDATE auth.users SET raw_user_meta_data=raw_user_meta_data-'additional_profile_draft' WHERE id=auth.uid() AND raw_user_meta_data ? 'additional_profile_draft';
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bts_create_circle_profile(uuid,jsonb,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_create_circle_profile(uuid,jsonb,boolean,uuid) TO authenticated;
