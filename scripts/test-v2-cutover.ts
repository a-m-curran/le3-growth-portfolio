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
    ['src/app/demo/page.tsx', '/v2/demo'],
    ['src/app/demo/career/page.tsx', '/v2/demo'],
    ['src/app/demo/coach/page.tsx', '/v2/demo'],
    ['src/app/demo/coach/[studentId]/page.tsx', '/v2/demo'],
    ['src/app/demo/coach/[studentId]/prep/page.tsx', '/v2/demo'],
    ['src/app/demo/conversation/page.tsx', '/v2/demo'],
    ['src/app/demo/conversation/[id]/page.tsx', '/v2/demo'],
    ['src/app/demo/garden/page.tsx', '/v2/demo'],
    ['src/app/demo/narrative/page.tsx', '/v2/demo'],
    ['src/app/demo/reflect/page.tsx', '/v2/demo'],
    ['src/app/demo/reflection/new/page.tsx', '/v2/demo'],
    ['src/app/demo/work/import/page.tsx', '/v2/demo'],
  ]
  for (const [file, target] of cases) {
    const code = stripComments(read(file))
    assertEqual(/from 'next\/navigation'/.test(code) && /redirect\(/.test(code), true, `${file} is a redirect stub`)
    assertEqual(code.includes(`redirect(\`${target}`) || code.includes(`redirect('${target}'`), true, `${file} → ${target}`)
    assertEqual(/getCurrentStudent|getGardenData|DataConsentModal|ConversationFlow|GardenClient/.test(code), false, `${file} no longer renders v1 content`)
  }
  const demoLayout = stripComments(read('src/app/demo/layout.tsx'))
  assertEqual(/return\s*<>\{?\s*children\s*\}?<\/>|return children/.test(demoLayout) || /=>\s*children/.test(demoLayout), true, 'demo layout is a passthrough')
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
  assertEqual(/href="\/v2\/demo"/.test(code), true, 'demo link → /v2/demo')
  assertEqual(/href="\/demo"/.test(code), false, 'no v1 /demo link')
}
finish()
