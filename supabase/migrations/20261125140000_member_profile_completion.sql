-- Private contacts are deliberately separate from profiles.sections and circle keys.
CREATE TABLE bts_private.member_contact_details(
 profile_id uuid PRIMARY KEY REFERENCES public.profiles(id),data jsonb NOT NULL DEFAULT '{}',
 version integer NOT NULL DEFAULT 1,updated_by uuid NOT NULL REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE bts_private.member_contact_shares(
 profile_id uuid REFERENCES public.profiles(id),production_id uuid REFERENCES public.productions(id),
 shared_by uuid NOT NULL REFERENCES auth.users(id),data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(profile_id,production_id));
CREATE TABLE bts_private.member_absence_reports(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES public.profiles(id),production_id uuid NOT NULL REFERENCES public.productions(id),
 event_key text NOT NULL CHECK(length(event_key)<=250),event_start timestamptz NOT NULL,event_title text NOT NULL,
 absence_type text NOT NULL CHECK(absence_type IN('whole','late','early')),change_time timestamptz,note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 reported_by uuid NOT NULL REFERENCES auth.users(id),state text NOT NULL DEFAULT 'reported' CHECK(state IN('reported','acknowledged','withdrawn')),
 acknowledged_by uuid REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,UNIQUE(profile_id,event_key));
ALTER TABLE bts_private.member_contact_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE bts_private.member_contact_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE bts_private.member_absence_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bts_private.member_contact_details,bts_private.member_contact_shares,bts_private.member_absence_reports FROM PUBLIC,anon,authenticated;

-- Contact/emergency readers must be the organisation owner/admin or an active,
-- account-bound production contact. A role name in browser state is insufficient.
CREATE FUNCTION bts_private.member_contact_staff(p_production_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bts_account_is_active() AND EXISTS(SELECT 1 FROM public.productions p WHERE p.id=p_production_id AND(
 public.bts_organisation_role(p.organization_id) IN('owner','admin') OR EXISTS(
 SELECT 1 FROM public.production_team_member_sessions s JOIN public.production_team_members t ON t.id=s.team_member_id AND t.production_id=s.production_id
 WHERE s.production_id=p.id AND s.auth_user_id=auth.uid() AND s.revoked_at IS NULL AND s.expires_at>now() AND t.is_active
 AND lower(t.role) ~ '(^|[^a-z])producer([^a-z]|$)|stage[ _-]*manager|production[ _-]*manager|volunteer[ _-]*coord|coord.*volunteer')));
$$;
REVOKE ALL ON FUNCTION bts_private.member_contact_staff(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bts_member_contacts(p_profile_id uuid,p_action text DEFAULT 'read',p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_row bts_private.member_contact_details%rowtype; clean jsonb:='{}'; k text; v text; prod uuid; shared jsonb; person text; home jsonb; shares jsonb;
BEGIN
 IF NOT public.bts_account_is_active() OR NOT public.bts_profile_access(p_profile_id,true) THEN RAISE EXCEPTION 'This profile is not available to your account.';END IF;
 IF NOT public.bts_profile_manager(p_profile_id) THEN
  IF p_action='read' THEN RETURN jsonb_build_object('can_edit',false);END IF;
  RAISE EXCEPTION 'Only the adult who manages this profile’s access can change its private contacts.';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('member_contacts:'||p_profile_id,0));
 SELECT * INTO current_row FROM bts_private.member_contact_details WHERE profile_id=p_profile_id FOR UPDATE;
 IF p_action='save' THEN
  IF jsonb_typeof(p_data->'details') IS DISTINCT FROM 'object' OR octet_length((p_data->'details')::text)>10000 THEN RAISE EXCEPTION 'Check the contact details before saving.';END IF;
  IF coalesce(current_row.version,0) IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'These contact details changed in another window. Reload before saving.';END IF;
  FOR k,v IN SELECT key,value FROM jsonb_each_text(p_data->'details') LOOP
   IF k<>ALL(ARRAY['contact_name','relationship','email','phone','emergency_name','emergency_relationship','emergency_phone']) OR length(v)>320 THEN RAISE EXCEPTION 'Check the contact fields before saving.';END IF;
   IF k='email' AND nullif(trim(v),'') IS NOT NULL AND trim(v)!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Enter a valid contact email address.';END IF;
   clean:=clean||jsonb_build_object(k,trim(v));
  END LOOP;
  INSERT INTO bts_private.member_contact_details(profile_id,data,updated_by) VALUES(p_profile_id,clean,auth.uid())
  ON CONFLICT(profile_id) DO UPDATE SET data=excluded.data,updated_by=auth.uid(),updated_at=now(),version=member_contact_details.version+1 RETURNING * INTO current_row;
 ELSIF p_action IN('share','unshare') THEN
  prod:=public.try_uuid(p_data->>'production_id');
  home:=public.bts_my_home(prod);
  IF prod IS NULL THEN RAISE EXCEPTION 'Choose a production.';END IF;
  IF p_action='share' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(home->'activities','[]')||coalesce(home->'volunteers','[]')||coalesce(home->'participations','[]')) a WHERE a->>'profile_id'=p_profile_id::text AND a->>'production_id'=prod::text AND coalesce(a->>'status','')!~*'(cancel|withdraw|declin|reject|archiv)') THEN RAISE EXCEPTION 'Choose a production this person is part of.';END IF;
  IF p_action='unshare' THEN DELETE FROM bts_private.member_contact_shares WHERE profile_id=p_profile_id AND production_id=prod;
  ELSE
   IF current_row.profile_id IS NULL OR current_row.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'Save and review the current contact details before sharing.';END IF;
   shared:='{}';
   IF p_data->'contact'='true'::jsonb THEN shared:=shared||jsonb_build_object('contact_name',current_row.data->>'contact_name','relationship',current_row.data->>'relationship','email',current_row.data->>'email','phone',current_row.data->>'phone');END IF;
   IF p_data->'emergency'='true'::jsonb THEN shared:=shared||jsonb_build_object('emergency_name',current_row.data->>'emergency_name','emergency_relationship',current_row.data->>'emergency_relationship','emergency_phone',current_row.data->>'emergency_phone');END IF;
   IF shared='{}' THEN RAISE EXCEPTION 'Choose the details you want to share.';END IF;
   INSERT INTO bts_private.member_contact_shares(profile_id,production_id,shared_by,data) VALUES(p_profile_id,prod,auth.uid(),shared)
   ON CONFLICT(profile_id,production_id) DO UPDATE SET data=excluded.data,shared_by=auth.uid(),updated_at=now();
  END IF;
 ELSIF p_action<>'read' THEN RAISE EXCEPTION 'Choose a contact action.';END IF;
 IF p_action<>'read' THEN INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details) VALUES(p_profile_id,auth.uid(),'private_contacts_'||p_action,jsonb_build_object('production_id',prod));END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('production_id',s.production_id,'title',p.title,'contact',s.data?'contact_name','emergency',s.data?'emergency_name','updated_at',s.updated_at)),'[]') INTO shares FROM bts_private.member_contact_shares s JOIN public.productions p ON p.id=s.production_id WHERE s.profile_id=p_profile_id AND s.shared_by=auth.uid();
 SELECT coalesce(nullif(concat_ws(' ',u.raw_user_meta_data->>'first_name',u.raw_user_meta_data->>'last_name'),''),'You') INTO person FROM auth.users u WHERE u.id=auth.uid();
 RETURN jsonb_build_object('can_edit',true,'manager_name',person,'details',coalesce(current_row.data,'{}'),'version',coalesce(current_row.version,0),'shares',shares);
