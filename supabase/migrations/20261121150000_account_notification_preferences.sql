BEGIN;
-- Account preferences apply only to the confirmed recipient account. Existing
-- profile-contact eligibility and unsubscribe checks remain in the queue claim.
CREATE FUNCTION public.bts_account_mail_allowed(p_job_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job bts_private.family_mail%rowtype; preference text; metadata jsonb;
BEGIN
 SELECT * INTO job FROM bts_private.family_mail WHERE id=p_job_id AND state='sending' FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 preference:=CASE
  WHEN job.kind='profile_updated' THEN 'circle_notifications'
  WHEN job.kind='production_update' OR (job.kind='production_template' AND job.payload->>'category' IN('production_update','general_update')) THEN 'production_updates'
  WHEN job.kind='activity_reminder' OR (job.kind='production_template' AND job.payload->>'category' IN('audition_reminder','rehearsal_reminder','performance_reminder','volunteer_reminder')) THEN 'activity_reminders'
  WHEN job.kind='circle_update' THEN 'circle_notifications'
  WHEN job.kind='marketing_update' THEN 'marketing_consent'
  ELSE NULL END;
 -- Invitations, access changes, booking/casting/registration/payment confirmations
 -- and volunteer assignment changes are essential and cannot be disabled here.
 IF preference IS NULL THEN RETURN true;END IF;
 SELECT u.raw_user_meta_data INTO metadata FROM auth.users u
 WHERE lower(trim(u.email))=lower(trim(job.recipient)) AND u.email_confirmed_at IS NOT NULL LIMIT 1;
 IF NOT FOUND THEN RETURN true;END IF;
 IF (preference='marketing_consent' AND metadata->'marketing_consent' IS DISTINCT FROM 'true'::jsonb)
 OR (preference<>'marketing_consent' AND metadata->'notification_preferences'->preference='false'::jsonb) THEN
  UPDATE bts_private.family_mail SET state='cancelled',lease_until=NULL,last_error='Not sent: recipient account preference.' WHERE id=job.id;
  RETURN false;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.bts_account_mail_allowed(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_account_mail_allowed(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
