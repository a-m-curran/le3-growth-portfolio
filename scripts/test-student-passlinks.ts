/**
 * Structural invariants for student/pilot passlinks + admin surface.
 * Routes/components/SQL can't run under tsx; comment-stripped source
 * scan (SQL read raw). USAGE: npx tsx scripts/test-student-passlinks.ts
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

section('Task 1: 018_auth_passlink_student.sql generalizes the subject')
{
  const sql = read('supabase/migrations/018_auth_passlink_student.sql')
  assertEqual(/add column student_id uuid references student\(id\) on delete cascade/.test(sql), true, 'adds student_id FK cascade')
  assertEqual(/alter column coach_id drop not null/.test(sql), true, 'relaxes coach_id NOT NULL')
  assertEqual(/check \(\(coach_id is not null\) <> \(student_id is not null\)\)/.test(sql), true, 'exactly-one-subject CHECK')
  assertEqual(/create index auth_passlink_student_active_idx[\s\S]{0,80}where revoked_at is null/.test(sql), true, 'student active partial index')
}

section('Task 2: requireAdmin reusable gate')
{
  const g = stripComments(read('src/lib/auth/require-admin.ts'))
  assertEqual(/export async function requireAdmin\s*\(/.test(g), true, 'requireAdmin exported')
  assertEqual(/supabase\.auth\.getUser\(\)/.test(g) && /status: 401/.test(g), true, 'unauth → 401')
  assertEqual(/from\('coach'\)[\s\S]{0,120}\.eq\('auth_user_id', user\.id\)/.test(g), true, 'resolves coach by auth_user_id')
  assertEqual(/isAdminEmail\(/.test(g) && /status: 403/.test(g), true, 'non-admin → 403')
  assertEqual(/ok: true/.test(g) && /ok: false/.test(g), true, 'discriminated result')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
