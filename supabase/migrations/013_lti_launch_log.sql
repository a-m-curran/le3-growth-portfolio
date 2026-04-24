-- LTI launch log: every POST /api/lti/launch attempt, success or failure.
--
-- Enables the coach dashboard's Sync Inspector to show real-time evidence
-- of LTI activity — so when NLU IT (Matt) tests a Brightspace-side launch,
-- the coach can immediately confirm whether it hit our endpoint, whether
-- JWT verification succeeded, and who was provisioned.
--
-- Rows are created on every launch attempt before JWT verification, so
-- even 400/401 errors surface here. Successful launches update the row
-- with the provisioned student_id and full claim extract.
--
-- This is intentionally NOT an auth/audit log for session security — it
-- exists for integration observability during pilot testing. Hard-deleting
-- rows older than 90 days is fine; we don't need indefinite retention.

create table lti_launch_log (
  id uuid primary key default gen_random_uuid(),
  launched_at timestamptz not null default now(),
  status text not null,                  -- success | jwt_error | config_error | provision_error | other_error
  message_type text,                     -- LtiResourceLinkRequest | LtiDeepLinkingRequest | ...
  platform_issuer text,
  client_id text,
  deployment_id text,
  resource_link_id text,
  resource_link_title text,
  context_id text,
  context_title text,
  user_sub text,                         -- stable LTI subject id from the platform
  user_email text,
  user_name text,
  student_id uuid references student(id) on delete set null,
  error_stage text,                      -- state_mismatch | jwt_verify | claim_extract | provision_user | session_create | other
  error_message text,
  duration_ms integer
);

create index lti_launch_log_launched_at_desc_idx
  on lti_launch_log (launched_at desc);

create index lti_launch_log_status_idx
  on lti_launch_log (status, launched_at desc);

alter table lti_launch_log enable row level security;

comment on table lti_launch_log is 'Integration-observability log for every LTI launch attempt. Not a security audit log. Safe to rotate/truncate after 90 days.';
comment on column lti_launch_log.status is 'success | jwt_error | config_error | provision_error | other_error';
comment on column lti_launch_log.error_stage is 'If status != success, which step failed: state_mismatch | jwt_verify | claim_extract | provision_user | session_create | other';
