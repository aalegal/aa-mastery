-- Extraction progress for the Cyber Incident Response matter (Larkspur).
-- Kept apart from rel_coding/rel_answered, whose counters assumed one matter.
-- Until this runs, the app drops rel_extract from remote saves once the
-- database names it as missing, so every other matter keeps saving.
alter table public.reviewer_progress add column if not exists rel_extract jsonb;
