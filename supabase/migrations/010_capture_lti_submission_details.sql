-- LE3 Growth Portfolio — Capture additional LTI submission details
--
-- Adds fields for richer context from LTI Asset Processor notices so the
-- AI can ground its questions in the instructor's assignment prompt and
-- so the UI can surface which attempt a student is on.
--
-- - description    : instructor's assignment prompt (LTI activity.description)
-- - attempt_number : which attempt this submission is (LTI submission.attempt)
-- - course_code    : course code like "SOC155-01" (LTI context.label)
--
-- `description` and `course_code` already exist on student_work (001), so we
-- only need to add attempt_number. This migration just documents that we're
-- now populating those columns from LTI.

ALTER TABLE student_work
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER;

COMMENT ON COLUMN student_work.description IS
  'Assignment prompt / instructions. Populated from LTI activity.description on submission notices, or from instructor input during deep linking. Used to ground AI question generation.';

COMMENT ON COLUMN student_work.course_code IS
  'Course code like "SOC155-01". Populated from LTI context.label on submission notices.';

COMMENT ON COLUMN student_work.attempt_number IS
  'Which submission attempt this is (1, 2, 3, ...). Populated from LTI submission.attempt. NULL for legacy/CSV records.';
