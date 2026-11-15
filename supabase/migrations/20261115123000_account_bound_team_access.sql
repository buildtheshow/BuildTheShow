-- Team codes supplement an adult login; they no longer replace one.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';

ALTER TABLE public.production_team_member_sessions
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS team_sessions_auth_user_idx ON public.production_team_member_sessions(auth_user_id);
-- Old bearer-only sessions cannot be safely assigned to an account by email.
UPDATE public.production_team_member_sessions SET revoked_at=now()
WHERE auth_user_id IS NULL AND revoked_at IS NULL;
REVOKE ALL ON public.production_team_member_sessions FROM PUBLIC,anon,authenticated;

-- Some notes policies allowed anonymous reads and writes; one observation
-- policy also confused organisation membership with this production's owner.
-- Team members use the checked RPCs below. Direct table access stays with the
-- active organisation owner until delegated workspace policies are reviewed.
DO $$ DECLARE table_name text; condition text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['production_audition_notes','production_audition_observations',
    'production_audition_live_events','production_audition_live_state',
    'production_audition_room_states','production_room_next_signals'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon',table_name);
    condition:=format('public.bts_account_is_active() AND EXISTS(SELECT 1 FROM public.productions p JOIN public.organizations o ON o.id=p.organization_id WHERE p.id=%I.production_id AND o.admin_id=auth.uid())',table_name);
    EXECUTE format('CREATE POLICY "Direct audition access requires active production owner" ON public.%I AS RESTRICTIVE TO public USING (%s) WITH CHECK (%s)',table_name,condition,condition);
  END LOOP;
END $$;

CREATE TABLE bts_private.team_login_windows (
  production_id uuid NOT NULL REFERENCES public.productions(id) ON DELETE CASCADE,
  target_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL,
  PRIMARY KEY(production_id,target_hash,window_start)
);
ALTER TABLE bts_private.team_login_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bts_private.team_login_windows FROM PUBLIC,anon,authenticated;

-- This is the common boundary for ALL session-based team RPCs, including old
-- overloads. No client role string, title or localStorage value is consulted.
CREATE FUNCTION bts_private.require_team_session(
  p_production_id uuid,p_session_token text,p_operation text,p_arguments jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE member public.production_team_members%ROWTYPE; page text := 'auditions.general';
  required_rank integer := 1; actual_rank integer := 0; configured text;
  identifier uuid; field text; session_type text; manager boolean;
BEGIN
  IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account before opening team access.'; END IF;
  IF p_operation IS NULL OR p_operation <> ALL(ARRAY[
    'team_member_resume_session','team_member_revoke_session','team_member_colour_list_for_session',
    'team_member_page_access_for_session','team_member_update_profile_for_session','team_members_for_session',
    'team_member_manage_page_access_for_session','team_authored_notes_for_production',
    'team_note_add_for_session','team_note_update_for_session','team_note_delete_for_session',
    'team_observations_for_production','team_observation_upsert_for_session','team_observation_delete_for_session',
    'team_room_state_list_for_session','team_room_state_upsert_for_session',
    'team_next_signal_list_for_session','team_next_signal_upsert_for_session',
    'team_audition_live_state_list_for_session','team_audition_live_event_apply_for_session'
  ]) THEN RAISE EXCEPTION 'This team operation has not been authorised.'; END IF;
  SELECT m.* INTO member FROM public.production_team_member_sessions s
  JOIN public.production_team_members m ON m.id=s.team_member_id AND m.production_id=s.production_id
  WHERE s.production_id=p_production_id AND s.session_token=trim(p_session_token)
    AND s.auth_user_id=auth.uid() AND s.revoked_at IS NULL AND s.expires_at>now() AND m.is_active;
  IF member.id IS NULL THEN RAISE EXCEPTION 'This team session is unavailable for your account.'; END IF;

  -- Identity/profile and permission-summary operations reveal no other production.
  IF p_operation IN ('team_member_resume_session','team_member_revoke_session','team_member_colour_list_for_session',
    'team_member_page_access_for_session','team_member_update_profile_for_session','team_members_for_session') THEN
    IF p_operation='team_member_update_profile_for_session' AND nullif(trim(p_arguments->>'p_email'),'') IS NOT NULL
      AND lower(trim(p_arguments->>'p_email')) IS DISTINCT FROM
        (SELECT lower(trim(email)) FROM auth.users WHERE id=auth.uid()) THEN
      RAISE EXCEPTION 'Use your account settings to change your sign-in email.';
    END IF;
    RETURN member.id;
  END IF;
  manager := lower(coalesce(member.access_level,'')) IN ('producer','admin','administrator','owner');
  IF p_operation='team_member_manage_page_access_for_session' THEN
    IF NOT manager AND NOT EXISTS (SELECT 1 FROM public.production_team_member_special_permissions
      WHERE production_id=p_production_id AND team_member_id=member.id AND permission_key='manage_access') THEN
      RAISE EXCEPTION 'You do not have permission to manage team access.';
    END IF;
    RETURN member.id;
  END IF;
  IF p_operation ~ '(add|update|upsert|delete|apply)' THEN required_rank:=2; END IF;

  identifier:=nullif(p_arguments->>'p_session_id','')::uuid;
  IF identifier IS NULL AND p_arguments->>'p_note_id' IS NOT NULL THEN
    SELECT n.session_id INTO identifier FROM public.production_audition_notes n
      WHERE n.id=(p_arguments->>'p_note_id')::uuid AND n.production_id=p_production_id AND n.team_member_id=member.id;
  ELSIF identifier IS NULL AND p_arguments->>'p_observation_id' IS NOT NULL THEN
    SELECT o.session_id INTO identifier FROM public.production_audition_observations o
      WHERE o.id=(p_arguments->>'p_observation_id')::uuid AND o.production_id=p_production_id AND o.team_member_id=member.id;
  END IF;
  IF identifier IS NOT NULL THEN
    SELECT s.type INTO session_type FROM public.audition_sessions s WHERE s.id=identifier AND s.production_id=p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'The audition session is unavailable for this production.'; END IF;
    IF session_type='callback' THEN page:='auditions.callback';
    ELSIF session_type='dance_call' THEN page:='auditions.dance_call'; END IF;
  END IF;
  IF p_operation='team_audition_live_event_apply_for_session'
    AND p_arguments->>'p_event_type' IN ('performer_checked_in','performer_marked_no_show','performer_unchecked') THEN
    page:='auditions.dashboard';
  END IF;
  IF p_operation='team_audition_live_event_apply_for_session' THEN
    IF p_arguments->>'p_event_type' IN ('performer_checked_in','performer_marked_no_show','performer_unchecked') THEN
      IF p_arguments->>'p_state_type' IS DISTINCT FROM 'checkin'
        OR p_arguments->>'p_state_key' IS DISTINCT FROM
          ('checkin:'||coalesce(nullif(p_arguments->>'p_session_id',''),'general')||':'||coalesce(nullif(p_arguments->>'p_application_id',''),'unknown')) THEN
        RAISE EXCEPTION 'Invalid check-in state.';
      END IF;
    ELSIF p_arguments->>'p_event_type'='room_requested_next' THEN
      IF p_arguments->>'p_state_type' IS DISTINCT FROM 'room_request'
        OR p_arguments->>'p_state_key' IS DISTINCT FROM ('room-request:'||coalesce(nullif(p_arguments->>'p_room_key',''),'main')) THEN
        RAISE EXCEPTION 'Invalid room request state.';
      END IF;
    ELSIF p_arguments->>'p_event_type' IN ('performer_sent_to_room','room_started_audition','room_finished_audition') THEN
      IF p_arguments->>'p_state_type' IS DISTINCT FROM 'room_state'
        OR p_arguments->>'p_state_key' IS DISTINCT FROM ('room:'||coalesce(nullif(p_arguments->>'p_room_key',''),'main')) THEN
        RAISE EXCEPTION 'Invalid room state.';
      END IF;
    ELSE RAISE EXCEPTION 'Invalid audition event.';
    END IF;
  END IF;
  SELECT pp.access_level INTO configured FROM public.production_team_member_page_permissions pp
    WHERE pp.production_id=p_production_id AND pp.team_member_id=member.id AND pp.page_key=page;
  IF manager THEN actual_rank:=3;
  ELSIF FOUND THEN actual_rank:=CASE configured WHEN 'manage' THEN 3 WHEN 'edit' THEN 2 WHEN 'view' THEN 1 ELSE 0 END;
  -- Explicit access-level defaults only. A job title never grants permissions.
  ELSIF NOT EXISTS (SELECT 1 FROM public.production_team_member_page_permissions pp
    WHERE pp.production_id=p_production_id AND pp.team_member_id=member.id) THEN
    actual_rank:=CASE
      WHEN lower(member.access_level) IN ('creative','room') AND page='auditions.general' THEN 2
      WHEN lower(member.access_level)='check_in' AND page='auditions.dashboard' THEN 2
      WHEN lower(member.access_level)='schedule' AND page='auditions.schedule' THEN 2
      WHEN lower(member.access_level) IN ('creative','room','check_in','schedule','view_only')
        AND page IN ('auditions.general','auditions.dashboard','auditions.schedule') THEN 1 ELSE 0 END;
  END IF;
  IF actual_rank<required_rank THEN RAISE EXCEPTION 'Your team access does not allow this action.'; END IF;

  -- Validate references before privileged legacy code can read or write them.
  FOR field IN SELECT jsonb_object_keys(p_arguments) LOOP
    IF field IN ('p_applicant_id','p_application_id','p_current_applicant_id','p_next_applicant_id') THEN
      identifier:=nullif(p_arguments->>field,'')::uuid;
      IF identifier IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.audition_applications WHERE id=identifier AND production_id=p_production_id)
        AND NOT EXISTS(SELECT 1 FROM public.audition_bookings WHERE id=identifier AND production_id=p_production_id) THEN
        RAISE EXCEPTION 'The performer is unavailable for this production.';
      END IF;
    ELSIF field IN ('p_current_group_member_ids','p_next_group_member_ids') THEN
      FOR identifier IN SELECT value::uuid FROM jsonb_array_elements_text(coalesce(nullif(p_arguments->field,'null'::jsonb),'[]'::jsonb)) LOOP
        IF NOT EXISTS(SELECT 1 FROM public.audition_applications WHERE id=identifier AND production_id=p_production_id)
          AND NOT EXISTS(SELECT 1 FROM public.audition_bookings WHERE id=identifier AND production_id=p_production_id) THEN
          RAISE EXCEPTION 'The performer group is unavailable for this production.';
        END IF;
      END LOOP;
    ELSIF field='p_character_id' THEN
      identifier:=nullif(p_arguments->>field,'')::uuid;
      IF identifier IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.production_characters WHERE id=identifier AND production_id=p_production_id) THEN
        RAISE EXCEPTION 'The character is unavailable for this production.';
      END IF;
    ELSIF field='p_note_id' THEN
      IF NOT EXISTS(SELECT 1 FROM public.production_audition_notes WHERE id=(p_arguments->>field)::uuid
        AND production_id=p_production_id AND team_member_id=member.id) THEN
        RAISE EXCEPTION 'You can only change your own notes in this production.';
      END IF;
    ELSIF field='p_observation_id' THEN
      IF NOT EXISTS(SELECT 1 FROM public.production_audition_observations WHERE id=(p_arguments->>field)::uuid
        AND production_id=p_production_id AND team_member_id=member.id) THEN
        RAISE EXCEPTION 'You can only change your own observations in this production.';
      END IF;
    END IF;
  END LOOP;
  RETURN member.id;
