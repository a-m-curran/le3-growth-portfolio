/**
 * Structural invariants for the staff passlink auth bridge.
 * Routes/scripts/SQL can't run under tsx; comment-stripped source scan
 * (SQL read raw). USAGE: npx tsx scripts/test-staff-passlink.ts
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { assertEqual, section, finish } from './_sync-test-harness'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (rel: string): string =>
  existsSync(resolve(__dirname, '..', rel))
    ? readFileSync(resolve(__dirname, '..', rel), 'utf-8')
    : ''
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

section('Task 1: 017_auth_passlink.sql migration')
{
  const sql = read('supabase/migrations/017_auth_passlink.sql')
  assertEqual(/create table auth_passlink/.test(sql), true, 'creates auth_passlink table')
  assertEqual(/coach_id uuid not null references coach\(id\) on delete cascade/.test(sql), true, 'coach_id FK with cascade')
  assertEqual(/token_hash text not null unique/.test(sql), true, 'token_hash text not null unique')
  assertEqual(/revoked_at timestamptz/.test(sql), true, 'revoked_at column')
  assertEqual(/last_used_at timestamptz/.test(sql), true, 'last_used_at column')
  assertEqual(/alter table auth_passlink enable row level security/.test(sql), true, 'RLS enabled')
}

section('Task 2: redirectWithSession extracted to shared module')
{
  const mod = stripComments(read('src/lib/auth/redirect-with-session.ts'))
  assertEqual(/export async function redirectWithSession\s*\(/.test(mod), true, 'shared module exports redirectWithSession')
  assertEqual(/type: 'magiclink'/.test(mod) && /hashed_token/.test(mod), true, 'mints magiclink hashed_token')
  assertEqual(/\/api\/auth\/callback\?/.test(mod), true, 'redirects to /api/auth/callback')
  const launch = stripComments(read('src/app/api/lti/launch/route.ts'))
  assertEqual(/import \{ redirectWithSession \} from '@\/lib\/auth\/redirect-with-session'/.test(launch), true, 'launch route imports the shared helper')
  assertEqual(/async function redirectWithSession\s*\(/.test(launch), false, 'launch route no longer defines redirectWithSession locally')
}

section('Task 3: /api/auth/passlink endpoint + middleware unchanged')
{
  const r = stripComments(read('src/app/api/auth/passlink/route.ts'))
  assertEqual(/export const dynamic = 'force-dynamic'/.test(r) && /export const runtime = 'nodejs'/.test(r), true, 'dynamic + nodejs runtime')
  assertEqual(/createHash\('sha256'\)/.test(r), true, 'hashes token with SHA-256')
  assertEqual(/from\('auth_passlink'\)/.test(r) && /\.is\('revoked_at', null\)/.test(r), true, 'looks up non-revoked auth_passlink')
  assertEqual(/from\('coach'\)/.test(r) && /status !== 'active'/.test(r), true, 'requires active coach')
  assertEqual(/import \{ redirectWithSession \} from '@\/lib\/auth\/redirect-with-session'/.test(r) && /redirectWithSession\(\s*admin,/.test(r), true, 'delegates to shared session helper')
  assertEqual(/'\/v2\/coach'/.test(r), true, 'lands on /v2/coach')
  assertEqual(/\/login\?error=invalid_link/.test(r), true, 'generic invalid_link error')
  assertEqual(/ACTIVE_ROLE_COOKIE/.test(r), true, 'sets active-role cookie (coach)')
  const mw = stripComments(read('src/middleware.ts'))
  assertEqual(/pathname\.startsWith\('\/api\/auth'\)/.test(mw), true, 'middleware still public-allowlists /api/auth (passlink inherits it)')
  assertEqual(/passlink/.test(mw), false, 'middleware NOT edited for passlink')
}

section('Task 4: scripts/issue-passlink.ts')
{
  const s = stripComments(read('scripts/issue-passlink.ts'))
  assertEqual(/dotenvConfig\(\{ path: '\.env\.local' \}\)/.test(s), true, 'loads .env.local before supabase import')
  assertEqual(/SUPABASE_SERVICE_ROLE_KEY/.test(s) && /createClient\(/.test(s), true, 'own service-role client (no @/ import)')
  assertEqual(/from '@\//.test(s), false, 'no @/ alias imports (tsx-safe)')
  assertEqual(/admin\.createUser|auth\.admin\.createUser/.test(s) && /email_confirm: true/.test(s), true, 'provisions auth user')
  assertEqual(/from\('coach'\)/.test(s) && /status: 'active'/.test(s), true, 'ensures an active coach row')
  assertEqual(/randomBytes\(32\)/.test(s) && /createHash\('sha256'\)/.test(s), true, '256-bit token, stored hashed')
  assertEqual(/from\('auth_passlink'\)[\s\S]{0,80}\.insert/.test(s), true, 'inserts auth_passlink row')
  assertEqual(/--rotate/.test(s) && /revoked_at/.test(s), true, '--rotate revokes prior links')
  assertEqual(/process\.env\.LTI_TOOL_URL/.test(s), true, 'builds URL from LTI_TOOL_URL')
  assertEqual(/NOT minting|already exists/i.test(s), true, 'idempotent no-op path when active link exists')
}

section('Task 5: scripts/revoke-passlink.ts')
{
  const s = stripComments(read('scripts/revoke-passlink.ts'))
  assertEqual(/dotenvConfig\(\{ path: '\.env\.local' \}\)/.test(s), true, 'loads .env.local')
  assertEqual(/from '@\//.test(s), false, 'no @/ alias imports (tsx-safe)')
  assertEqual(/from\('coach'\)[\s\S]{0,120}\.eq\('email', email\)/.test(s), true, 'resolves coach by email')
  assertEqual(/from\('auth_passlink'\)[\s\S]{0,160}revoked_at/.test(s) && /\.is\('revoked_at', null\)/.test(s), true, 'sets revoked_at on active links')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
