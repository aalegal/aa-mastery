-- Tactical meeting reports become a weekly record instead of one row per person.
--
-- Today the app keys reports as TACTICAL_BY_PERSON[person] = rec and PATCHes that
-- single row in place, so each Wednesday's report overwrites the last and no
-- history survives. That is fatal for a cadence: the monthly analyze beat has
-- nothing to read, and you cannot see whether an issue raised weeks ago closed.
--
-- week_of is the Wednesday of the report's Mon-Sun week. Monday and Tuesday
-- belong to the Wednesday ahead of them; Thursday to Sunday to the one behind.
-- This is the same rule as QC.tacticalWeekOf() in qc-engine.js, which is unit
-- tested - if you change one, change both.

alter table public.tactical add column week_of date;

-- Backfill from whatever dates already exist. Rows with no row_date keep a null
-- week_of and stay outside the constraint below rather than colliding on it.
update public.tactical
set week_of = row_date - (extract(isodow from row_date)::int - 3)
where row_date is not null;

-- One report per person per week, guaranteed by the database rather than by the
-- app remembering to check.
create unique index tactical_person_week_idx
  on public.tactical (person, week_of)
  where week_of is not null;

create index tactical_week_idx on public.tactical (week_of desc);

comment on column public.tactical.week_of is
  'Wednesday of the report''s Mon-Sun week. Mirrors QC.tacticalWeekOf() in qc-engine.js.';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY — every backfilled week_of must be a Wednesday (isodow 3), and no
-- person may hold two reports for the same week.
-- ═══════════════════════════════════════════════════════════════════════════
select count(*) filter (where week_of is not null)                       as dated_rows,
       count(*) filter (where week_of is not null
                          and extract(isodow from week_of) <> 3)         as not_a_wednesday,
       count(*) filter (where week_of is null)                           as undated_rows
from public.tactical;

select person, week_of, row_date from public.tactical order by person, week_of desc;
