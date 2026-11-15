-- Account security foundation. Schema checked against production on 2026-11-15.
-- This migration changes access rules; it does not delete people's records.
BEGIN;

CREATE SCHEMA IF NOT EXISTS bts_private;
REVOKE ALL ON SCHEMA bts_private FROM PUBLIC, anon, authenticated;

-- The existing slug CHECK calls an unqualified normalizer. Give that invoker
-- function its own fixed lookup path so it also works inside protected RPCs.
ALTER FUNCTION public.is_blocked_organization_slug(text) SET search_path = pg_catalog, public;

CREATE TABLE IF NOT EXISTS bts_private.account_controls (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  birth_date date,
  status text NOT NULL CHECK (status IN ('active', 'needs_confirmation', 'underage', 'closed')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  privacy_version text,
  terms_version text,
  consent_at timestamptz
);
ALTER TABLE bts_private.account_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bts_private.account_controls FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION bts_private.parse_birth_date(value text)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE parsed date;
BEGIN
  IF value IS NULL OR value !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN NULL; END IF;
  parsed := value::date;
  RETURN parsed;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION bts_private.parse_birth_date(text) FROM PUBLIC;

-- Historical self-declarations are recorded as historical, not verified identity.
INSERT INTO bts_private.account_controls (user_id, birth_date, status, source)
SELECT id, bts_private.parse_birth_date(raw_user_meta_data->>'date_of_birth'),
  CASE
    WHEN bts_private.parse_birth_date(raw_user_meta_data->>'date_of_birth') IS NULL THEN 'needs_confirmation'
    WHEN bts_private.parse_birth_date(raw_user_meta_data->>'date_of_birth') > (current_date - interval '18 years')::date THEN 'underage'
    ELSE 'active'
  END, 'legacy_self_declaration'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Existing accounts also move their birth date out of future access tokens.
UPDATE auth.users SET raw_user_meta_data=raw_user_meta_data-'date_of_birth'
WHERE raw_user_meta_data ? 'date_of_birth';

CREATE OR REPLACE FUNCTION bts_private.register_adult_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE dob date := bts_private.parse_birth_date(NEW.raw_user_meta_data->>'date_of_birth');
BEGIN
  IF dob IS NULL OR dob > (current_date - interval '18 years')::date
     OR dob < (current_date - interval '120 years')::date THEN
    RAISE EXCEPTION 'Account holders must be 18 or over. A parent or legal guardian must use their own account to manage a child profile.';
  END IF;
  IF NEW.raw_user_meta_data->>'privacy_accepted' IS DISTINCT FROM 'true'
     OR NEW.raw_user_meta_data->>'terms_accepted' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Please read the privacy notice and accept the terms before creating an account.';
  END IF;
  INSERT INTO bts_private.account_controls
    (user_id, birth_date, status, source, privacy_version, terms_version, consent_at)
  VALUES (NEW.id, dob, 'active', 'signup_self_declaration', '2026-11-15', '2026-11-15', now());
  -- Date of birth belongs in private account storage, not every access token.
  NEW.raw_user_meta_data := NEW.raw_user_meta_data - 'date_of_birth';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bts_private.register_adult_account() FROM PUBLIC;
DROP TRIGGER IF EXISTS bts_register_adult_account ON auth.users;
CREATE TRIGGER bts_register_adult_account BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION bts_private.register_adult_account();

CREATE OR REPLACE FUNCTION public.bts_account_is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM bts_private.account_controls c JOIN auth.users u ON u.id = c.user_id
    WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
      AND (u.banned_until IS NULL OR u.banned_until < now())
      AND c.status = 'active' AND c.birth_date <= (current_date - interval '18 years')::date
      AND c.privacy_version='2026-11-15' AND c.terms_version='2026-11-15'
  );