END;
$$;
REVOKE ALL ON FUNCTION bts_private.require_team_session(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;

-- Keep existing RPC signatures and implementations behind one enforced boundary.
-- Moving the originals also retires every passcode-only overload, including the
-- forgotten older signatures. Only session-based functions get public wrappers.
DO $$ DECLARE f record; names text; json_arguments text; body text; result text;
BEGIN
  FOR f IN SELECT p.oid,p.proname,p.proargnames,p.pronargs,p.proretset,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    pg_get_function_result(p.oid) AS result
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'team\_%' ESCAPE '\'
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET SCHEMA bts_private',f.proname,f.identity_arguments);
    EXECUTE format('REVOKE ALL ON FUNCTION bts_private.%I(%s) FROM PUBLIC,anon,authenticated',f.proname,f.identity_arguments);
    IF 'p_session_token'=ANY(f.proargnames) AND 'p_production_id'=ANY(f.proargnames) THEN
      SELECT string_agg(format('%I',name),',' ORDER BY position),
        string_agg(format('%L,to_jsonb(%I)',name,name),',' ORDER BY position)
      INTO names,json_arguments FROM unnest(f.proargnames[1:f.pronargs]) WITH ORDINALITY AS arguments(name,position);
      body:=format('BEGIN PERFORM bts_private.require_team_session(p_production_id,p_session_token,%L,jsonb_build_object(%s)); %s bts_private.%I(%s); END;',
        f.proname,json_arguments,CASE WHEN f.proretset THEN 'RETURN QUERY SELECT * FROM' ELSE 'RETURN' END,f.proname,names);
      EXECUTE format('CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql SECURITY DEFINER SET search_path=%L AS %L',
        f.proname,f.arguments,f.result,'',body);
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon',f.proname,f.identity_arguments);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',f.proname,f.identity_arguments);
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION public.team_member_start_session(p_production_id uuid,p_email text,p_passcode text,p_user_agent text DEFAULT NULL)
RETURNS TABLE(session_token text,expires_at timestamptz,team_member public.production_team_members)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE member public.production_team_members%ROWTYPE; caller_email text; used integer;
  bucket timestamptz:=to_timestamp(floor(extract(epoch FROM now())/900)*900); secret text; expiry timestamptz;
