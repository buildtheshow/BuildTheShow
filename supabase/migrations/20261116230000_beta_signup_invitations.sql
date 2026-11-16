-- Beta access is an invitation to create an adult login, never an application role.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE bts_private.beta_invitations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),label text NOT NULL,
 code_hash text UNIQUE NOT NULL,max_uses integer NOT NULL CHECK(max_uses BETWEEN 1 AND 5000),
 used_count integer NOT NULL DEFAULT 0 CHECK(used_count>=0 AND used_count<=max_uses),
 expires_at timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON bts_private.beta_invitations FROM PUBLIC,anon,authenticated;
ALTER TABLE bts_private.account_controls ADD COLUMN beta_invitation_id uuid REFERENCES bts_private.beta_invitations(id);
CREATE FUNCTION bts_private.beta_code_hash(p_code text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code,''),'[-[:space:]]','','g')),'UTF8')),'hex');
$$;
REVOKE ALL ON FUNCTION bts_private.beta_code_hash(text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bts_check_beta_code(p_code text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF length(coalesce(p_code,'')) NOT BETWEEN 10 AND 100 THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM bts_private.beta_invitations WHERE code_hash=bts_private.beta_code_hash(p_code) AND revoked_at IS NULL AND expires_at>now() AND used_count<max_uses);
END $$;
REVOKE ALL ON FUNCTION public.bts_check_beta_code(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_check_beta_code(text) TO anon,authenticated;
CREATE FUNCTION public.bts_issue_beta_code(p_label text,p_max_uses integer DEFAULT 25,p_valid_days integer DEFAULT 30) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE raw text:=upper(replace(gen_random_uuid()::text,'-','')); code text; invitation bts_private.beta_invitations%rowtype;
BEGIN
 IF length(trim(coalesce(p_label,''))) NOT BETWEEN 2 AND 150 OR p_max_uses IS NULL OR p_max_uses NOT BETWEEN 1 AND 5000 OR p_valid_days IS NULL OR p_valid_days NOT BETWEEN 1 AND 90 THEN RAISE EXCEPTION 'Choose a label, 1 to 5000 signups and 1 to 90 valid days.';END IF;
 code:='BTS-'||substr(raw,1,8)||'-'||substr(raw,9,8)||'-'||substr(raw,17,8)||'-'||substr(raw,25,8);
 INSERT INTO bts_private.beta_invitations(label,code_hash,max_uses,expires_at) VALUES(trim(p_label),bts_private.beta_code_hash(code),p_max_uses,now()+make_interval(days=>p_valid_days)) RETURNING * INTO invitation;
 RETURN jsonb_build_object('id',invitation.id,'code',code,'max_uses',invitation.max_uses,'expires_at',invitation.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.bts_issue_beta_code(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_issue_beta_code(text,integer,integer) TO service_role;
CREATE FUNCTION bts_private.require_beta_invitation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation_id uuid; code text:=NEW.raw_user_meta_data->>'beta_code';
BEGIN
 IF length(coalesce(code,'')) NOT BETWEEN 10 AND 100 THEN RAISE EXCEPTION 'A valid beta invitation code is required to sign up.';END IF;
 -- A single conditional update reserves a use atomically, including concurrent signup requests.
 UPDATE bts_private.beta_invitations SET used_count=used_count+1
 WHERE code_hash=bts_private.beta_code_hash(code) AND revoked_at IS NULL AND expires_at>now() AND used_count<max_uses RETURNING id INTO invitation_id;
 IF invitation_id IS NULL THEN RAISE EXCEPTION 'This beta invitation is invalid, expired or fully used.';END IF;
 UPDATE bts_private.account_controls SET beta_invitation_id=invitation_id WHERE user_id=NEW.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Adult account registration must run before beta admission.';END IF;
 NEW.raw_user_meta_data:=NEW.raw_user_meta_data-'beta_code';
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bts_private.require_beta_invitation() FROM PUBLIC,anon,authenticated;
-- Trigger names determine order: the existing adult/consent registration runs first.
CREATE TRIGGER bts_zz_require_beta_invitation BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION bts_private.require_beta_invitation();
NOTIFY pgrst,'reload schema';
COMMIT;
