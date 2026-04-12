-- LE3 Growth Portfolio — Valence sync schema
--
-- Adds first-class entities for courses, assignments, enrollments, and
-- sync runs so the Valence bulk-sync path can land properly normalized
-- data instead of cramming everything into student_work with text fields.
--
-- Also adds the unified dedup key (brightspace_submission_id) used by
-- both the Valence sync path and the LTI Asset Processor notice handler
-- so the same submission can't land twice regardless of which path
-- delivered it first.
--
-- Run order: after 010_capture_lti_submission_details.sql

-- ─── COURSE ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable external identifier. Format: 'd2l:{org_unit_id}'
  external_id TEXT UNIQUE NOT NULL,
  -- Raw Brightspace org unit ID (so we can call Valence with it)
  brightspace_org_unit_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  quarter TEXT,
  instructor_id UUID REFERENCES coach(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_brightspace_id ON course(brightspace_org_unit_id);
CREATE INDEX IF NOT EXISTS idx_course_instructor ON course(instructor_id);
CREATE INDEX IF NOT EXISTS idx_course_quarter ON course(quarter);

-- ─── ASSIGNMENT ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable external identifier. Format: 'd2l:{org_unit_id}:{folder_id}'
  external_id TEXT UNIQUE NOT NULL,
  brightspace_folder_id TEXT NOT NULL,
  course_id UUID NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  -- Instructor's prompt / instructions. Used to ground AI Phase 1 questions.
  description TEXT,
  due_date TIMESTAMPTZ,
  -- Inferred from title or Brightspace category: essay | project | discussion_post | ...
  work_type TEXT,
  quarter TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_course ON assignment(course_id);
CREATE INDEX IF NOT EXISTS idx_assignment_folder ON assignment(brightspace_folder_id);
CREATE INDEX IF NOT EXISTS idx_assignment_quarter ON assignment(quarter);

-- ─── STUDENT ↔ COURSE JUNCTION ───────────────────────

CREATE TABLE IF NOT EXISTS student_course (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'dropped', 'completed', 'withdrawn')),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_student_course_student ON student_course(student_id);
CREATE INDEX IF NOT EXISTS idx_student_course_course ON student_course(course_id);
CREATE INDEX IF NOT EXISTS idx_student_course_status ON student_course(status);

-- ─── SYNC RUN TRACKING ───────────────────────────────

CREATE TABLE IF NOT EXISTS sync_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN (
    'd2l_valence_scheduled',
    'd2l_valence_manual',
    'd2l_valence_backfill'
  )),
  mode TEXT NOT NULL DEFAULT 'incremental' CHECK (mode IN ('full', 'incremental')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  triggered_by TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_seconds INT,
  courses_synced INT NOT NULL DEFAULT 0,
  students_synced INT NOT NULL DEFAULT 0,
  assignments_synced INT NOT NULL DEFAULT 0,
  submissions_synced INT NOT NULL DEFAULT 0,
  submissions_skipped INT NOT NULL DEFAULT 0,
  errors_count INT NOT NULL DEFAULT 0,
  error_details JSONB,
  trigger_run_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_run_started ON sync_run(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_run_status ON sync_run(status);
CREATE INDEX IF NOT EXISTS idx_sync_run_source ON sync_run(source);

-- ─── STUDENT_WORK EXTENSIONS ─────────────────────────

-- Link each student_work record to its first-class assignment
ALTER TABLE student_work
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES assignment(id) ON DELETE SET NULL;

-- Unified dedup key across Valence and Asset Processor paths
-- UNIQUE but nullable so legacy records (pre-sync) don't violate the constraint
ALTER TABLE student_work
  ADD COLUMN IF NOT EXISTS brightspace_submission_id TEXT;

-- Partial unique index: enforce uniqueness only when the column is populated
-- so legacy rows with NULL don't conflict with each other
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_work_brightspace_submission_id
  ON student_work(brightspace_submission_id)
  WHERE brightspace_submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_work_assignment ON student_work(assignment_id);

COMMENT ON COLUMN student_work.assignment_id IS
  'FK to the assignment this submission belongs to. Populated by Valence sync and Asset Processor notice handler. Nullable for legacy manual/CSV imports.';

COMMENT ON COLUMN student_work.brightspace_submission_id IS
  'Unified dedup key across Valence sync and LTI Asset Processor paths. Prevents the same D2L submission from being inserted twice regardless of which path saw it first. Nullable for records that didn''t originate in Brightspace.';

-- Widen the work_source enum to include the new valence sync source
-- (cannot just DROP + ADD a CHECK constraint if the name matches, so
--  do the idempotent name dance)
DO $$
BEGIN
  ALTER TABLE student_work DROP CONSTRAINT IF EXISTS student_work_source_check;
  ALTER TABLE student_work ADD CONSTRAINT student_work_source_check
    CHECK (source IN (
      'manual',
      'csv_import',
      'd2l_api',           -- legacy name, still accepted for historical records
      'd2l_valence_sync',  -- new: Valence bulk sync path
      'd2l_lti_notice',    -- new: Asset Processor push path
      'reflection'
    ));
EXCEPTION WHEN OTHERS THEN
  -- If the constraint doesn't exist yet or can't be updated cleanly,
  -- leave it alone rather than break the migration.
  NULL;
END $$;

-- ─── RLS POLICIES ────────────────────────────────────

ALTER TABLE course ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_course ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_run ENABLE ROW LEVEL SECURITY;

-- Course: students see courses they're enrolled in; coaches see courses their students are in
DROP POLICY IF EXISTS "Students see own courses" ON course;
CREATE POLICY "Students see own courses" ON course
  FOR SELECT USING (
    id IN (
      SELECT course_id FROM student_course
      WHERE student_id IN (
        SELECT id FROM student WHERE auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Coaches see courses with their students" ON course;
CREATE POLICY "Coaches see courses with their students" ON course
  FOR SELECT USING (
    id IN (
      SELECT course_id FROM student_course
      WHERE student_id IN (
        SELECT id FROM student WHERE coach_id IN (
          SELECT id FROM coach WHERE auth_user_id = auth.uid()
        )
      )
    )
  );

-- Assignment: inherits visibility from course
DROP POLICY IF EXISTS "Students see assignments in their courses" ON assignment;
CREATE POLICY "Students see assignments in their courses" ON assignment
  FOR SELECT USING (
    course_id IN (
      SELECT course_id FROM student_course
      WHERE student_id IN (
        SELECT id FROM student WHERE auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Coaches see assignments for their students" ON assignment;
CREATE POLICY "Coaches see assignments for their students" ON assignment
  FOR SELECT USING (
    course_id IN (
      SELECT course_id FROM student_course
      WHERE student_id IN (
        SELECT id FROM student WHERE coach_id IN (
          SELECT id FROM coach WHERE auth_user_id = auth.uid()
        )
      )
    )
  );

-- Student_course: students see their own enrollments; coaches see their students'
DROP POLICY IF EXISTS "Students see own enrollments" ON student_course;
CREATE POLICY "Students see own enrollments" ON student_course
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM student WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Coaches see their students enrollments" ON student_course;
CREATE POLICY "Coaches see their students enrollments" ON student_course
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM student WHERE coach_id IN (
        SELECT id FROM coach WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Sync_run: coaches can see all sync runs (for observability / debugging)
DROP POLICY IF EXISTS "Coaches see all sync runs" ON sync_run;
CREATE POLICY "Coaches see all sync runs" ON sync_run
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM coach WHERE auth_user_id = auth.uid())
  );
