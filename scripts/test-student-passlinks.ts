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

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
