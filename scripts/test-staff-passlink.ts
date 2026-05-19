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

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
