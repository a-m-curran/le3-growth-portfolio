-- LE3 Growth Portfolio — Foundation: 4 pillars, 12 skills, 5-level SDT
-- Run in Supabase SQL Editor after 001-003

-- ─── ADD NETWORK BUILDERS PILLAR ─────────────────────

INSERT INTO pillar (id, name, description, display_order)
VALUES (gen_random_uuid(), 'Network Builders', 'Building collaborative relationships and navigating social contexts', 4)
ON CONFLICT (name) DO NOTHING;

-- Update existing pillar names to match framework
UPDATE pillar SET name = 'Creative & Curious Thinkers' WHERE name = 'Creative & Curious Mindset';
UPDATE pillar SET name = 'Leaders with Purpose & Agency' WHERE name = 'Lead Themselves & Others';
UPDATE pillar SET name = 'Thrivers in Change' WHERE name = 'Thrive in Change';

-- ─── UPDATE SDT LEVEL CHECK CONSTRAINT ──────────────

ALTER TABLE skill_assessment DROP CONSTRAINT IF EXISTS skill_assessment_sdt_level_check;
ALTER TABLE skill_assessment ADD CONSTRAINT skill_assessment_sdt_level_check
  CHECK (sdt_level IN ('external', 'introjected', 'identified', 'integrated', 'intrinsic'));

-- ─── MIGRATE EXISTING SDT LEVEL DATA ────────────────

UPDATE skill_assessment SET sdt_level = 'external' WHERE sdt_level = 'noticing';
UPDATE skill_assessment SET sdt_level = 'identified' WHERE sdt_level = 'practicing';
UPDATE skill_assessment SET sdt_level = 'integrated' WHERE sdt_level = 'integrating';
UPDATE skill_assessment SET sdt_level = 'intrinsic' WHERE sdt_level = 'evolving';

-- ─── MOVE RESILIENCE TO THRIVE PILLAR ───────────────

UPDATE durable_skill
SET pillar_id = (SELECT id FROM pillar WHERE name = 'Thrivers in Change')
WHERE name = 'Resilience';

-- ─── DEACTIVATE SELF-DIRECTED LEARNING ──────────────

UPDATE durable_skill SET is_active = false WHERE name = 'Self-Directed Learning';

-- ─── ADD NEW SKILLS ─────────────────────────────────

-- Curiosity (Creative & Curious Thinkers)
INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Creative & Curious Thinkers'),
  'Curiosity',
  'Asks meaningful questions; seeks to understand beyond surface-level answers.',
  3, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Curiosity');

-- Empathy (Leaders with Purpose & Agency)
INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Leaders with Purpose & Agency'),
  'Empathy',
  'Understands and respects others'' feelings and perspectives; integrates this understanding into leadership.',
  2, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Empathy');

-- Communication (Leaders with Purpose & Agency)
INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Leaders with Purpose & Agency'),
  'Communication',
  'Clearly articulates ideas verbally and in writing for different audiences.',
  3, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Communication');

-- Adaptability (Thrivers in Change)
INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Thrivers in Change'),
  'Adaptability',
  'Adjusts approach as new information or challenges arise; adjusts effectively when conditions change.',
  1, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Adaptability');

-- Collaboration (Network Builders)
INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Network Builders'),
  'Collaboration',
  'Works well with others toward shared goals, even in stressful contexts.',
  1, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Collaboration');

-- Networking (Network Builders)
INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Network Builders'),
  'Networking',
  'Builds professional connections across contexts.',
  2, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Networking');

-- Relationship Building (Network Builders)
INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Network Builders'),
  'Relationship Building',
  'Develops and maintains meaningful relationships.',
  3, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Relationship Building');

-- Social Awareness (Network Builders)
INSERT INTO durable_skill (id, pillar_id, name, description, display_order, is_active)
SELECT gen_random_uuid(),
  (SELECT id FROM pillar WHERE name = 'Network Builders'),
  'Social Awareness',
  'Reads social context; navigates group dynamics effectively.',
  4, true
WHERE NOT EXISTS (SELECT 1 FROM durable_skill WHERE name = 'Social Awareness');

-- ─── UPDATE RUBRIC STRUCTURE ────────────────────────

-- Add new columns for 5-level SDT model
ALTER TABLE rubric ADD COLUMN IF NOT EXISTS external_descriptors JSONB;
ALTER TABLE rubric ADD COLUMN IF NOT EXISTS introjected_descriptors JSONB;
ALTER TABLE rubric ADD COLUMN IF NOT EXISTS identified_descriptors JSONB;
ALTER TABLE rubric ADD COLUMN IF NOT EXISTS integrated_descriptors JSONB;
ALTER TABLE rubric ADD COLUMN IF NOT EXISTS intrinsic_descriptors JSONB;

-- Migrate existing 4-level rubric data to new columns
UPDATE rubric SET
  external_descriptors = noticing_descriptors,
  identified_descriptors = practicing_descriptors,
  integrated_descriptors = integrating_descriptors,
  intrinsic_descriptors = evolving_descriptors,
  introjected_descriptors = '[]'::jsonb
WHERE external_descriptors IS NULL;

-- Note: Old columns (noticing_descriptors, etc.) are left in place for backward compatibility.
-- They can be dropped in a future migration once all code references are updated.
