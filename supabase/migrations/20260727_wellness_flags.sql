-- Wellness check-ins.
--
-- Health-adjacent data about identifiable employees. Two rules govern this table:
--   1. Access is enforced here, in Postgres — never in the browser.
--   2. Nothing is kept indefinitely. See the purge job at the bottom.
--
-- Note on policy design: the app's client-side isLeadership() also matches on
-- display_name against LEADERSHIP_NAMES. display_name is user-settable metadata
-- and is therefore spoofable. It is fine for showing or hiding a button; it must
-- never appear here. Every policy below keys on the JWT email claim only.

create table public.wellness_flags (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  user_name text,
  category text not null check (category in ('unwell','low','personal','other')),
  capacity text not null check (capacity in ('full','reduced','none')),
  note text check (note is null or length(note) <= 600),
  expected_days int check (expected_days is null or expected_days between 1 and 90),
  created_at timestamptz not null default now(),
  acknowledged_by text,
  acknowledged_at timestamptz
);

create index wellness_flags_created_idx on public.wellness_flags (created_at desc);

alter table public.wellness_flags enable row level security;

-- A person may file a check-in only as themselves.
create policy "own_insert_wellness_flags" on public.wellness_flags
  for insert to authenticated
  with check ((auth.jwt() ->> 'email') = user_email);

-- A person may read their own check-ins back.
create policy "own_select_wellness_flags" on public.wellness_flags
  for select to authenticated
  using ((auth.jwt() ->> 'email') = user_email);

-- Supervisors may read all check-ins.
-- Keep this list in sync with LEADERSHIP_EMAILS in index.html and wellness/index.html.
create policy "leadership_select_wellness_flags" on public.wellness_flags
  for select to authenticated
  using ((auth.jwt() ->> 'email') in ('jeff@ataandeadvisors.com'));

-- Supervisors may acknowledge. They cannot edit what someone wrote.
create policy "leadership_ack_wellness_flags" on public.wellness_flags
  for update to authenticated
  using ((auth.jwt() ->> 'email') in ('jeff@ataandeadvisors.com'))
  with check ((auth.jwt() ->> 'email') in ('jeff@ataandeadvisors.com'));

-- No delete policy for anyone. Removal happens only via the purge below, which
-- runs as the table owner and bypasses RLS.

-- ── Supervisor contacts ─────────────────────────────────────────────
-- Held here rather than in wellness/index.html because that file is served
-- publicly — anything written into it is readable by anyone, whether or not
-- the UI hides it, and personal numbers on open pages get scraped.
-- RLS restricts reads to authenticated users, so the anon key alone cannot
-- retrieve these.

create table public.wellness_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  phone text not null,          -- E.164, for the tel: link
  display_number text,          -- how it's shown, e.g. '0700 000 000'
  note text,
  sort int not null default 0,
  active boolean not null default true
);

alter table public.wellness_contacts enable row level security;

-- Any signed-in team member may read. No insert/update/delete policy —
-- edit these rows from the Supabase dashboard.
create policy "authenticated_select_wellness_contacts" on public.wellness_contacts
  for select to authenticated
  using (true);

-- No seed row here on purpose. This repository is PUBLIC, so a personal phone
-- number committed to it would be permanently in git history and indexed.
-- Add contacts by hand in the Supabase dashboard (or the SQL editor), e.g.:
--
--   insert into public.wellness_contacts
--     (name, role, phone, display_number, note, sort)
--   values
--     ('Name', 'direct line', '+255700000000', '0700 000 000',
--      'Call or message if you need to talk to someone at work.', 0);

-- ── Tiered retention ────────────────────────────────────────────────
-- The free-text note is the part someone might regret writing, so it has the
-- shortest life. The coarse record survives long enough to notice a pattern
-- (e.g. repeated check-ins in a quarter), then goes.
--
--   note           erased at 30 days
--   entire row     deleted at 90 days

create extension if not exists pg_cron;

select cron.schedule(
  'purge-wellness-flags',
  '0 3 * * *',
  $$
    update public.wellness_flags
       set note = null
     where note is not null
       and created_at < now() - interval '30 days';

    delete from public.wellness_flags
     where created_at < now() - interval '90 days';
  $$
);
