-- The four sections of the tactical meeting report.
--
-- These should have landed with the weekly form itself. They did not: the
-- table still carried item/status/notes from an earlier, abandoned tracker,
-- so every submit failed on a column that was not there. The table is empty,
-- which is the evidence -- no report has ever saved.
--
-- Run this BEFORE 20260922_tactical_weekly.sql and
-- 20260922_tactical_public_form.sql. Those two assume these columns exist.
--
-- item/status/notes are left in place. Nothing reads them and the table is
-- empty, so they cost nothing; dropping columns is not worth doing blind.

alter table public.tactical add column if not exists rocks     text;
alter table public.tactical add column if not exists headlines text;
alter table public.tactical add column if not exists issues    text;
alter table public.tactical add column if not exists actions   text;

comment on column public.tactical.rocks     is 'ROCK Updates';
comment on column public.tactical.headlines is 'Customer / Contractors Headlines';
comment on column public.tactical.issues    is 'Issues: Identify / Discuss / Resolve';
comment on column public.tactical.actions   is 'Action Items / Priorities';
