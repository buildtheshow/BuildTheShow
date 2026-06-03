-- Complete volunteer_signups column set
-- Run this once, then reload the schema cache:
-- Supabase Dashboard → API → Schema Cache → Reload

alter table public.volunteer_signups
  add column if not exists production_id       uuid references productions(id) on delete cascade,
  add column if not exists portal_token        text,
  add column if not exists name                text,
  add column if not exists first_name          text,
  add column if not exists last_name           text,
  add column if not exists volunteer_name      text,
  add column if not exists email               text,
  add column if not exists volunteer_email     text,
  add column if not exists volunteer_passcode  text,
  add column if not exists phone               text,
  add column if not exists notes               text,
  add column if not exists message             text,
  add column if not exists status              text default 'pending',
  add column if not exists role_name           text,
  add column if not exists department          text,
  add column if not exists check_in_with       text,
  add column if not exists shift_date          date,
  add column if not exists shift_start_time    time,
  add column if not exists shift_end_time      time,
  add column if not exists required_dates      text[] default '{}',
  add column if not exists approved_hours      numeric,
  add column if not exists discount_requested  boolean default false,
  add column if not exists discount_performer  text,
  add column if not exists created_at          timestamptz default now();

-- Drop NOT NULL on email so internal signups without an email are valid
alter table public.volunteer_signups alter column email drop not null;
