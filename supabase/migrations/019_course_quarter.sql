-- Per-course curriculum quarter, sourced from D2L's CourseOffering at
-- sync time. Derivation priority (in src/lib/d2l/mappers.ts):
--   1. Semester.Name (if matches "Season YYYY" exactly)
--   2. StartDate month → Season+Year
--   3. currentQuarter() at sync time (safety-net fallback)
--
-- Nullable so that any sync run before the backfill / before the column
-- exists in a deploy doesn't fail; sync writes the derived value every
-- run, so nulls are transient.
alter table course
  add column quarter text;

comment on column course.quarter is
  'Curriculum quarter in "Season YYYY" form. Sourced from D2L CourseOffering (Semester.Name preferred; StartDate-derived fallback). Sync writes once per course; assignment.quarter and student_work.quarter denormalize from here at insert time.';
