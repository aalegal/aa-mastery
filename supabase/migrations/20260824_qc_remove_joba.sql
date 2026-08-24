-- Joba v. Bukando and Harmon v. NovaCure were removed from the app: 55 documents
-- each, too few for the drills. Only Joba had a qc_projects row (Harmon was never
-- QC-capable).
--
-- qc_attempts.case_key references qc_projects(case_key), so any recorded Joba
-- batches must go first. Practice batches never counted toward Accuracy, and Joba
-- could not certify at all, so nothing measured is lost.

delete from public.qc_attempts where case_key = 'joba';
delete from public.qc_projects where case_key = 'joba';

-- Expect 3 rows: firstam, p3, p4 once their rows exist; firstam alone if the
-- others have not been seeded yet.
select case_key, display_name, supports_certification
from public.qc_projects order by case_key;
