-- LE3 Growth Portfolio — D2L Import + Open Reflections
-- Run in Supabase SQL Editor after 004

-- ─── WORK IMPORT TRACKING ───────────────────────────

ALTER TABLE student_work ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
  CHECK (source IN ('manual', 'csv_import', 'd2l_api', 'reflection'));
ALTER TABLE student_work ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE student_work ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS work_import_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES student(id),
  source TEXT NOT NULL CHECK (source IN ('csv', 'd2l_api')),
  filename TEXT,
  total_items INT NOT NULL,
  processed_items INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ─── WORK SKILL TAGS (auto-tagged by LLM) ──────────

CREATE TABLE IF NOT EXISTS work_skill_tag (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES student_work(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES durable_skill(id),
  confidence FLOAT NOT NULL,
  rationale TEXT,
  source TEXT NOT NULL DEFAULT 'llm_auto'
    CHECK (source IN ('llm_auto', 'student_manual', 'coach_manual')),
  tagged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_skill_tag_work ON work_skill_tag(work_id);
CREATE INDEX IF NOT EXISTS idx_work_skill_tag_skill ON work_skill_tag(skill_id);

-- RLS for work_skill_tag
ALTER TABLE work_skill_tag ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own work tags" ON work_skill_tag
  FOR SELECT USING (work_id IN (
    SELECT id FROM student_work WHERE student_id IN (
      SELECT id FROM student WHERE auth_user_id = auth.uid()
    )
  ));

CREATE POLICY "Coaches see student work tags" ON work_skill_tag
  FOR SELECT USING (work_id IN (
    SELECT id FROM student_work WHERE student_id IN (
      SELECT id FROM student WHERE coach_id IN (
        SELECT id FROM coach WHERE auth_user_id = auth.uid()
      )
    )
  ));

-- RLS for work_import_batch
ALTER TABLE work_import_batch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own imports" ON work_import_batch
  FOR SELECT USING (student_id IN (
    SELECT id FROM student WHERE auth_user_id = auth.uid()
  ));

-- ─── OPEN REFLECTIONS ───────────────────────────────

ALTER TABLE growth_conversation ADD COLUMN IF NOT EXISTS conversation_type TEXT DEFAULT 'work_based'
  CHECK (conversation_type IN ('work_based', 'open_reflection'));
ALTER TABLE growth_conversation ADD COLUMN IF NOT EXISTS reflection_description TEXT;
ALTER TABLE growth_conversation ADD COLUMN IF NOT EXISTS student_tagged_skill_id UUID
  REFERENCES durable_skill(id);