$$;
REVOKE ALL ON FUNCTION public.bts_account_is_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_account_is_active() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.bts_get_account_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('status', c.status, 'birth_date', c.birth_date,
    'email_verified', u.email_confirmed_at IS NOT NULL,
    'privacy_version', c.privacy_version, 'terms_version', c.terms_version,
    'active', public.bts_account_is_active())
  FROM auth.users u LEFT JOIN bts_private.account_controls c ON c.user_id = u.id
  WHERE u.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.bts_get_account_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_get_account_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.bts_confirm_adult_account(p_birth_date date, p_privacy_accepted boolean, p_terms_accepted boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c bts_private.account_controls%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Please sign in with a verified email address.';
  END IF;
  SELECT * INTO c FROM bts_private.account_controls WHERE user_id = auth.uid() FOR UPDATE;
  IF c.status IN ('underage', 'closed') THEN RAISE EXCEPTION 'Please contact privacy@buildtheshow.com for help with this account.'; END IF;
  IF p_birth_date IS NULL OR p_birth_date > (current_date - interval '18 years')::date
    OR p_birth_date < (current_date - interval '120 years')::date THEN
    RAISE EXCEPTION 'Account holders must be 18 or over.';
  END IF;
  IF p_privacy_accepted IS DISTINCT FROM true OR p_terms_accepted IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Please read the privacy notice and accept the terms.';
  END IF;
  IF c.birth_date IS NOT NULL AND c.birth_date <> p_birth_date THEN
    RAISE EXCEPTION 'Contact privacy@buildtheshow.com to correct an existing account birth date.';
  END IF;
  INSERT INTO bts_private.account_controls (user_id, birth_date, status, source, privacy_version, terms_version, consent_at)
  VALUES (auth.uid(), p_birth_date, 'active', 'account_confirmation', '2026-11-15', '2026-11-15', now())
  ON CONFLICT (user_id) DO UPDATE SET birth_date = EXCLUDED.birth_date, status = 'active',
    privacy_version = EXCLUDED.privacy_version, terms_version = EXCLUDED.terms_version, consent_at = now();
  RETURN public.bts_get_account_status();
END;
$$;
REVOKE ALL ON FUNCTION public.bts_confirm_adult_account(date,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_confirm_adult_account(date,boolean,boolean) TO authenticated;


-- Member IDs are identifiers, not passwords. Create them server-side even when
-- signup needs an email confirmation and therefore has no browser session yet.
CREATE OR REPLACE FUNCTION bts_private.ensure_member_id(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE attempts integer := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.member_ids WHERE user_id=p_user_id) THEN RETURN; END IF;
  LOOP
    BEGIN
      INSERT INTO public.member_ids (user_id,display_id)
      VALUES (p_user_id,'BTS-' || translate(upper(substr(replace(gen_random_uuid()::text,'-',''),1,5)),'01','GH'));
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      attempts := attempts + 1;
      IF attempts >= 20 THEN RAISE EXCEPTION 'Could not allocate a member identifier. Please try again.'; END IF;
    END;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION bts_private.ensure_member_id(uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION bts_private.create_member_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM bts_private.ensure_member_id(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bts_private.create_member_id() FROM PUBLIC;
DROP TRIGGER IF EXISTS bts_create_member_id ON auth.users;
CREATE TRIGGER bts_create_member_id AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION bts_private.create_member_id();
DO $$ DECLARE account record; BEGIN
  FOR account IN SELECT id FROM auth.users LOOP
    PERFORM bts_private.ensure_member_id(account.id);
  END LOOP;
END $$;
REVOKE INSERT,UPDATE,DELETE ON public.member_ids FROM authenticated;

-- Permission comes from a server-owned membership record, never a job title or user_metadata.
CREATE OR REPLACE FUNCTION public.bts_organisation_role(p_org_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN NOT public.bts_account_is_active() THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id AND admin_id = auth.uid()) THEN 'owner'
    ELSE (SELECT CASE WHEN access_level IN ('admin','editor','viewer') THEN access_level ELSE 'viewer' END
      FROM public.org_members WHERE org_id = p_org_id AND user_id = auth.uid() LIMIT 1) END;
$$;
REVOKE ALL ON FUNCTION public.bts_organisation_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_organisation_role(uuid) TO authenticated;

-- Profiles previously had two independently writable account-owner columns.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_consent_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_consent_version text;

-- Guardian identity and email are recorded by the profile RPC, not browser fields.
-- Normalize only unambiguous legacy ownership. Conflicting owners stay quarantined.
UPDATE public.profiles SET user_id=coalesce(user_id,account_id),account_id=coalesce(account_id,user_id)
WHERE (user_id IS NULL) <> (account_id IS NULL);

CREATE OR REPLACE FUNCTION bts_private.guard_profile_ownership()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon','authenticated') THEN
    IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'An active adult account with a verified email is required.'; END IF;
    IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.account_id IS DISTINCT FROM OLD.account_id) THEN
      RAISE EXCEPTION 'Profile ownership cannot be changed from the browser.';
    END IF;
    IF NEW.user_id IS DISTINCT FROM auth.uid() OR (NEW.account_id IS NOT NULL AND NEW.account_id <> auth.uid()) THEN
      RAISE EXCEPTION 'You can only manage profiles belonging to your account.';
    END IF;
    IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'Use the profile setup form to record consent.'; END IF;
    IF NEW.guardian_user_id IS DISTINCT FROM OLD.guardian_user_id
      OR NEW.guardian_consent_at IS DISTINCT FROM OLD.guardian_consent_at
      OR NEW.guardian_consent_version IS DISTINCT FROM OLD.guardian_consent_version
      OR NEW.guardian_email IS DISTINCT FROM OLD.guardian_email THEN
      RAISE EXCEPTION 'Use the profile setup form to update guardian consent.';
    END IF;
    IF NEW.date_of_birth > (current_date - interval '18 years')::date
       AND (NEW.guardian_user_id IS DISTINCT FROM auth.uid() OR NEW.guardian_consent_at IS NULL) THEN
      RAISE EXCEPTION 'A parent or legal guardian must confirm consent in the profile setup form.';
    END IF;
  END IF;
  IF NEW.date_of_birth > current_date OR NEW.date_of_birth < (current_date - interval '120 years')::date THEN
    RAISE EXCEPTION 'Please enter a valid date of birth.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bts_private.guard_profile_ownership() FROM PUBLIC;
DROP TRIGGER IF EXISTS bts_guard_profile_ownership ON public.profiles;
CREATE TRIGGER bts_guard_profile_ownership BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION bts_private.guard_profile_ownership();

DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', p.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.profiles FROM anon;
CREATE POLICY "Adult accounts manage only their own profiles" ON public.profiles FOR ALL TO authenticated
USING (public.bts_account_is_active() AND coalesce(user_id, account_id) = auth.uid()
  AND (user_id IS NULL OR account_id IS NULL OR user_id = account_id))
WITH CHECK (public.bts_account_is_active() AND user_id = auth.uid() AND (account_id IS NULL OR account_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.bts_save_profile(p_profile jsonb, p_profile_id uuid DEFAULT NULL, p_guardian_confirmed boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE original public.profiles%ROWTYPE; candidate public.profiles%ROWTYPE; email text; key text;
BEGIN
  IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Please sign in with an active adult account and verify your email.'; END IF;
  IF jsonb_typeof(p_profile) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid profile details.'; END IF;
  FOR key IN SELECT jsonb_object_keys(p_profile) LOOP
    IF key <> ALL(ARRAY['legal_first_name','legal_last_name','date_of_birth','credit_name','nickname','pronouns','bio','headshot_url','headshot_urls','guardian_name','guardian_email','guardian_phone','email','member_display_id','profile_display_id','sections']) THEN
      RAISE EXCEPTION 'That profile field cannot be changed here.';
    END IF;
  END LOOP;
  IF p_profile_id IS NOT NULL THEN
    SELECT * INTO original FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
    IF original.id IS NULL OR coalesce(original.user_id,original.account_id) IS DISTINCT FROM auth.uid()
      OR (original.user_id IS NOT NULL AND original.account_id IS NOT NULL AND original.user_id <> original.account_id) THEN
      RAISE EXCEPTION 'Profile not found.';
    END IF;
  END IF;
  candidate := jsonb_populate_record(original, p_profile);
  candidate.id := coalesce(original.id, gen_random_uuid());
  candidate.user_id := auth.uid(); candidate.account_id := auth.uid();
  candidate.created_at := coalesce(original.created_at, now());
  candidate.member_display_id := coalesce(original.member_display_id,(SELECT display_id FROM public.member_ids WHERE user_id=auth.uid() ORDER BY created_at LIMIT 1));
  -- Serialize suffix allocation for this account and preserve the existing ID format.
  PERFORM 1 FROM bts_private.account_controls WHERE user_id=auth.uid() FOR UPDATE;
  candidate.profile_display_id := coalesce(original.profile_display_id, candidate.member_display_id || '-' || lpad((
    SELECT coalesce(max(substring(profile_display_id from '-([0-9]+)$')::integer),0)+1
    FROM public.profiles WHERE coalesce(user_id,account_id)=auth.uid()
  )::text,2,'0'));
  candidate.headshot_urls := coalesce(candidate.headshot_urls, '{}'::text[]);
  candidate.sections := coalesce(candidate.sections, '{}'::jsonb);
  SELECT u.email INTO email FROM auth.users u WHERE u.id = auth.uid();
  candidate.email := email;
  IF candidate.date_of_birth IS NULL OR candidate.date_of_birth > current_date
    OR candidate.date_of_birth < (current_date - interval '120 years')::date THEN RAISE EXCEPTION 'Please enter a valid date of birth.'; END IF;
  IF candidate.date_of_birth > (current_date - interval '18 years')::date THEN
    IF p_guardian_confirmed IS DISTINCT FROM true AND (original.guardian_user_id IS DISTINCT FROM auth.uid() OR original.guardian_consent_at IS NULL OR original.guardian_consent_version IS DISTINCT FROM '2026-11-15') THEN
      RAISE EXCEPTION 'Confirm that you are this child''s parent or legal guardian and agree to the profile privacy notice.';
    END IF;
    IF nullif(trim(candidate.guardian_name),'') IS NULL THEN RAISE EXCEPTION 'The parent or guardian name is required.'; END IF;
    candidate.guardian_email := email;
    candidate.guardian_user_id := auth.uid();
    IF p_guardian_confirmed THEN
      candidate.guardian_consent_at := now(); candidate.guardian_consent_version := '2026-11-15';
    END IF;
  END IF;
  -- The entire row comes from the locked original plus the explicit field allowlist.
  IF original.id IS NULL THEN
    INSERT INTO public.profiles SELECT candidate.*;
  ELSE
    UPDATE public.profiles SET
      user_id = candidate.user_id, account_id = candidate.account_id,
      legal_first_name = candidate.legal_first_name, legal_last_name = candidate.legal_last_name,
      date_of_birth = candidate.date_of_birth, credit_name = candidate.credit_name,
      nickname = candidate.nickname, pronouns = candidate.pronouns, bio = candidate.bio,
      headshot_url = candidate.headshot_url, headshot_urls = candidate.headshot_urls,
      guardian_name = candidate.guardian_name, guardian_email = candidate.guardian_email,
      guardian_phone = candidate.guardian_phone, guardian_user_id = candidate.guardian_user_id,
      guardian_consent_at = candidate.guardian_consent_at, guardian_consent_version = candidate.guardian_consent_version,
      email = candidate.email, sections = candidate.sections
    WHERE id = original.id;
  END IF;
  RETURN candidate.id;
END;
$$;
REVOKE ALL ON FUNCTION public.bts_save_profile(jsonb,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_save_profile(jsonb,uuid,boolean) TO authenticated;

-- Existing permissive owner policies remain, but an unconfirmed account cannot use them.
CREATE POLICY "Active account requirement for organizations" ON public.organizations AS RESTRICTIVE TO authenticated
USING (public.bts_account_is_active()) WITH CHECK (public.bts_account_is_active());
CREATE POLICY "Active account requirement for member IDs" ON public.member_ids AS RESTRICTIVE TO authenticated
USING (public.bts_account_is_active()) WITH CHECK (public.bts_account_is_active());

DROP POLICY IF EXISTS "Public can read org members" ON public.org_members;
DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.org_invitations;
REVOKE ALL ON public.org_members, public.org_invitations FROM anon;
CREATE POLICY "Active account requirement for memberships" ON public.org_members AS RESTRICTIVE TO authenticated
USING (public.bts_account_is_active()) WITH CHECK (public.bts_account_is_active());
CREATE POLICY "Active account requirement for invitations" ON public.org_invitations AS RESTRICTIVE TO authenticated
USING (public.bts_account_is_active()) WITH CHECK (public.bts_account_is_active());

CREATE OR REPLACE FUNCTION public.bts_preview_org_invitation(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('org_id', i.org_id, 'title', i.title,
    'access_level', CASE WHEN i.access_level IN ('viewer','editor','admin') THEN i.access_level ELSE 'viewer' END,
    'organizations', jsonb_build_object('name', o.name, 'custom_id', o.custom_id, 'logo_url', o.logo_url))
  FROM public.org_invitations i JOIN public.organizations o ON o.id=i.org_id
  WHERE length(p_token) >= 24 AND i.token=p_token AND i.used_at IS NULL AND i.expires_at > now();
$$;
REVOKE ALL ON FUNCTION public.bts_preview_org_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_preview_org_invitation(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.bts_accept_org_invitation(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation public.org_invitations%ROWTYPE; caller_email text; member_id uuid;
BEGIN
  IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with an adult account and verify your email before accepting.'; END IF;
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  SELECT * INTO invitation FROM public.org_invitations
    WHERE token=p_token AND length(p_token)>=24 AND used_at IS NULL AND expires_at > now() FOR UPDATE;
  IF invitation.id IS NULL OR lower(trim(invitation.email)) <> lower(trim(caller_email)) THEN
    RAISE EXCEPTION 'This invitation is unavailable or belongs to a different email address.';
  END IF;
  INSERT INTO public.org_members (org_id,user_id,title,role,access_level)
  VALUES (invitation.org_id,auth.uid(),invitation.title,'member',
    CASE WHEN invitation.access_level IN ('viewer','editor','admin') THEN invitation.access_level ELSE 'viewer' END)
  ON CONFLICT (org_id,user_id) DO NOTHING;
  SELECT id INTO member_id FROM public.org_members WHERE org_id=invitation.org_id AND user_id=auth.uid();
  UPDATE public.org_invitations SET used_at=now() WHERE id=invitation.id;
  RETURN jsonb_build_object('member_id',member_id,'org_id',invitation.org_id);
END;
$$;
REVOKE ALL ON FUNCTION public.bts_accept_org_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_accept_org_invitation(text) TO authenticated;

-- Do not silently transfer the owner's organization through an ordinary update.
CREATE OR REPLACE FUNCTION bts_private.guard_organisation_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND TG_OP='UPDATE' AND NEW.admin_id IS DISTINCT FROM OLD.admin_id THEN
    RAISE EXCEPTION 'Ownership changes require the verified ownership-transfer process.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bts_private.guard_organisation_owner() FROM PUBLIC;
DROP TRIGGER IF EXISTS bts_guard_organisation_owner ON public.organizations;
CREATE TRIGGER bts_guard_organisation_owner BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION bts_private.guard_organisation_owner();

CREATE TABLE IF NOT EXISTS bts_private.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','processing','completed','cancelled')),
  keep_production_contact boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  UNIQUE (user_id)
);
ALTER TABLE bts_private.account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bts_private.account_deletion_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.bts_request_account_deletion(p_keep_production_contact boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request bts_private.account_deletion_requests%ROWTYPE; owns_org boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Sign in with a verified email to request deletion.';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.organizations WHERE admin_id=auth.uid()) INTO owns_org;
  INSERT INTO bts_private.account_deletion_requests (user_id,keep_production_contact)
  VALUES (auth.uid(),coalesce(p_keep_production_contact,false))
  ON CONFLICT (user_id) DO UPDATE SET keep_production_contact=EXCLUDED.keep_production_contact
  RETURNING * INTO request;
  RETURN jsonb_build_object('request_id',request.id,'status',request.status,'requested_at',request.requested_at,
    'owns_organisation',owns_org);
END;
$$;
REVOKE ALL ON FUNCTION public.bts_request_account_deletion(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_request_account_deletion(boolean) TO authenticated;

-- Ownership transfer is a separate, two-person operation. A job title is never ownership.
CREATE TABLE IF NOT EXISTS bts_private.organisation_ownership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  previous_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours'),
  accepted_at timestamptz,
  revoked_at timestamptz
);
ALTER TABLE bts_private.organisation_ownership_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bts_private.organisation_ownership_transfers FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bts_ownership_transfer_candidates(p_organisation_id uuid)
RETURNS TABLE(user_id uuid, display_name text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.bts_organisation_role(p_organisation_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only the organisation owner can transfer ownership.';
  END IF;
  RETURN QUERY SELECT m.user_id,coalesce(nullif(m.display_name,''),m.title,u.email),u.email
  FROM public.org_members m JOIN auth.users u ON u.id=m.user_id
  JOIN bts_private.account_controls c ON c.user_id=u.id
  WHERE m.org_id=p_organisation_id AND m.user_id <> auth.uid()
    AND u.email_confirmed_at IS NOT NULL AND (u.banned_until IS NULL OR u.banned_until<now())
    AND c.status='active' AND c.birth_date <= (current_date-interval '18 years')::date
    AND c.privacy_version='2026-11-15' AND c.terms_version='2026-11-15';
END;
$$;
REVOKE ALL ON FUNCTION public.bts_ownership_transfer_candidates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_ownership_transfer_candidates(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bts_start_ownership_transfer(p_organisation_id uuid,p_recipient_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id uuid; secret text; transfer_id uuid;
BEGIN
  IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your verified adult account.'; END IF;
  SELECT admin_id INTO owner_id FROM public.organizations WHERE id=p_organisation_id FOR UPDATE;
  IF owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the organisation owner can transfer ownership.'; END IF;
  IF p_recipient_id IS NULL OR p_recipient_id=auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.org_members m JOIN auth.users u ON u.id=m.user_id
    JOIN bts_private.account_controls c ON c.user_id=u.id
    WHERE m.org_id=p_organisation_id AND m.user_id=p_recipient_id
      AND u.email_confirmed_at IS NOT NULL AND (u.banned_until IS NULL OR u.banned_until<now())
      AND c.status='active' AND c.birth_date <= (current_date-interval '18 years')::date
      AND c.privacy_version='2026-11-15' AND c.terms_version='2026-11-15'
  ) THEN RAISE EXCEPTION 'Choose an existing member with a verified, active adult account.'; END IF;
  UPDATE bts_private.organisation_ownership_transfers SET revoked_at=now()
    WHERE organisation_id=p_organisation_id AND accepted_at IS NULL AND revoked_at IS NULL;
  secret := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  INSERT INTO bts_private.organisation_ownership_transfers (organisation_id,previous_owner_id,recipient_id,token_hash)
  VALUES (p_organisation_id,auth.uid(),p_recipient_id,encode(sha256(convert_to(secret,'UTF8')),'hex'))
  RETURNING id INTO transfer_id;
  RETURN jsonb_build_object('transfer_id',transfer_id,'token',secret,'expires_at',now()+interval '24 hours');
END;
$$;
REVOKE ALL ON FUNCTION public.bts_start_ownership_transfer(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_start_ownership_transfer(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bts_preview_ownership_transfer(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('organisation_name',o.name,'organisation_id',o.id,'can_accept',t.recipient_id=auth.uid(),'expires_at',t.expires_at)
  FROM bts_private.organisation_ownership_transfers t JOIN public.organizations o ON o.id=t.organisation_id
  WHERE public.bts_account_is_active() AND length(p_token)=64
    AND t.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
    AND auth.uid() IN (t.previous_owner_id,t.recipient_id)
    AND t.accepted_at IS NULL AND t.revoked_at IS NULL AND t.expires_at>now()
    AND o.admin_id=t.previous_owner_id;
$$;
REVOKE ALL ON FUNCTION public.bts_preview_ownership_transfer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_preview_ownership_transfer(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bts_accept_ownership_transfer(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE transfer bts_private.organisation_ownership_transfers%ROWTYPE; owner_id uuid; slug text;
BEGIN
  IF NOT public.bts_account_is_active() OR length(p_token)<>64 THEN RAISE EXCEPTION 'This ownership transfer is unavailable.'; END IF;
  SELECT * INTO transfer FROM bts_private.organisation_ownership_transfers
    WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  IF transfer.id IS NULL THEN RAISE EXCEPTION 'This ownership transfer is unavailable.'; END IF;
  -- Both initiation and acceptance lock the organisation first.
  SELECT o.admin_id,o.slug INTO owner_id,slug FROM public.organizations o WHERE o.id=transfer.organisation_id FOR UPDATE;
  SELECT * INTO transfer FROM bts_private.organisation_ownership_transfers WHERE id=transfer.id FOR UPDATE;
  IF transfer.recipient_id IS DISTINCT FROM auth.uid() OR transfer.previous_owner_id IS DISTINCT FROM owner_id
    OR transfer.accepted_at IS NOT NULL OR transfer.revoked_at IS NOT NULL OR transfer.expires_at<=now()
    OR NOT EXISTS(SELECT 1 FROM public.org_members WHERE org_id=transfer.organisation_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'This ownership transfer is unavailable.';
  END IF;
  INSERT INTO public.org_members (org_id,user_id,access_level,role)
    VALUES (transfer.organisation_id,owner_id,'admin','member')
    ON CONFLICT (org_id,user_id) DO UPDATE SET access_level='admin';
  UPDATE public.organizations SET admin_id=auth.uid() WHERE id=transfer.organisation_id;
  UPDATE bts_private.organisation_ownership_transfers SET accepted_at=now() WHERE id=transfer.id;
  RETURN jsonb_build_object('organisation_id',transfer.organisation_id,'slug',slug,'status','accepted');
END;
$$;
REVOKE ALL ON FUNCTION public.bts_accept_ownership_transfer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bts_accept_ownership_transfer(text) TO authenticated;

-- These counters contain no recipients or message content.
CREATE TABLE IF NOT EXISTS bts_private.email_rate_windows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('test','transactional')),
  window_start timestamptz NOT NULL,
  sent_requests integer NOT NULL DEFAULT 1,
  PRIMARY KEY(user_id,kind,window_start)
);
ALTER TABLE bts_private.email_rate_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bts_private.email_rate_windows FROM PUBLIC,anon,authenticated;

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
          AND tm.is_active AND lower(trim(tm.email))=lower(trim(u.email))
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

-- Authorised production staff can read the specific profile file submitted to
-- their production. Membership does not grant access to an entire family folder.
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
        WHERE tm.production_id=p.id AND tm.is_active AND lower(trim(tm.email))=lower(trim(u.email))
        AND (tm.access_level IN ('producer','admin','owner') OR EXISTS (
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

-- A public storage URL bypasses object SELECT policies. Make profile files private
-- before relying on RLS. The website resolves authorised files to short-lived URLs.
UPDATE storage.buckets SET public=false WHERE id='profile-headshots';
CREATE POLICY "Profile files require account ownership" ON storage.objects AS RESTRICTIVE TO public
USING (bucket_id <> 'profile-headshots' OR (
  public.bts_can_read_profile_file(name)
))
WITH CHECK (bucket_id <> 'profile-headshots' OR (
  public.bts_account_is_active() AND (storage.foldername(name))[1] = auth.uid()::text
));

COMMIT;
