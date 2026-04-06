-- LE3 Growth Portfolio — Skill Narratives
-- Run in Supabase SQL Editor after 006

CREATE TABLE IF NOT EXISTS skill_narrative (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES student(id),
  skill_id UUID NOT NULL REFERENCES durable_skill(id),
  version INT NOT NULL DEFAULT 1,
  narrative_text TEXT NOT NULL,
  narrative_richness TEXT NOT NULL DEFAULT 'thin'
    CHECK (narrative_richness IN ('thin', 'developing', 'rich')),
  data_sources_used JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, skill_id, version)
);

CREATE INDEX IF NOT EXISTS idx_narrative_student_skill ON skill_narrative(student_id, skill_id);

-- RLS
ALTER TABLE skill_narrative ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students see own narratives" ON skill_narrative;
CREATE POLICY "Students see own narratives" ON skill_narrative
  FOR SELECT USING (student_id IN (
    SELECT id FROM student WHERE auth_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Coaches see student narratives" ON skill_narrative;
CREATE POLICY "Coaches see student narratives" ON skill_narrative
  FOR SELECT USING (student_id IN (
    SELECT id FROM student WHERE coach_id IN (
      SELECT id FROM coach WHERE auth_user_id = auth.uid()
    )
  ));
