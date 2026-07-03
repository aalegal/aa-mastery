create table public.job_leads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text,
  source text not null default 'other',
  url text,
  apply_email text,
  pay text,
  location text,
  description text,
  posted_date date,
  found_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','applied','dismissed')),
  dedupe_hash text not null unique
);

alter table public.job_leads enable row level security;

create policy "admin_select_job_leads" on public.job_leads
  for select using ((auth.jwt() ->> 'email') = 'jeff@ataandeadvisors.com');

create policy "admin_update_job_leads" on public.job_leads
  for update using ((auth.jwt() ->> 'email') = 'jeff@ataandeadvisors.com')
  with check ((auth.jwt() ->> 'email') = 'jeff@ataandeadvisors.com');
-- No insert/delete policies: inserts happen only via the Edge Function's service role (bypasses RLS).
