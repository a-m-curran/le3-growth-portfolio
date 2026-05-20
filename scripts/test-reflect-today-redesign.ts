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

section('Task 5: /api/student/today new shape')
{
  const r = stripComments(read('src/app/api/student/today/route.ts'))
  assertEqual(/activeInProgress/.test(r), true, 'returns activeInProgress field')
  assertEqual(/submissions/.test(r), true, 'returns submissions field')
  assertEqual(/featuredWork:/.test(r), false, "old 'featuredWork' top-level field removed")
  assertEqual(/\.from\('student_work'\)[\s\S]*\.limit\(5\)/.test(r), false, "no .limit(5) on student_work reintroduced")
  assertEqual(/recentJournal/.test(r), true, 'recentJournal preserved')
  assertEqual(/weekStats/.test(r), true, 'weekStats preserved')
  assertEqual(/ltiPinned/.test(r), true, 'ltiPinned preserved')
  assertEqual(/parseLtiContext/.test(r), true, 'parseLtiContext helper preserved')
  assertEqual(/\.eq\('conversation_type', 'open_reflection'\)[\s\S]*\.limit\(3\)/.test(r), true, 'recentJournal .limit(3) preserved (intentional)')
  assertEqual(/from '@\/components\/v2\/student\/types'/.test(r), true, 'imports shared types')
}

section('Task 6: SubmissionRow component')
{
  const c = stripComments(read('src/components/v2/student/SubmissionRow.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function SubmissionRow/.test(c), true, 'SubmissionRow exported')
  assertEqual(/surface:\s*'reflect'\s*\|\s*'today'/.test(c), true, 'surface prop union')
  assertEqual(/['"]Start['"]/.test(c) && /['"]Resume['"]/.test(c) && /['"]View['"]/.test(c), true, 'all three action chip labels')
  assertEqual(/aria-label/.test(c), true, 'status glyph has aria-label')
  assertEqual(/pillarStripeStyle/.test(c), true, 'uses pillarStripeStyle for completed rows')
  assertEqual(/from '@\/components\/v2\/student\/types'/.test(c), true, 'imports SubmissionItem')
  assertEqual(/<button/.test(c), true, 'renders <button>')
}

section('Task 7: DiscardConfirmDialog component')
{
  const c = stripComments(read('src/components/v2/student/DiscardConfirmDialog.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function DiscardConfirmDialog/.test(c), true, 'DiscardConfirmDialog exported')
  assertEqual(/role="dialog"/.test(c), true, 'has role="dialog"')
  assertEqual(/aria-modal/.test(c), true, 'has aria-modal')
  assertEqual(/onConfirm/.test(c) && /onCancel/.test(c), true, 'onConfirm + onCancel props')
  assertEqual(/Escape/.test(c), true, 'handles Escape to cancel')
  assertEqual(/Discard/.test(c) && /Cancel/.test(c), true, 'Discard + Cancel buttons')
}

section('Task 8: InProgressBanner component')
{
  const c = stripComments(read('src/components/v2/student/InProgressBanner.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function InProgressBanner/.test(c), true, 'InProgressBanner exported')
  assertEqual(/DiscardConfirmDialog/.test(c), true, 'uses DiscardConfirmDialog')
  assertEqual(/\/api\/conversation\/.*\/discard/.test(c), true, 'POSTs to /api/conversation/[id]/discard')
  assertEqual(/Resume/.test(c) && /Discard/.test(c), true, 'Resume + Discard buttons')
  assertEqual(/from '@\/components\/v2\/student\/types'/.test(c), true, 'imports ActiveInProgress')
  assertEqual(/router\.push\(['"`]\/v2\/conversation\//.test(c), true, 'Resume navigates to /v2/conversation/[id]')
  assertEqual(/work_context|workContext|workTitle/.test(c), true, 'falls back to work context for open_reflection')
}

section('Task 9: InProgressInterstitial component')
{
  const c = stripComments(read('src/components/v2/student/InProgressInterstitial.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function InProgressInterstitial/.test(c), true, 'InProgressInterstitial exported')
  assertEqual(/role="dialog"/.test(c) && /aria-modal/.test(c), true, 'modal a11y attrs')
  assertEqual(/Resume in-progress/.test(c), true, 'Resume in-progress button')
  assertEqual(/Discard and start new/.test(c), true, 'Discard and start new button')
  assertEqual(/Cancel/.test(c), true, 'Cancel button')
  assertEqual(/DiscardConfirmDialog/.test(c), true, 'uses DiscardConfirmDialog')
  assertEqual(/discardAndStart:\s*true/.test(c), true, 'POSTs /api/conversation/start with discardAndStart:true')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<

finish()
