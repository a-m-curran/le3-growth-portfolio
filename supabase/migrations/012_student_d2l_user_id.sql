-- LE3 Growth Portfolio — Add d2l_user_id to student
--
-- Previously, the sync engine stored the student's D2L user identifier
-- as part of nlu_id (either as the raw OrgDefinedId or as 'd2l:{userId}').
-- This made it impossible to reliably look up a student by their raw
-- D2L user ID during submission processing, because the stored value
-- format varied depending on whether OrgDefinedId was present.
--
-- Adding a dedicated d2l_user_id column gives us a stable, unambiguous
-- column to key off of. The sync engine populates it when upserting
-- students from Valence classlists, and the submission processor uses
-- it to match submissions back to their student record.
--
-- nlu_id remains the student's "identity of record" that LTI launches
-- claim via 'lti:{sub}', and OrgDefinedIds still land in nlu_id for
-- students imported from Valence when available.
--
-- Run order: after 011_valence_sync_schema.sql

ALTER TABLE student ADD COLUMN IF NOT EXISTS d2l_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_student_d2l_user_id
  ON student(d2l_user_id)
  WHERE d2l_user_id IS NOT NULL;

COMMENT ON COLUMN student.d2l_user_id IS
  'Raw Brightspace user identifier (the numeric ID from Valence classlists). Populated by the sync engine; used to match incoming submissions back to their student record. Nullable for students who arrived via LTI launch before the Valence sync, or via CSV import.';