END $$;
REVOKE ALL ON FUNCTION public.bts_member_contacts(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_member_contacts(uuid,text,jsonb) TO authenticated;

CREATE FUNCTION public.bts_production_member_contacts(p_production_id uuid,p_profile_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT bts_private.member_contact_staff(p_production_id) THEN RAISE EXCEPTION 'This production’s private contacts are not available to your account.';END IF;
 SELECT s.data INTO result FROM bts_private.member_contact_shares s WHERE s.profile_id=p_profile_id AND s.production_id=p_production_id AND EXISTS(SELECT 1 FROM bts_private.profile_controls c WHERE c.profile_id=s.profile_id AND c.consent_state='active' AND(c.subject_id=s.shared_by OR(c.subject_id IS NULL AND c.manager_id=s.shared_by) OR(c.kind='child' AND c.manager_id=s.shared_by))) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=s.profile_id AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM bts_private.profile_controls c WHERE c.profile_id=p.id AND c.kind='child' AND p.date_of_birth<=(current_date-interval '18 years')::date));
 RETURN coalesce(result,'{}');
END $$;
REVOKE ALL ON FUNCTION public.bts_production_member_contacts(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_production_member_contacts(uuid,uuid) TO authenticated;

CREATE FUNCTION public.bts_member_absence(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE profile uuid:=public.try_uuid(p_data->>'profile_id'); prod uuid:=public.try_uuid(p_data->>'production_id'); item jsonb; record bts_private.member_absence_reports%rowtype; event_day date; kind text; changed timestamptz; msg text; target text; detail jsonb; person text;
BEGIN
 IF NOT public.bts_account_is_active() THEN RAISE EXCEPTION 'Sign in with your adult account.';END IF;
 IF p_action='production' THEN
  IF NOT bts_private.member_contact_staff(prod) THEN RAISE EXCEPTION 'Attendance reports are not available to this account.';END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('name',p.credit_name) ORDER BY r.event_start) FROM bts_private.member_absence_reports r JOIN public.profiles p ON p.id=r.profile_id WHERE r.production_id=prod AND r.event_start>=now()-interval '7 days' AND p.deleted_at IS NULL),'[]');
 END IF;
 IF p_action='acknowledge' THEN
  SELECT * INTO record FROM bts_private.member_absence_reports WHERE id=public.try_uuid(p_data->>'id') FOR UPDATE;
  IF record.id IS NULL OR NOT bts_private.member_contact_staff(record.production_id) OR record.state='withdrawn' THEN RAISE EXCEPTION 'This report is not available to acknowledge.';END IF;
  UPDATE bts_private.member_absence_reports SET state='acknowledged',acknowledged_by=auth.uid(),updated_at=now(),version=version+1 WHERE id=record.id RETURNING * INTO record;
  RETURN to_jsonb(record);
 END IF;
 IF profile IS NULL OR NOT public.bts_profile_access(profile,true) THEN RAISE EXCEPTION 'This profile is not available to your account.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('member_absence:'||profile||coalesce(p_data->>'event_key',''),0));
 SELECT * INTO record FROM bts_private.member_absence_reports WHERE profile_id=profile AND event_key=p_data->>'event_key' FOR UPDATE;
 IF p_action='read' THEN RETURN CASE WHEN record.id IS NULL THEN '{}'::jsonb ELSE to_jsonb(record) END;END IF;
 IF p_action NOT IN('report','withdraw') THEN RAISE EXCEPTION 'Choose an absence action.';END IF;
 IF (SELECT count(*) FROM bts_private.family_audit WHERE profile_id=profile AND actor_id=auth.uid() AND action IN('absence_report','absence_withdraw') AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'Several updates have already been sent today. Contact the production team directly for another change.';END IF;
 IF coalesce(record.version,0) IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'This report changed. Reload it before making another change.';END IF;
 IF p_action='withdraw' THEN
  IF record.id IS NULL THEN RAISE EXCEPTION 'There is no absence report to withdraw.';END IF;
  prod:=record.production_id;item:=jsonb_build_object('title',record.event_title,'start_time',record.event_start);
  UPDATE bts_private.member_absence_reports SET state='withdrawn',updated_at=now(),reported_by=auth.uid(),version=version+1 WHERE id=record.id RETURNING * INTO record;
 ELSE
  event_day:=(p_data->>'event_date')::date;
  IF event_day IS NULL THEN RAISE EXCEPTION 'Choose a scheduled event.';END IF;
  SELECT e INTO item FROM jsonb_array_elements(public.bts_member_calendar(ARRAY[profile],event_day-1,event_day+2,prod)) e WHERE e->>'id'=p_data->>'event_key' AND e->>'call_status' IN('called','booked','shift') LIMIT 1;
  IF item IS NULL OR coalesce((item->>'end_time')::timestamptz,(item->>'start_time')::timestamptz)<now() THEN RAISE EXCEPTION 'Choose an upcoming event this person is called for.';END IF;
  prod:=(item->>'production_id')::uuid;kind:=p_data->>'absence_type';changed:=nullif(p_data->>'change_time','')::timestamptz;
  IF kind IS NULL OR kind NOT IN('whole','late','early') THEN RAISE EXCEPTION 'Choose what this person will miss.';END IF;
  IF kind<>'whole' AND(changed IS NULL OR changed<=(item->>'start_time')::timestamptz OR changed>=coalesce((item->>'end_time')::timestamptz,(item->>'start_time')::timestamptz) OR coalesce((item->>'time_tbd')::boolean,false) OR coalesce((item->>'all_day')::boolean,false)) THEN RAISE EXCEPTION 'Choose a time within this scheduled event.';END IF;
  INSERT INTO bts_private.member_absence_reports(profile_id,production_id,event_key,event_start,event_title,absence_type,change_time,note,reported_by)
  VALUES(profile,prod,item->>'id',(item->>'start_time')::timestamptz,item->>'title',kind,CASE WHEN kind<>'whole' THEN changed END,coalesce(p_data->>'note',''),auth.uid())
  ON CONFLICT(profile_id,event_key) DO UPDATE SET absence_type=excluded.absence_type,change_time=excluded.change_time,note=excluded.note,reported_by=auth.uid(),state='reported',acknowledged_by=NULL,updated_at=now(),version=member_absence_reports.version+1 RETURNING * INTO record;
 END IF;
 detail:=public.bts_member_production_details(prod,profile);target:=detail->'contact'->>'email';
 IF target IS NULL OR target!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'The production has no contact email. Contact the team directly; this report has not been sent.';END IF;
 SELECT credit_name INTO person FROM public.profiles WHERE id=profile;
 INSERT INTO bts_private.family_mail(actor_id,recipient,kind,profile_id,payload) VALUES(auth.uid(),lower(target),'absence_report',profile,jsonb_build_object('production_id',prod,'production',detail->'production'->>'title','org_slug',(SELECT coalesce(nullif(o.slug,''),o.id::text) FROM public.productions p JOIN public.organizations o ON o.id=p.organization_id WHERE p.id=prod),'production_slug',(SELECT coalesce(nullif(p.slug,''),p.id::text) FROM public.productions p WHERE p.id=prod),'event_title',record.event_title,'event_start',record.event_start,'absence_type',record.absence_type,'state',record.state,'report_id',record.id));
 INSERT INTO bts_private.family_audit(profile_id,actor_id,action,details) VALUES(profile,auth.uid(),'absence_'||p_action,jsonb_build_object('report_id',record.id));
 RETURN to_jsonb(record)||jsonb_build_object('recipient_name',detail->'contact'->>'name','email_queued',true);
END $$;
REVOKE ALL ON FUNCTION public.bts_member_absence(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_member_absence(text,jsonb) TO authenticated;

-- Cancel queued attendance messages if the production contact has since left.
ALTER FUNCTION public.bts_family_mail_claim() RENAME TO bts_family_mail_claim_before_member_completion;
CREATE FUNCTION public.bts_family_mail_claim() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE bts_private.family_mail m SET state='cancelled' WHERE m.kind='absence_report' AND m.state IN('pending','failed') AND NOT EXISTS(
 SELECT 1 FROM public.production_team_members t WHERE t.production_id=public.try_uuid(m.payload->>'production_id') AND t.is_active AND lower(trim(t.email))=m.recipient AND lower(t.role) ~ '(^|[^a-z])producer([^a-z]|$)|production[ _-]*manager|volunteer[ _-]*coord|coord.*volunteer'
 UNION ALL SELECT 1 FROM public.productions p JOIN public.organizations o ON o.id=p.organization_id WHERE p.id=public.try_uuid(m.payload->>'production_id') AND o.show_contact AND lower(trim(o.email))=m.recipient);
 RETURN public.bts_family_mail_claim_before_member_completion();
END $$;
REVOKE ALL ON FUNCTION public.bts_family_mail_claim_before_member_completion(),public.bts_family_mail_claim() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_family_mail_claim() TO service_role;
CREATE FUNCTION public.bts_member_absence_batch(p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE id text; result jsonb:='[]';
BEGIN
 IF NOT public.bts_account_is_active() OR jsonb_typeof(p_data->'profile_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'profile_ids') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Choose at least one authorised member.';END IF;
 FOR id IN SELECT DISTINCT value FROM jsonb_array_elements_text(p_data->'profile_ids') ORDER BY value LOOP
  result:=result||jsonb_build_array(public.bts_member_absence('report',(p_data-'profile_ids'-'versions')||jsonb_build_object('profile_id',id,'version',p_data->'versions'->id)));
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.bts_member_absence_batch(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_member_absence_batch(jsonb) TO authenticated;

-- Staff receive only files actually selected in a submitted application/booking.
-- A production relationship alone must not open every saved headshot or CV.
CREATE OR REPLACE FUNCTION public.bts_file_permission(p_bucket text,p_name text,p_rank integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bts_private.profile_file_keys WHERE bucket=p_bucket AND name=p_name) THEN
 EXISTS(SELECT 1 FROM bts_private.profile_file_keys f WHERE f.bucket=p_bucket AND f.name=p_name AND(
 (public.bts_profile_access(f.profile_id,p_rank<>1) AND(p_rank=1 OR bts_private.file_permission_before_households(p_bucket,p_name,p_rank))) OR
 (p_rank=1 AND EXISTS(SELECT 1 FROM public.audition_applications a WHERE a.profile_id=f.profile_id
 AND(public.bts_production_page_permission(a.production_id,'auditions.general',1) OR public.bts_production_page_permission(a.production_id,'cast_list',1))
 AND('https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/'||p_bucket||'/'||p_name) IN(a.headshot_url,a.file_url,a.custom_answers->'__bts_profile_submission'->>'headshot_url',a.custom_answers->'__bts_profile_submission'->>'resume_url')))
 OR(p_rank=1 AND EXISTS(SELECT 1 FROM public.audition_bookings a WHERE a.profile_id=f.profile_id
 AND(public.bts_production_page_permission(a.production_id,'auditions.general',1) OR public.bts_production_page_permission(a.production_id,'cast_list',1))
 AND('https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/'||p_bucket||'/'||p_name) IN(a.headshot_url,a.custom_answers->'__bts_profile_submission'->>'headshot_url',a.custom_answers->'__bts_profile_submission'->>'resume_url')))))
 ELSE bts_private.file_permission_before_households(p_bucket,p_name,p_rank) END;
$$;
