-- A shareable tactical-report form for people who have no login.
--
-- The link goes to /tactical. Anyone holding it may file a report; nobody
-- holding it may read one. That asymmetry is the whole design: an insert policy
-- with no matching select policy.
--
-- Defaults fail closed. A write that forgets to say what it is arrives as an
-- unconfirmed form submission, never as a trusted leadership entry.

alter table public.tactical
  add column source text not null default 'form'
    check (source in ('leadership','form'));

alter table public.tactical
  add column confirmed boolean not null default false;

-- Everything already in the table was typed by leadership in the panel.
update public.tactical set source = 'leadership', confirmed = true;

-- Anyone with the link may file, as an unconfirmed form submission and nothing
-- else. 'authenticated' is included deliberately: a reviewer who happens to have
-- an account would otherwise be blocked, because leadership_all_tactical is the
-- only other policy and it would reject them.
--
-- There is no select, update or delete policy for these roles. Someone with the
-- link can post a report and cannot read, change or remove any report at all.
create policy "form_submit_tactical" on public.tactical
  for insert to anon, authenticated
  with check (source = 'form' and confirmed = false);

comment on column public.tactical.source is
  'Where the report came from: leadership (typed in the panel) or form (public /tactical link).';
comment on column public.tactical.confirmed is
  'Leadership has reviewed this submission. Form submissions arrive false and are confirmed in the panel.';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY
-- ═══════════════════════════════════════════════════════════════════════════

-- Expect every existing row to be leadership/confirmed, and none unconfirmed yet.
select source, confirmed, count(*) from public.tactical group by source, confirmed order by source;

-- Expect 2 policies on tactical: leadership_all_tactical (ALL) and
-- form_submit_tactical (INSERT). There must be NO select policy granting anon.
select policyname, cmd, roles::text
from pg_policies where tablename = 'tactical' order by policyname;
