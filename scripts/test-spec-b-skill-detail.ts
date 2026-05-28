/**
 * Structural invariants for Spec B — student-owned skill detail.
 * Routes/components can't run under tsx; comment-stripped source scan.
 * USAGE: npx tsx scripts/test-spec-b-skill-detail.ts
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

section('Task 1: POST /api/student/skill-definition')
{
  const r = stripComments(read('src/app/api/student/skill-definition/route.ts'))
  assertEqual(/export async function POST/.test(r), true, 'exports POST')
  assertEqual(/export const runtime = 'nodejs'/.test(r) && /export const dynamic = 'force-dynamic'/.test(r), true, 'runtime/dynamic set')
  assertEqual(/getV2StudentId/.test(r), true, 'resolves student via getV2StudentId (self-scoped)')
  assertEqual(/student_skill_definition/.test(r), true, 'writes student_skill_definition')
  assertEqual(/is_current/.test(r) && /false/.test(r), true, 'demotes prior is_current')
  assertEqual(/prompted_by/.test(r) && /self_initiated/.test(r), true, "prompted_by 'self_initiated'")
  assertEqual(/definitionText|definition_text/.test(r) && /trim\(\)/.test(r), true, 'validates non-empty definition')
  assertEqual(/student_id:\s*studentId|student_id:\s*resolved/.test(r), true, 'writes resolved student id, not a body-supplied one')
}

section('Task 2: GET /api/student/skill/[skillId]/unreflected-work')
{
  const r = stripComments(read('src/app/api/student/skill/[skillId]/unreflected-work/route.ts'))
  assertEqual(/export async function GET/.test(r), true, 'exports GET')
  assertEqual(/export const runtime = 'nodejs'/.test(r) && /export const dynamic = 'force-dynamic'/.test(r), true, 'runtime/dynamic set')
  assertEqual(/getV2StudentId/.test(r), true, 'student-scoped via getV2StudentId')
  assertEqual(/work_skill_tag/.test(r), true, 'reads work_skill_tag for the skill')
  assertEqual(/activeInProgress/.test(r) && /items/.test(r), true, 'returns { activeInProgress, items }')
  assertEqual(/in_progress/.test(r) && /completed/.test(r), true, 'excludes work with in_progress/completed conversations')
  assertEqual(/slice\(0, 5\)|limit\(5\)|\.slice\(0,5\)/.test(r), true, 'caps at 5')
  assertEqual(/status:\s*'unreflected'/.test(r), true, 'items carry status unreflected')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
