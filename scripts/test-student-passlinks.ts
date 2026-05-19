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

section('Task 3: passlink endpoint — student branch + coach path preserved')
{
  const r = stripComments(read('src/app/api/auth/passlink/route.ts'))
  assertEqual(/select\('id, coach_id, student_id, revoked_at'\)/.test(r), true, 'selects student_id too')
  assertEqual(/link\.coach_id/.test(r) && /'\/v2\/coach'/.test(r) && /value: 'coach'/.test(r), true, 'coach path preserved (/v2/coach, cookie coach)')
  assertEqual(/link\.student_id/.test(r) && /from\('student'\)/.test(r), true, 'student branch loads student')
  assertEqual(/process\.env\.LTI_POST_LAUNCH_STUDENT_PATH \|\| '\/v2\/today'/.test(r), true, 'STUDENT_LANDING default /v2/today')
  assertEqual(/value: 'student'/.test(r), true, 'student cookie role')
  assertEqual(/status !== 'active'/.test(r), true, 'active gate (coach & student)')
  assertEqual((r.match(/\/login\?error=invalid_link/g) || []).length >= 1 && /function invalid\(/.test(r), true, 'generic invalid_link preserved')
  const mw = stripComments(read('src/middleware.ts'))
  assertEqual(/pathname\.startsWith\('\/api\/auth'\)/.test(mw) && /passlink/.test(mw) === false, true, 'middleware unchanged (public via /api/auth)')
  const rws = stripComments(read('src/lib/auth/redirect-with-session.ts'))
  assertEqual(/export async function redirectWithSession/.test(rws) && /type: 'magiclink'/.test(rws), true, 'redirect-with-session unchanged')
}

section('Task 4: passlink-admin lib')
{
  const s = stripComments(read('src/lib/auth/passlink-admin.ts'))
  assertEqual(/export async function ensureSubjectAndMint\s*\(/.test(s), true, 'ensureSubjectAndMint exported')
  assertEqual(/export async function gatherPilotSubjects\s*\(/.test(s), true, 'gatherPilotSubjects exported')
  assertEqual(/export async function getPasslinkRoster\s*\(/.test(s), true, 'getPasslinkRoster exported')
  assertEqual(/export async function rotatePasslink\s*\(/.test(s), true, 'rotatePasslink exported')
  assertEqual(/export async function revokeAllPasslinks\s*\(/.test(s), true, 'revokeAllPasslinks exported')
  assertEqual(/export function toCsv\s*\(/.test(s), true, 'toCsv exported')
  assertEqual(/randomBytes\(32\)/.test(s) && /createHash\('sha256'\)/.test(s), true, '256-bit token stored hashed')
  assertEqual(/from\('instructor'\)/.test(s) && /toLowerCase\(\)/.test(s), true, 'instructors gathered + lowercased dedup')
  assertEqual(/email_confirm: true/.test(s), true, 'provisions auth user')
  assertEqual(/is_demo/.test(s) && /'active'/.test(s), true, 'active non-demo scoping')
  assertEqual(/"(.*?)"/.test(s) === true && /replace\(/.test(s), true, 'CSV escaping present')
}

section('Task 5: admin passlink routes')
{
  const issue = stripComments(read('src/app/api/admin/passlinks/issue/route.ts'))
  const roster = stripComments(read('src/app/api/admin/passlinks/route.ts'))
  const rotate = stripComments(read('src/app/api/admin/passlinks/rotate/route.ts'))
  const revoke = stripComments(read('src/app/api/admin/passlinks/revoke-all/route.ts'))
  for (const [name, src] of [['issue', issue], ['roster', roster], ['rotate', rotate], ['revoke', revoke]] as const) {
    assertEqual(/import \{ requireAdmin \} from '@\/lib\/auth\/require-admin'/.test(src), true, `${name}: uses requireAdmin`)
    assertEqual(/const gate = await requireAdmin\(\)/.test(src) && /!gate\.ok/.test(src), true, `${name}: gate enforced`)
    assertEqual(/export const runtime = 'nodejs'/.test(src) && /export const dynamic = 'force-dynamic'/.test(src), true, `${name}: runtime/dynamic`)
  }
  assertEqual(/text\/csv/.test(issue) && /Content-Disposition/.test(issue) && /attachment; filename=/.test(issue), true, 'issue returns CSV attachment')
  assertEqual(/export const maxDuration\s*=\s*300/.test(issue), true, 'issue sets maxDuration=300 (bulk-issue timeout)')
  assertEqual(/gatherPilotSubjects/.test(issue) && /ensureSubjectAndMint/.test(issue) && /toCsv/.test(issue), true, 'issue uses lib')
  assertEqual(/getPasslinkRoster/.test(roster), true, 'roster uses getPasslinkRoster')
  assertEqual(/rotatePasslink/.test(rotate), true, 'rotate uses rotatePasslink')
  assertEqual(/revokeAllPasslinks/.test(revoke), true, 'revoke-all uses revokeAllPasslinks')
}

section('Task 6: Tools Passlinks tab + panel + prefetch')
{
  const tv = stripComments(read('src/app/v2/(coach)/coach/tools/ToolsView.tsx'))
  assertEqual(/'passlinks'/.test(tv) && /label="Passlinks"/.test(tv), true, 'ToolsView has Passlinks tab')
  assertEqual(/<PasslinksPanel/.test(tv) && /from '@\/components\/coach\/PasslinksPanel'/.test(tv), true, 'renders PasslinksPanel')
  const pg = stripComments(read('src/app/v2/(coach)/coach/tools/page.tsx'))
  assertEqual(/getPasslinkRoster/.test(pg) && /from '@\/lib\/auth\/passlink-admin'/.test(pg), true, 'page prefetches roster')
  const pp = stripComments(read('src/components/coach/PasslinksPanel.tsx'))
  assertEqual(/'use client'/.test(pp), true, 'PasslinksPanel is client')
  assertEqual(/\/api\/admin\/passlinks\/issue/.test(pp) && /attachment|download|Blob/.test(pp), true, 'issue → CSV download')
  assertEqual(/\/api\/admin\/passlinks\/rotate/.test(pp), true, 'rotate wired')
  assertEqual(/\/api\/admin\/passlinks\/revoke-all/.test(pp) && /confirm\(/.test(pp), true, 'revoke-all confirm-gated')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
