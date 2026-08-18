-- QC Track Phase 2 — pace, responsiveness and consistency per batch.
--
-- Same rules as 20260817_qc_track.sql: access is enforced in Postgres, policies
-- key on the JWT email claim only, and no update or delete policy exists — a
-- completed batch stays as recorded.
--
-- The existing policies cover these columns; RLS is per-row, not per-column, so
-- no policy changes are needed.

alter table public.qc_attempts add column pace           numeric;
alter table public.qc_attempts add column responsiveness numeric;
alter table public.qc_attempts add column consistency    numeric;

comment on column public.qc_attempts.pace is
  'Sustainable-pace pillar 0-125: throughput discounted by the square of accuracy.';
comment on column public.qc_attempts.responsiveness is
  'Responsiveness pillar 0-100 from in-batch interrupt acknowledgement times. Null if none fired.';
comment on column public.qc_attempts.consistency is
  'Share of near-duplicate families coded alike, 0-1. Null if the batch had no families.';
