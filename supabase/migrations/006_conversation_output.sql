-- LE3 Growth Portfolio — Structured Conversation Output for C2A
-- Run in Supabase SQL Editor after 004+005

CREATE TABLE IF NOT EXISTS conversation_output (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES growth_conversation(id) ON DELETE CASCADE,

  -- Evidence quality
  evidence_strength TEXT NOT NULL
    CHECK (evidence_strength IN ('thin', 'moderate', 'strong', 'compelling')),
  evidence_rationale TEXT,

  -- Behavioral indicators observed (matched against rubric descriptors)
  behavioral_indicators JSONB NOT NULL DEFAULT '[]',

  -- SDT level signals per skill
  sdt_level_signals JSONB NOT NULL DEFAULT '{}',

  -- Growth trajectory
  growth_trajectory TEXT
    CHECK (growth_trajectory IN ('emerging', 'developing', 'stable', 'accelerating', 'plateau')),
  trajectory_rationale TEXT,

  -- Key quotes/moments from the conversation
  key_moments JSONB NOT NULL DEFAULT '[]',

  -- Voice/style fingerprint (for narrative generation)
  voice_markers JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_output_conversation ON conversation_output(conversation_id);

-- RLS
ALTER TABLE conversation_output ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students see own outputs" ON conversation_output;
CREATE POLICY "Students see own outputs" ON conversation_output
  FOR SELECT USING (conversation_id IN (
    SELECT id FROM growth_conversation WHERE student_id IN (
      SELECT id FROM student WHERE auth_user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Coaches see student outputs" ON conversation_output;
CREATE POLICY "Coaches see student outputs" ON conversation_output
  FOR SELECT USING (conversation_id IN (
    SELECT id FROM growth_conversation WHERE student_id IN (
      SELECT id FROM student WHERE coach_id IN (
        SELECT id FROM coach WHERE auth_user_id = auth.uid()
      )
    )
  ));

-- Placeholder for future C2A input
-- CREATE TABLE IF NOT EXISTS c2a_assessment (...)
-- This will be defined when the C2A tool's output format is finalized
