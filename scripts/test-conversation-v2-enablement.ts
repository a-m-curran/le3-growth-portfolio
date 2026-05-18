/**
 * Structural source-scan for the conversation/reflection v2 enablement.
 * Pure: reads source files, asserts the v2-identity shape. No DB/env.
 *
 * USAGE: npx tsx scripts/test-conversation-v2-enablement.ts
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertEqual, section, finish } from './_sync-test-harness'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

async function main(): Promise<void> {
  section('reflect/start + tags: v2 identity resolver (no v1 auth pattern)')
  for (const p of [
    'src/app/api/reflect/start/route.ts',
    'src/app/api/conversation/[id]/tags/route.ts',
  ]) {
    const code = stripComments(read(p))
    assertEqual(/getV2StudentId\s*\(/.test(code), true, `${p} calls getV2StudentId()`)
    assertEqual(
      /\.eq\(\s*['"]auth_user_id['"]\s*,\s*user\.id\s*\)/.test(code),
      false,
      `${p} no longer resolves student by auth_user_id+user.id`
    )
    assertEqual(
      /supabase\.auth\.getUser\s*\(/.test(code),
      false,
      `${p} no longer calls supabase.auth.getUser()`
    )
  }

  section('tags: ownership violation returns 403')
  {
    const code = read('src/app/api/conversation/[id]/tags/route.ts')
    assertEqual(/status:\s*403/.test(code), true, 'tags returns 403 on ownership violation')
  }

  section('conversation/start: v2 identity + admin data client')
  {
    const code = stripComments(read('src/app/api/conversation/start/route.ts'))
    assertEqual(/getV2StudentId\s*\(/.test(code), true, 'conversation/start calls getV2StudentId()')
    assertEqual(/createAdminClient\s*\(/.test(code), true, 'conversation/start uses createAdminClient()')
    assertEqual(
      /supabase\.auth\.getUser\s*\(/.test(code),
      false,
      'conversation/start no longer calls supabase.auth.getUser()'
    )
    assertEqual(
      /createServerClient\s*\(/.test(code),
      false,
      'conversation/start no longer creates the RLS anon client'
    )
  }

  section('v2 reflect/start: real surface (no longer the stub)')
  {
    const code = read('src/app/v2/(student)/reflect/start/page.tsx')
    assertEqual(/'use client'/.test(code), true, 'reflect/start is a client component')
    assertEqual(
      /\/api\/conversation\/start/.test(code),
      true,
      'reflect/start POSTs /api/conversation/start'
    )
    assertEqual(
      /\/v2\/conversation\//.test(code),
      true,
      'reflect/start routes into /v2/conversation/[id]'
    )
    assertEqual(
      /still being built/.test(code),
      false,
      'the v2 IA "still being built" stub copy is gone'
    )
  }

  section('v2 Journal: v2-native composer, no v1 ReflectForm bounce')
  {
    const jv = read('src/app/v2/(student)/journal/JournalView.tsx')
    assertEqual(
      /@\/app\/reflect\/ReflectForm/.test(jv),
      false,
      'JournalView no longer imports the v1 ReflectForm'
    )
    assertEqual(
      /V2ReflectComposer/.test(jv),
      true,
      'JournalView uses V2ReflectComposer'
    )
    const comp = read('src/app/v2/(student)/journal/V2ReflectComposer.tsx')
    assertEqual(/\/api\/reflect\/start/.test(comp), true, 'composer POSTs /api/reflect/start')
    assertEqual(/\/v2\/conversation\//.test(comp), true, 'composer routes into /v2/conversation/[id]')
  }

  section('lti/launch: env-gated internal redirect; handshake untouched')
  {
    const raw = read('src/app/api/lti/launch/route.ts')
    const code = stripComments(raw)
    assertEqual(
      /LTI_POST_LAUNCH_STUDENT_PATH/.test(code) && /LTI_POST_LAUNCH_INSTRUCTOR_PATH/.test(code),
      true,
      'both LTI post-launch path env vars are used'
    )
    assertEqual(
      /['"]\/conversation\?lti_resource=/.test(code),
      false,
      'old hardcoded v1 student redirect is gone'
    )
    assertEqual(
      /redirectWithSession\(\s*\n?\s*admin,\s*\n?\s*email,\s*\n?\s*['"]\/coach['"]/.test(code),
      false,
      'old hardcoded /coach instructor redirect is gone'
    )
    // D2L-facing handshake must remain intact (no integration change).
    assertEqual(/verifyPlatformJwt\s*\(/.test(code), true, 'JWT verification still present')
    assertEqual(/redirectWithSession\s*\(/.test(code), true, 'session mint/redirect still present')
    assertEqual(/lti_context/.test(code), true, 'lti_context cookie still set (v2 Today consumes it)')
  }

  finish()
}
main()
