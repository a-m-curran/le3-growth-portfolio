/**
 * Structural invariants for the SP1 v2 cutover.
 *
 * Pages/route handlers can't run under tsx; this is a comment-stripped
 * source scan of the load-bearing invariants. Behavioral proof is the
 * Task 5 manual runbook.
 *
 * USAGE: npx tsx scripts/test-v2-cutover.ts
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

section('SP1: root → /v2')
{
  const code = stripComments(read('src/app/page.tsx'))
  assertEqual(/redirect\(\s*['"]\/v2['"]\s*\)/.test(code), true, 'root page redirects to /v2')
  assertEqual(/redirect\(\s*['"]\/garden['"]/.test(code), false, 'root no longer redirects to v1 /garden')
}

section('SP1: auth callback no-next fallback → /v2; LTI path untouched')
{
  const raw = read('src/app/api/auth/callback/route.ts')
  const code = stripComments(raw)
  assertEqual(
    /nextPath \|\| ['"]\/garden['"]/.test(code) || /nextPath \|\| ['"]\/coach['"]/.test(code),
    false,
    'no v1 nextPath fallback (/garden or /coach) remains'
  )
  assertEqual(
    (code.match(/nextPath \|\| ['"]\/v2['"]/g) || []).length >= 5,
    true,
    'all 5 no-next fallbacks now use /v2'
  )
  assertEqual(/verifyOtp\(/.test(code), true, 'OTP verification still present')
  assertEqual(/exchangeCodeForSession\(/.test(code), true, 'code exchange still present')
  assertEqual(
    /const nextPath = next && next\.startsWith\('\/'\) \? next : null/.test(code),
    true,
    'nextPath derivation unchanged (LTI passes explicit next → never hits fallback)'
  )
  assertEqual(
    /\/login\?error=not_enrolled/.test(code),
    true,
    'rejection path unchanged'
  )
}

section('SP1: v1 pages are redirect stubs to v2')
{
  // v1 surfaces under the root namespace still redirect to v2 (this
  // half of the SP1 invariant is permanent). The v1 demo subtree
  // (src/app/demo/*) was removed in the Tier-2 demo simplification —
  // see the next section for the new direct-link demo routes.
  const cases: [string, string][] = [
    ['src/app/garden/page.tsx', '/v2'],
    ['src/app/coach/page.tsx', '/v2/coach'],
    ['src/app/coach/[studentId]/page.tsx', '/v2/coach/'],
    ['src/app/coach/[studentId]/prep/page.tsx', '/v2/coach/'],
    ['src/app/conversation/page.tsx', '/v2'],
    ['src/app/conversation/[id]/page.tsx', '/v2/conversation/'],
    ['src/app/reflect/page.tsx', '/v2/journal'],
    ['src/app/reflection/new/page.tsx', '/v2/journal'],
    ['src/app/narrative/page.tsx', '/v2/narrative'],
    ['src/app/career/page.tsx', '/v2/career'],
  ]
  for (const [file, target] of cases) {
    const code = stripComments(read(file))
    assertEqual(/from 'next\/navigation'/.test(code) && /redirect\(/.test(code), true, `${file} is a redirect stub`)
    assertEqual(code.includes(`redirect(\`${target}`) || code.includes(`redirect('${target}'`), true, `${file} → ${target}`)
    assertEqual(/getCurrentStudent|getGardenData|DataConsentModal|ConversationFlow|GardenClient/.test(code), false, `${file} no longer renders v1 content`)
  }
}

section('Tier-2 demo simplification: direct-link demo routes')
{
  // Replaces /v2/demo (persona picker) + /api/v2/demo-as. Two route
  // handlers set the persona cookie and redirect into the right shell.
  const aja = stripComments(read('src/app/demo/aja/route.ts'))
  assertEqual(/export async function GET/.test(aja), true, '/demo/aja exports GET handler')
  assertEqual(/PERSONA_COOKIE/.test(aja) && /stu_aja/.test(aja), true, '/demo/aja sets PERSONA_COOKIE to stu_aja')
  assertEqual(/\/v2\/today/.test(aja), true, '/demo/aja redirects to /v2/today')

  const eliz = stripComments(read('src/app/demo/elizabeth/route.ts'))
  assertEqual(/export async function GET/.test(eliz), true, '/demo/elizabeth exports GET handler')
  assertEqual(/PERSONA_COOKIE/.test(eliz) && /coach_elizabeth/.test(eliz), true, '/demo/elizabeth sets PERSONA_COOKIE to coach_elizabeth')
  assertEqual(/\/v2\/coach/.test(eliz), true, '/demo/elizabeth redirects to /v2/coach')

  // Old picker + API are gone
  assertEqual(read('src/app/v2/demo/page.tsx') === '', true, '/v2/demo picker page removed')
  assertEqual(read('src/app/api/v2/demo-as/route.ts') === '', true, '/api/v2/demo-as route handler removed')

  // No DEMO_MODE env-var branches anywhere in src/app
  const v2Root = stripComments(read('src/app/v2/page.tsx'))
  const v2Me = stripComments(read('src/app/v2/me/page.tsx'))
  const coachStudent = stripComments(read('src/app/v2/(coach)/coach/[studentId]/page.tsx'))
  assertEqual(/NEXT_PUBLIC_DEMO_MODE/.test(v2Root), false, '/v2 page has no DEMO_MODE branch')
  assertEqual(/NEXT_PUBLIC_DEMO_MODE/.test(v2Me), false, '/v2/me page has no DEMO_MODE branch')
  assertEqual(/NEXT_PUBLIC_DEMO_MODE/.test(coachStudent), false, '/v2/coach/[studentId] page has no DEMO_MODE branch')

  // Group layouts redirect to /login, not /v2/demo
  const studentLayout = stripComments(read('src/app/v2/(student)/layout.tsx'))
  const coachLayout = stripComments(read('src/app/v2/(coach)/layout.tsx'))
  assertEqual(/\/v2\/demo/.test(studentLayout), false, '(student) layout no longer references /v2/demo')
  assertEqual(/\/v2\/demo/.test(coachLayout), false, '(coach) layout no longer references /v2/demo')
  assertEqual((studentLayout.match(/redirect\(['"]\/login['"]\)/g) || []).length >= 2, true, '(student) layout has two /login redirects')
  assertEqual((coachLayout.match(/redirect\(['"]\/login['"]\)/g) || []).length >= 2, true, '(coach) layout has two /login redirects')

  // Middleware no longer allowlists /v2/demo
  const mw = stripComments(read('src/middleware.ts'))
  assertEqual(/\/v2\/demo/.test(mw), false, 'middleware drops /v2/demo allowlist')
  assertEqual(/pathname\.startsWith\('\/demo'\)/.test(mw), true, "middleware still allowlists /demo (for /demo/aja and /demo/elizabeth)")
  // Persona cookie pass-through: middleware must let persona-cookie
  // visits hit /v2/today and /v2/coach without a Supabase session,
  // otherwise the direct-link demo flow dead-ends at /login. v2-auth
  // validates the cookie value against the DB so a tampered cookie
  // still bounces from the downstream layout.
  assertEqual(/PERSONA_COOKIE/.test(mw), true, 'middleware imports/declares PERSONA_COOKIE')
  assertEqual(/req\.cookies\.get\(PERSONA_COOKIE\)/.test(mw), true, 'middleware reads PERSONA_COOKIE before session check')
}

section('SP1: /login restyled to v2, behavior byte-identical')
{
  const raw = read('src/app/login/page.tsx')
  const code = stripComments(raw)
  assertEqual(/signInWithOtp\(/.test(code), true, 'magic-link send preserved')
  assertEqual(/emailRedirectTo: `\$\{window\.location\.origin\}\/api\/auth\/callback`/.test(code), true, 'emailRedirectTo unchanged')
  assertEqual(/error=auth|not_enrolled|error\) === 'not_enrolled'|'not_enrolled'/.test(code), true, 'rejection notice preserved')
  assertEqual(/<Suspense/.test(code) && /useSearchParams\(\)/.test(code), true, 'Suspense + useSearchParams preserved')
  assertEqual(/setSent\(true\)/.test(code), true, 'sent state preserved')
  assertEqual(/rounded-2xl bg-white border border-gray-200 shadow-sm/.test(code), true, 'v2 Card styling applied')
  assertEqual(/bg-gray-50/.test(code), true, 'v2 background applied')
  // Demo entry-point link removed in the Tier-2 demo simplification —
  // demos are direct-share URLs only (/demo/aja, /demo/elizabeth), not
  // advertised on the login page.
  assertEqual(/href="\/v2\/demo"/.test(code), false, 'login page no longer links to /v2/demo')
  assertEqual(/href="\/demo"/.test(code), false, 'no v1 /demo link')
}
finish()
