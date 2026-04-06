-- LE3 Growth Portfolio — Career Output
-- Run in Supabase SQL Editor after 007

CREATE TABLE IF NOT EXISTS career_output (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES student(id),
  version INT NOT NULL DEFAULT 1,
  resume_summary TEXT,
  skill_descriptions JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, version)
);

ALTER TABLE career_output ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students see own career output" ON career_output;
CREATE POLICY "Students see own career output" ON career_output
  FOR SELECT USING (student_id IN (
    SELECT id FROM student WHERE auth_user_id = auth.uid()
  ));
