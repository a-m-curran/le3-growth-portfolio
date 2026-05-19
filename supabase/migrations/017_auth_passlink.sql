-- Permanent per-coach login link tokens (the "staff passlink" bridge).
--
-- Non-LTI staff (coaches; instructors are coach rows in v2) cannot use
-- magic-link email login: Supabase's built-in email provider is
-- project-rate-limited and no controllable sending domain exists yet to
-- configure custom SMTP. Students and LTI launches are unaffected.
--
-- Each row is one permanent, revocable, bookmarkable login token for a
-- coach. The token itself is never stored — only its SHA-256 hash. The
-- /api/auth/passlink endpoint hashes the presented token, looks up a
-- non-revoked row, and delegates to the existing verifyOtp/callback
-- session path. Issued/rotated/revoked via scripts/*-passlink.ts.
--
-- Written only via the service-role admin client. RLS is enabled with
-- no policy — same convention as event_log/instructor: anon and
-- authenticated get deny-all; the service role bypasses RLS.

create table auth_passlink (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coach(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index auth_passlink_coach_id_idx
  on auth_passlink (coach_id);

create index auth_passlink_active_idx
  on auth_passlink (coach_id)
  where revoked_at is null;

alter table auth_passlink enable row level security;

comment on table auth_passlink is 'Permanent per-coach login-link tokens (no-email staff auth bridge). Service-role only. Issue/rotate/revoke via scripts/issue-passlink.ts and scripts/revoke-passlink.ts.';
comment on column auth_passlink.token_hash is 'SHA-256 hex of the URL token. The plaintext token is never stored and is unrecoverable after issuance.';
comment on column auth_passlink.revoked_at is 'When set, the link is dead. Endpoint lookups filter revoked_at is null.';
