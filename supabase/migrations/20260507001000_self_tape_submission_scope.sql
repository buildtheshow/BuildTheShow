alter table if exists public.self_tape_submissions
  add column if not exists scope text not null default 'general_audition';

create index if not exists self_tape_submissions_scope_idx
  on public.self_tape_submissions (production_id, applicant_id, scope);
