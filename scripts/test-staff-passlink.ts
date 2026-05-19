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

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
