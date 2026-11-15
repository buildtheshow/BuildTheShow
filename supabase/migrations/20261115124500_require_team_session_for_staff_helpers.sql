-- Staff email matches do not prove identity. Require the account-bound team
-- session created with the actual team code before granting staff-only access.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
CREATE OR REPLACE FUNCTION public.bts_authorize_email_send(p_user_id uuid,p_production_id uuid,p_test boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE window_start_at timestamptz; requests integer; request_kind text; request_limit integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u JOIN bts_private.account_controls c ON c.user_id=u.id
    JOIN public.productions p ON p.id=p_production_id JOIN public.organizations o ON o.id=p.organization_id
    WHERE u.id=p_user_id AND u.email_confirmed_at IS NOT NULL
      AND (u.banned_until IS NULL OR u.banned_until<now())
      AND c.status='active' AND c.birth_date <= (current_date-interval '18 years')::date
      AND c.privacy_version='2026-11-15' AND c.terms_version='2026-11-15'
      AND (o.admin_id=u.id OR EXISTS (
        SELECT 1 FROM public.org_members m WHERE m.org_id=o.id AND m.user_id=u.id AND m.access_level='admin'
      ) OR EXISTS (
        SELECT 1 FROM public.production_team_members tm WHERE tm.production_id=p.id
          AND tm.is_active AND EXISTS (SELECT 1 FROM public.production_team_member_sessions ts WHERE ts.team_member_id=tm.id AND ts.production_id=p.id AND ts.auth_user_id=u.id AND ts.revoked_at IS NULL AND ts.expires_at>now()) AND lower(trim(tm.email))=lower(trim(u.email))
          AND tm.access_level IN ('producer','admin','owner')
      ))
  ) THEN RETURN jsonb_build_object('allowed',false,'reason','forbidden'); END IF;
  request_kind := CASE WHEN p_test THEN 'test' ELSE 'transactional' END;
  request_limit := CASE WHEN p_test THEN 5 ELSE 500 END;
  window_start_at := CASE WHEN p_test
    THEN to_timestamp(floor(extract(epoch FROM now())/600)*600)
    ELSE date_trunc('hour',now()) END;
  DELETE FROM bts_private.email_rate_windows WHERE window_start<now()-interval '2 days';
  INSERT INTO bts_private.email_rate_windows(user_id,kind,window_start,sent_requests)
  VALUES (p_user_id,request_kind,window_start_at,1)
  ON CONFLICT(user_id,kind,window_start) DO UPDATE
    SET sent_requests=bts_private.email_rate_windows.sent_requests+1
    WHERE bts_private.email_rate_windows.sent_requests<request_limit
  RETURNING sent_requests INTO requests;
  IF requests IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','rate_limited'); END IF;
  RETURN jsonb_build_object('allowed',true);
END;
$$;
REVOKE ALL ON FUNCTION public.bts_authorize_email_send(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_authorize_email_send(uuid,uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.bts_can_read_profile_file(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.bts_account_is_active() AND (
    (storage.foldername(p_name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.audition_applications a
      JOIN public.productions p ON p.id=a.production_id
      JOIN public.organizations o ON o.id=p.organization_id
      WHERE (split_part(a.headshot_url,'?',1) =
          'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/' || p_name
        OR split_part(a.file_url,'?',1) =
          'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/' || p_name)
      AND (o.admin_id=auth.uid() OR EXISTS (
        SELECT 1 FROM public.org_members m WHERE m.org_id=o.id AND m.user_id=auth.uid() AND m.access_level='admin'
      ) OR EXISTS (
        SELECT 1 FROM public.production_team_members tm JOIN auth.users u ON u.id=auth.uid()
        WHERE tm.production_id=p.id AND tm.is_active AND EXISTS (SELECT 1 FROM public.production_team_member_sessions ts WHERE ts.team_member_id=tm.id AND ts.production_id=p.id AND ts.auth_user_id=u.id AND ts.revoked_at IS NULL AND ts.expires_at>now()) AND lower(trim(tm.email))=lower(trim(u.email))
        AND (tm.access_level IN ('producer','admin','owner') OR (
          tm.access_level IN ('creative','room','check_in','schedule','view_only')
          AND NOT EXISTS(SELECT 1 FROM public.production_team_member_page_permissions px WHERE px.production_id=p.id AND px.team_member_id=tm.id)
        ) OR EXISTS (
          SELECT 1 FROM public.production_team_member_page_permissions pp
          WHERE pp.production_id=p.id AND pp.team_member_id=tm.id
            AND (pp.page_key LIKE 'auditions.%' OR pp.page_key='cast_list')
            AND pp.access_level IN ('view','edit','manage')
        ))
      ))
    )
  );
$$;
REVOKE ALL ON FUNCTION public.bts_can_read_profile_file(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_can_read_profile_file(text) TO anon, authenticated;

COMMIT;
