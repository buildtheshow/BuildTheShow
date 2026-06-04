create or replace function public.bts_trigger_registration_complete_email()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  is_complete boolean;
  was_complete boolean;
  sent_at text;
begin
  is_complete := lower(coalesce(new.custom_answers ->> '__bts_registration_complete', '')) in ('true', 't', '1', 'yes', 'y');
  was_complete := lower(coalesce(old.custom_answers ->> '__bts_registration_complete', '')) in ('true', 't', '1', 'yes', 'y');
  sent_at := trim(coalesce(new.custom_answers ->> '__bts_registration_confirmation_sent_at', ''));

  if is_complete and not was_complete and sent_at = '' then
    perform net.http_post(
      url := 'https://tkmaiktxpwqfbgeojbnf.supabase.co/functions/v1/send-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE4MTcsImV4cCI6MjA4OTMwNzgxN30.TkTZBNWUatk3Y6Vmfv1hIRR3DfVjgwauwa76Pf00J_8'
      ),
      body := jsonb_build_object(
        'applicant_id', new.id,
        'production_id', new.production_id,
        'category', 'registration_completed',
        'trigger', 'registration_completed',
        'context', jsonb_build_object('send_source', 'registration_complete_db_trigger')
      ),
      timeout_milliseconds := 10000
    );
  end if;

  return new;
end;
$$;

drop trigger if exists bts_registration_complete_email_update on public.audition_applications;

create trigger bts_registration_complete_email_update
after update of custom_answers on public.audition_applications
for each row
when (new.custom_answers is not null and new.custom_answers is distinct from old.custom_answers)
execute function public.bts_trigger_registration_complete_email();