BEGIN
  IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account before using a team code.'; END IF;
  SELECT lower(trim(email)) INTO caller_email FROM auth.users WHERE id=auth.uid();
  IF lower(trim(p_email)) IS DISTINCT FROM caller_email THEN RAISE EXCEPTION 'Use the email address on your signed-in account.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.productions WHERE id=p_production_id) THEN RETURN; END IF;
  DELETE FROM bts_private.team_login_windows WHERE window_start<now()-interval '2 days';
  INSERT INTO bts_private.team_login_windows(production_id,target_hash,window_start,attempts)
    VALUES(p_production_id,encode(sha256(convert_to(caller_email,'UTF8')),'hex'),bucket,1)
  ON CONFLICT(production_id,target_hash,window_start) DO UPDATE
    SET attempts=bts_private.team_login_windows.attempts+1 WHERE bts_private.team_login_windows.attempts<20
  RETURNING attempts INTO used;
  -- A normal empty result commits the counter; raising an error would undo it.
  IF used IS NULL THEN RETURN; END IF;
  SELECT * INTO member FROM public.production_team_members
    WHERE production_id=p_production_id AND is_active AND lower(trim(email))=caller_email
      AND passcode=regexp_replace(trim(p_passcode),'\D+','','g') LIMIT 1;
  IF member.id IS NULL THEN RETURN; END IF;
  secret:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  expiry:=now()+interval '8 hours';
  INSERT INTO public.production_team_member_sessions(production_id,team_member_id,session_token,user_agent,expires_at,auth_user_id)
    VALUES(p_production_id,member.id,secret,left(p_user_agent,512),expiry,auth.uid());
  RETURN QUERY SELECT secret,expiry,member;
END;
$$;
REVOKE ALL ON FUNCTION public.team_member_start_session(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.team_member_start_session(uuid,text,text,text) TO authenticated;

-- The originals' invoker fallbacks must never promote a job title to authority.
-- Preserve business logic while removing that legacy privilege fallback.
DO $$ DECLARE f record; definition text; BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='bts_private' AND p.proname IN ('team_member_manage_page_access_for_session','team_member_page_access_for_session','team_members_for_session')
  LOOP
    definition:=pg_get_functiondef(f.oid);
    definition:=replace(definition,'coalesce(m.access_level, m.role, '''')','coalesce(m.access_level, '''')');
    definition:=replace(definition,'coalesce(v_actor.access_level, v_actor.role, '''')','coalesce(v_actor.access_level, '''')');
    definition:=replace(definition,'coalesce(v_target.access_level, v_target.role, '''')','coalesce(v_target.access_level, '''')');
    definition:=replace(definition,'coalesce(access_level, role, '''')','coalesce(access_level, '''')');
    EXECUTE definition;
  END LOOP;
END $$;
COMMIT;
