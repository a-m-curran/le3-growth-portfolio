-- LE3 Growth Portfolio — Combined migration 004 + 005
-- Run this ONCE in the Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT)

-- ═══════════════════════════════════════════════════
-- PART 1: FOUNDATION (from 004)
-- ═══════════════════════════════════════════════════

-- ─── ADD NETWORK BUILDERS PILLAR ─────────────────────

INSERT INTO pillar (id, name, description, display_order)
VALUES (gen_random_uuid(), 'Network Builders', 'Building collaborative relationships and navigating social contexts', 4)
ON CONFLICT (name) DO NOTHING;

-- ─── UPDATE EXISTING PILLAR NAMES ───────────────────

UPDATE pillar SET name = 'Creative & Curious Thinkers' WHERE name = 'Creative & Curious Mindset';
UPDATE pillar SET name = 'Leaders with Purpose & Agency' WHERE name = 'Lead Themselves & Others';
UPDATE pillar SET name = 'Thrivers in Change' WHERE name = 'Thrive in Change';

-- ─── MIGRATE SDT LEVELS (data first, then constraint) ──

ALTER TABLE skill_assessment DROP CONSTRAINT IF EXISTS skill_assessment_sdt_level_check;

UPDATE skill_assessment SET sdt_level = 'external' WHERE sdt_level = 'noticing';
UPDATE skill_assessment SET sdt_level = 'identified' WHERE sdt_level = 'practicing';
UPDATE skill_assessment SET sdt_level = 'integrated' WHERE sdt_level = 'integrating';
UPDATE skill_assessment SET sdt_level = 'intrinsic' WHERE sdt_level = 'evolving';

ALTER TABLE skill_assessment ADD CONSTRAINT skill_assessment_sdt_level_check
  CHECK (sdt_level IN ('external', 'introjected', 'identified', 'integrated', 'intrinsic'));

-- ─── MOVE RESILIENCE TO THRIVE PILLAR ───────────────

UPDATE durable_skill
SET pillar_id = (SELECT id FROM pillar WHERE name = 'Thrivers in Change')
WHERE name = 'Resilience';

-- ─── DEACTIVATE SELF-DIRECTED LEARNING ──────────────

UPDATE durable_skill SET is_active = false WHERE name = 'Self-Directed Learning';

-- ─── ADD NEW SKILLS ─────────────────────────────────

INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Creative & Curious Thinkers'),
  'Curiosity',
  'Asks meaningful questions; seeks to understand beyond surface-level answers.',
  3, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Curiosity');

INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Leaders with Purpose & Agency'),
  'Empathy',
  'Understands and respects others'' feelings and perspectives; integrates this understanding into leadership.',
  2, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Empathy');

INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Leaders with Purpose & Agency'),
  'Communication',
  'Clearly articulates ideas verbally and in writing for different audiences.',
  3, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Communication');

INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Thrivers in Change'),
  'Adaptability',
  'Adjusts approach as new information or challenges arise; adjusts effectively when conditions change.',
  1, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Adaptability');

INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Network Builders'),
  'Collaboration',
  'Works well with others toward shared goals, even in stressful contexts.',
  1, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Collaboration');

INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Network Builders'),
  'Networking',
  'Builds professional connections across contexts.',
  2, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Networking');

INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Network Builders'),
  'Relationship Building',
  'Develops and maintains meaningful relationships.',
  3, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Relationship Building');

INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Network Builders'),
  'Social Awareness',
  'Reads social context; navigates group dynamics effectively.',
  4, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Social Awareness');

-- ─── UPDATE RUBRIC STRUCTURE ────────────────────────

ALTER TABLE rubric ADD COLUMN IF NOT EXISTS external_descriptors JSONB;
ALTER TABLE rubric ADD COLUMN IF NOT EXISTS introjected_descriptors JSONB;
ALTER TABLE rubric ADD COLUMN IF NOT EXISTS identified_descriptors JSONB;
ALTER TABLE rubric ADD COLUMN IF NOT EXISTS integrated_descriptors JSONB;
ALTER TABLE rubric ADD COLUMN IF NOT EXISTS intrinsic_descriptors JSONB;

UPDATE rubric SET
  external_descriptors = noticing_descriptors,
  identified_descriptors = practicing_descriptors,
  integrated_descriptors = integrating_descriptors,
  intrinsic_descriptors = evolving_descriptors,
  introjected_descriptors = '[]'::jsonb
WHERE external_descriptors IS NULL;


-- ═══════════════════════════════════════════════════
-- PART 2: IMPORT + REFLECTIONS (from 005)
-- ═══════════════════════════════════════════════════

-- ─── WORK IMPORT COLUMNS ────────────────────────────

DO $$ BEGIN
  ALTER TABLE student_work ADD COLUMN source TEXT DEFAULT 'manual';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE student_work ADD COLUMN external_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE student_work ADD COLUMN imported_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add check constraint for source (drop first if partial)
ALTER TABLE student_work DROP CONSTRAINT IF EXISTS student_work_source_check;
ALTER TABLE student_work ADD CONSTRAINT student_work_source_check
  CHECK (source IN ('manual', 'csv_import', 'd2l_api', 'reflection'));

-- ─── WORK IMPORT BATCH TABLE ────────────────────────

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

-- ─── WORK SKILL TAGS TABLE ──────────────────────────

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

-- RLS
ALTER TABLE work_skill_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_import_batch ENABLE ROW LEVEL SECURITY;

-- Drop policies first in case they exist from partial run
DROP POLICY IF EXISTS "Students see own work tags" ON work_skill_tag;
DROP POLICY IF EXISTS "Coaches see student work tags" ON work_skill_tag;
DROP POLICY IF EXISTS "Students see own imports" ON work_import_batch;

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

CREATE POLICY "Students see own imports" ON work_import_batch
  FOR SELECT USING (student_id IN (
    SELECT id FROM student WHERE auth_user_id = auth.uid()
  ));

-- ─── OPEN REFLECTIONS COLUMNS ───────────────────────

DO $$ BEGIN
  ALTER TABLE growth_conversation ADD COLUMN conversation_type TEXT DEFAULT 'work_based';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE growth_conversation ADD COLUMN reflection_description TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE growth_conversation ADD COLUMN student_tagged_skill_id UUID REFERENCES durable_skill(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add check constraint for conversation_type
ALTER TABLE growth_conversation DROP CONSTRAINT IF EXISTS growth_conversation_conversation_type_check;
ALTER TABLE growth_conversation ADD CONSTRAINT growth_conversation_conversation_type_check
  CHECK (conversation_type IN ('work_based', 'open_reflection'));

-- ═══════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════

-- Run this to verify everything worked:
-- SELECT name FROM pillar ORDER BY display_order;
-- SELECT name, is_active FROM durable_skill ORDER BY pillar_id, display_order;
-- SELECT DISTINCT sdt_level FROM skill_assessment;
