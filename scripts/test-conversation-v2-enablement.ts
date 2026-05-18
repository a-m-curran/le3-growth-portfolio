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

  // Tasks 2–5 append their sections here.

  finish()
}
main()
