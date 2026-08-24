-- Joba v. Bukando and Harmon v. NovaCure were removed from the app: 55 documents
-- each, too few to drill against. Only Joba had a qc_projects row - Harmon was
-- never QC-capable.
--
-- This migration also seeds the three matters that were never seeded. The original
-- migration inserted only joba and firstam, so Veridian, QuantumEdge and CADE have
-- no rows. They work today because qcConfig() falls back to defaults, but the
-- leadership target editor PATCHes by case_key, so saving their targets would
-- silently affect nothing.

-- 1. Joba's attempts must go before its project row: qc_attempts.case_key has a
--    foreign key to qc_projects. Nothing measured is lost - Joba could not certify,
--    and practice batches never counted toward Accuracy.
delete from public.qc_attempts where case_key = 'joba';
delete from public.qc_projects where case_key = 'joba';

-- 2. Seed the missing matters. Defaults for pace, tolerance and response window
--    come from the column defaults: 60 docs/hr, 1 defect per 1,000, 2 minutes.
--    CADE stays off certification - it is the Portuguese-language review and
--    belongs only to reviewers who do that work. Switch it on per-reviewer in the
--    leadership target editor.
insert into public.qc_projects (case_key, display_name, supports_certification) values
  ('p3',   'Veridian Bank — GDPR',            true),
  ('p4',   'SEC v. QuantumEdge AI',           true),
  ('ptbr', 'CADE v. Consórcio TechBrasil',    false)
on conflict (case_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — expect exactly 4 rows: firstam, p3, p4, ptbr. No joba.
-- ═══════════════════════════════════════════════════════════════════════════
select case_key, display_name, supports_certification,
       target_pace_docs_per_hour, max_defects_per_1000, response_window_minutes
from public.qc_projects
order by case_key;
