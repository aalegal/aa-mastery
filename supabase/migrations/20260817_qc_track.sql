-- QC Track — Phase 1.
--
-- Two rules govern qc_attempts, for the same reasons set out in
-- 20260727_wellness_flags.sql:
--   1. Access is enforced here, in Postgres — never in the browser.
--   2. Policies key on the JWT email claim only. The app's client-side
--      isLeadership() also matches display_name against LEADERSHIP_NAMES, and
--      display_name is user-settable metadata and therefore spoofable. It is
--      fine for showing or hiding a button; it must never appear here.
--
-- This repository is public. No score and no employee name is ever committed to
-- a file — performance data lives only in these tables.

create table public.qc_projects (
  case_key                  text primary key,
  display_name              text not null,
  target_pace_docs_per_hour numeric not null default 60,
  max_defects_per_1000      numeric not null default 1,
  response_window_minutes   int     not null default 2,
  practice_density          numeric not null default 0.15,
  practice_batch_size       int     not null default 50,
  cert_density              numeric not null default 0.02,
  cert_batch_size           int     not null default 250,
  supports_certification    boolean not null default false,
  active                    boolean not null default true,
  updated_at                timestamptz not null default now()
);

-- Joba has 55 documents: enough for a 50-document practice batch, not for a
-- 250-document certification batch. TransRidge carries both.
insert into public.qc_projects (case_key, display_name, supports_certification) values
  ('joba',    'Joba v. Bukando',                  false),
  ('firstam', 'TransRidge v. Cascade Headwaters', true);

alter table public.qc_projects enable row level security;

create policy "all_read_qc_projects" on public.qc_projects
  for select to authenticated using (true);

create policy "leadership_write_qc_projects" on public.qc_projects
  for all to authenticated
  using      ((auth.jwt() ->> 'email') in ('jeff@ataandeadvisors.com'))
  with check ((auth.jwt() ->> 'email') in ('jeff@ataandeadvisors.com'));

create table public.qc_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_email     text not null,
  case_key       text not null references public.qc_projects(case_key),
  batch_no       int  not null,
  batch_type     text not null check (batch_type in ('practice','certification')),
  seed           text not null,
  started_at     timestamptz not null,
  completed_at   timestamptz,
  docs_reviewed  int     not null default 0,
  defects        numeric,
  accuracy       numeric,
  detail         jsonb   not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index qc_attempts_user_idx on public.qc_attempts (user_email, completed_at desc);

alter table public.qc_attempts enable row level security;

-- A person records batches only as themselves.
create policy "own_insert_qc_attempts" on public.qc_attempts
  for insert to authenticated
  with check ((auth.jwt() ->> 'email') = user_email);

create policy "own_select_qc_attempts" on public.qc_attempts
  for select to authenticated
  using ((auth.jwt() ->> 'email') = user_email);

-- Leadership may read all attempts. Keep this list in sync with
-- LEADERSHIP_EMAILS in index.html.
create policy "leadership_select_qc_attempts" on public.qc_attempts
  for select to authenticated
  using ((auth.jwt() ->> 'email') in ('jeff@ataandeadvisors.com'));

-- No update and no delete policy for anyone. A completed batch is a record of
-- what happened; a score that can be edited after the fact is not a measurement.
