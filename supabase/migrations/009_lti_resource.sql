-- LE3 Growth Portfolio — LTI 1.3 resource storage
-- Stores assignment content that instructors paste during deep linking,
-- tied to the LTI resource_link_id Brightspace sends on subsequent launches.

CREATE TABLE IF NOT EXISTS lti_resource (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_issuer TEXT NOT NULL,
  resource_link_id TEXT NOT NULL,
  deployment_id TEXT NOT NULL,
  context_id TEXT NOT NULL,
  context_title TEXT,
  assignment_title TEXT,
  assignment_body TEXT,
  line_item_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform_issuer, resource_link_id)
);

CREATE INDEX IF NOT EXISTS idx_lti_resource_context ON lti_resource(platform_issuer, context_id);

ALTER TABLE lti_resource ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read LTI resources (they're course-level assignment metadata)
DROP POLICY IF EXISTS "Anyone reads lti resources" ON lti_resource;
CREATE POLICY "Anyone reads lti resources" ON lti_resource
  FOR SELECT USING (auth.uid() IS NOT NULL);
