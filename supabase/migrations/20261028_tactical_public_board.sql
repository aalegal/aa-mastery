-- Open the AA tactical reports to the public board at /tactical/board.
--
-- 20260922_tactical_public_form.sql made the link submit-only: anyone could
-- file, nobody could read. This reverses that on purpose. Anyone holding the
-- /tactical or /tactical/board link can now read every report and edit one.
-- The link is the only lock, the same as the Uplift Communities board.
--
-- Edits from the public side always land as an unconfirmed form report, so
-- the leadership panel still sees that a report changed and can re-confirm it.
-- There is still no public delete.

alter table public.tactical add column if not exists updated_at timestamptz not null default now();
-- Existing reports were last touched when they were filed. Runs before the
-- trigger below exists, so it does not stamp them all as edited now.
update public.tactical set updated_at = created_at where created_at is not null;

create or replace function public.tactical_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tactical_touch on public.tactical;
create trigger tactical_touch before update on public.tactical
  for each row execute function public.tactical_touch();

drop policy if exists tactical_public_read on public.tactical;
drop policy if exists tactical_public_edit on public.tactical;

create policy tactical_public_read on public.tactical
  for select to anon, authenticated using (true);

create policy tactical_public_edit on public.tactical
  for update to anon, authenticated
  using (true)
  with check (source = 'form' and confirmed = false);

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY: expect form_submit_tactical (INSERT), leadership_all_tactical (ALL),
-- tactical_public_edit (UPDATE), tactical_public_read (SELECT). No public DELETE.
-- ═══════════════════════════════════════════════════════════════════════════
select policyname, cmd, roles::text from pg_policies where tablename = 'tactical' order by policyname;
