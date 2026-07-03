-- Security hardening 2026-07-03
-- 1) quiz_scores: DELETE was allowed for everyone (qual=true). Restrict to admin.
drop policy "Admin can delete scores" on public.quiz_scores;
create policy "admin_delete_scores" on public.quiz_scores
  for delete using ((auth.jwt() ->> 'email') = 'jeff@ataandeadvisors.com');

-- 2) login_alerts: public INSERT policy allowed anyone (incl. anon) to insert junk.
--    All legit inserts go through the login-alert edge function (service role bypasses RLS).
drop policy "allow_insert" on public.login_alerts;

-- 3) payments/tactical/timesheets: were open to ANY authenticated user.
--    Restrict to leadership, mirroring the frontend isLeadership() gate.
--    NOTE: the display_name fallback comes from user_metadata, which users can
--    edit themselves — collect real leadership emails and drop the name check
--    when possible.
create or replace function public.is_leadership() returns boolean
language sql stable as $$
  select (auth.jwt() ->> 'email') = 'jeff@ataandeadvisors.com'
      or lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', ''))
         in ('jeff','glory','junior','simon','achumboro','aaron')
$$;

drop policy "auth full payments" on public.payments;
create policy "leadership_all_payments" on public.payments
  for all using (public.is_leadership()) with check (public.is_leadership());

drop policy "auth full tactical" on public.tactical;
create policy "leadership_all_tactical" on public.tactical
  for all using (public.is_leadership()) with check (public.is_leadership());

drop policy "auth full timesheets" on public.timesheets;
create policy "leadership_all_timesheets" on public.timesheets
  for all using (public.is_leadership()) with check (public.is_leadership());
