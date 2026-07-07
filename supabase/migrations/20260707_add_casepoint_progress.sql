-- Casepoint per-case progress persistence (St. Aurelius breach project).
-- reviewer_progress rows are upserted whole from the client; unknown columns
-- would fail the POST, so these must exist before the frontend ships.
alter table reviewer_progress
  add column if not exists cp_coding text,
  add column if not exists cp_answered text,
  add column if not exists cp_redactions text;
