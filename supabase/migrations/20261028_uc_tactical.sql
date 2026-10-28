-- Uplift Communities tactical meeting reports.
--
-- Fully separate from the AA Team's public.tactical table. The pages that use
-- it (/uc-tactical and /uc-tactical/form) have no login: anyone holding the
-- link can file, read and edit a report. That is deliberate -- the link is the
-- only lock. There is no delete policy, so a report can be changed but not
-- removed from the browser; delete rows here in the SQL editor if needed.
--
-- One report per person per meeting. week_of is the Wednesday of the tactical
-- call; the form re-submitting for the same person and Wednesday overwrites
-- the earlier report (upsert on person, week_of).

create table if not exists public.uc_tactical (
  id         uuid primary key default gen_random_uuid(),
  person     text not null check (length(trim(person)) between 1 and 80),
  week_of    date not null check (extract(isodow from week_of) = 3),
  rocks      text,
  headlines  text,
  issues     text,
  actions    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person, week_of)
);

create index if not exists uc_tactical_week_idx on public.uc_tactical (week_of desc);

comment on table  public.uc_tactical           is 'Uplift Communities tactical reports. Public, no login: /uc-tactical';
comment on column public.uc_tactical.week_of   is 'Wednesday of the tactical call this report is for.';
comment on column public.uc_tactical.rocks     is 'ROCK Updates';
comment on column public.uc_tactical.headlines is 'Customer / Contractors Headlines';
comment on column public.uc_tactical.issues    is 'Issues: Identify / Discuss / Resolve';
comment on column public.uc_tactical.actions   is 'Action Items / Priorities';

-- Keep updated_at honest on edits.
create or replace function public.uc_tactical_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  return new;
end $$;

drop trigger if exists uc_tactical_touch on public.uc_tactical;
create trigger uc_tactical_touch before update on public.uc_tactical
  for each row execute function public.uc_tactical_touch();

alter table public.uc_tactical enable row level security;

grant select, insert, update on public.uc_tactical to anon, authenticated;

drop policy if exists uc_tactical_read   on public.uc_tactical;
drop policy if exists uc_tactical_insert on public.uc_tactical;
drop policy if exists uc_tactical_update on public.uc_tactical;

create policy uc_tactical_read   on public.uc_tactical for select to anon, authenticated using (true);
create policy uc_tactical_insert on public.uc_tactical for insert to anon, authenticated with check (true);
create policy uc_tactical_update on public.uc_tactical for update to anon, authenticated using (true) with check (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — expect 3 policies (read, insert, update) and no delete policy.
-- ═══════════════════════════════════════════════════════════════════════════
select policyname, cmd, roles::text from pg_policies where tablename = 'uc_tactical' order by policyname;
