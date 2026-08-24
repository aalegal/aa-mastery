-- Carry a display name alongside the email on qc_attempts.
--
-- Without this a leadership roster reads "simon@..." rather than "Simon".
-- Same shape as wellness_flags, which stores user_email and user_name together
-- for exactly this reason.
--
-- The name is display metadata only. It is never used for access control:
-- display_name is user-settable and therefore spoofable, so every policy on this
-- table keys on the JWT email claim alone. See 20260817_qc_track.sql.

alter table public.qc_attempts add column user_name text;

comment on column public.qc_attempts.user_name is
  'Display name at the time the batch was recorded. Presentation only - never used for authorisation.';
