-- Track when a student first acknowledged the data-handling notice.
--
-- This is a baseline privacy gesture, not a substitute for FERPA
-- consent. The notice explains what we pull from D2L (course
-- enrollments, assignment files, instructor names, grades) so a
-- student isn't surprised the first time they see their submitted
-- work appearing in their portfolio.
--
-- NULL = not yet acknowledged → modal shows on next garden load.
-- Timestamp set = silent thereafter.
--
-- We don't gate access on this column — the assumption is that any
-- student in our DB is already program-enrolled and has consented at
-- a higher level. The modal is informational + auditable, not a
-- legal-level barrier.

alter table student
  add column if not exists data_consent_acknowledged_at timestamptz;

comment on column student.data_consent_acknowledged_at is 'First time the student saw and acknowledged the data-handling notice. Informational; not used to gate access.';
