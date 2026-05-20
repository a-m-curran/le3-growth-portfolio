/**
 * Structural invariants for the reflect+today redesign.
 * Components/routes can't run under tsx; comment-stripped source scan.
 * USAGE: npx tsx scripts/test-reflect-today-redesign.ts
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

section('Task 1: shared types module')
{
  const t = stripComments(read('src/components/v2/student/types.ts'))
  assertEqual(/export type SubmissionStatus\s*=\s*'unreflected'\s*\|\s*'in_progress'\s*\|\s*'completed'/.test(t), true, 'SubmissionStatus union exported')
  assertEqual(/export interface SubmissionItem/.test(t), true, 'SubmissionItem interface exported')
  assertEqual(/export interface ActiveInProgress/.test(t), true, 'ActiveInProgress interface exported')
  assertEqual(/conversationType:\s*'work_based'\s*\|\s*'open_reflection'/.test(t), true, 'ActiveInProgress.conversationType union present')
  assertEqual(/currentPhase:\s*1\s*\|\s*2\s*\|\s*3/.test(t), true, 'ActiveInProgress.currentPhase literal union')
}

section('Task 2: POST /api/conversation/[id]/discard')
{
  const r = stripComments(read('src/app/api/conversation/[id]/discard/route.ts'))
  assertEqual(/export const dynamic = 'force-dynamic'/.test(r) && /export const runtime = 'nodejs'/.test(r), true, 'force-dynamic + nodejs runtime')
  assertEqual(/export async function POST\s*\(/.test(r), true, 'POST handler exported')
  assertEqual(/getV2StudentId/.test(r), true, 'auth via getV2StudentId')
  assertEqual(/status: 'abandoned'/.test(r), true, "sets status='abandoned'")
  assertEqual(/\.eq\('status', 'in_progress'\)/.test(r), true, "only updates if currently in_progress")
  assertEqual(/conversation\.discarded/.test(r), true, "logs 'conversation.discarded' event")
  assertEqual(/createAdminClient/.test(r), true, 'uses admin client')
  assertEqual(/\.eq\('student_id'/.test(r) || /student_id !== /.test(r), true, 'verifies student ownership')
}

section('Task 3: /api/conversation/start honors discardAndStart')
{
  const r = stripComments(read('src/app/api/conversation/start/route.ts'))
  assertEqual(/discardAndStart/.test(r), true, 'reads discardAndStart from request body')
  assertEqual(/conversation\.abandoned_explicit/.test(r), true, "logs 'conversation.abandoned_explicit' event")
  assertEqual(/existing && existing\.length > 0 && existing\[0\]\.response_phase_1/.test(r), true, 'PR #13 phase-1-gated resume guard preserved')
  assertEqual(/conversation\.abandoned_empty/.test(r), true, 'PR #13 auto-abandon-empty default-flag log preserved')
}

section('Task 4: /api/student/reflect new shape')
{
  const r = stripComments(read('src/app/api/student/reflect/route.ts'))
  assertEqual(/activeInProgress/.test(r), true, 'returns activeInProgress field')
  assertEqual(/submissions/.test(r), true, 'returns submissions field')
  assertEqual(/\.limit\(20\)/.test(r), false, 'no .limit(20) reintroduced')
  assertEqual(/\.limit\(50\)/.test(r), false, 'no .limit(50) reintroduced')
  assertEqual(/\.slice\(0,\s*5\)/.test(r), false, 'no .slice(0,5) reintroduced')
  assertEqual(/inProgress:\s*convos/.test(r), false, "old 'inProgress' top-level field removed")
  assertEqual(/featuredWork:/.test(r), false, "old 'featuredWork' top-level field removed")
  assertEqual(/'unreflected'/.test(r) && /'in_progress'/.test(r) && /'completed'/.test(r), true, 'per-row status discriminator present')
  assertEqual(/from\('student_work'\)/.test(r) && /from\('growth_conversation'\)/.test(r), true, 'queries both tables')
  assertEqual(/from '@\/components\/v2\/student\/types'/.test(r) || /from '@\/components\/v2\/student\/types\.js'/.test(r), true, 'imports shared SubmissionItem / ActiveInProgress types')
  assertEqual(/getV2StudentId/.test(r), true, 'auth via getV2StudentId')
  assertEqual(/export const dynamic = 'force-dynamic'/.test(r), true, 'force-dynamic')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<

finish()
