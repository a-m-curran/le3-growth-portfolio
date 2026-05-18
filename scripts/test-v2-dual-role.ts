/**
 * Structural invariants for the v2 dual-role identity feature.
 *
 * Route handlers can't run under tsx (next/headers cookies() throws
 * outside a request scope), so this is a comment-stripped source scan
 * of the load-bearing invariants. Behavioral proof is the DoD runbook
 * (Task 5).
 *
 * USAGE:
 *   npx tsx scripts/test-v2-dual-role.ts
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { assertEqual, section, finish } from './_sync-test-harness'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '..', rel), 'utf-8')
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

section('v2-auth: dual-role active-role resolution')
{
  const raw = read('src/lib/v2-auth.ts')
  const code = stripComments(raw)
  assertEqual(
    /ACTIVE_ROLE_COOKIE\s*=\s*['"]le3-v2-active-role['"]/.test(code),
    true,
    'ACTIVE_ROLE_COOKIE const defined as le3-v2-active-role'
  )
  assertEqual(
    /export\s*\{[^}]*ACTIVE_ROLE_COOKIE[^}]*\}/.test(code),
    true,
    'ACTIVE_ROLE_COOKIE is exported'
  )
  assertEqual(
    (code.match(/dualRole/g) || []).length >= 4,
    true,
    'dualRole present on both V2Identity variants + resolution + demo returns'
  )
  assertEqual(
    /\.from\('coach'\)[\s\S]*?\.from\('student'\)/.test(code),
    true,
    'real-auth branch looks up BOTH coach and student'
  )
  assertEqual(
    /cookieStore\.get\(ACTIVE_ROLE_COOKIE\)/.test(code),
    true,
    'reads the active-role cookie'
  )
  assertEqual(
    /activeRole === 'student' \? asStudent\(\) : asCoach\(\)/.test(code),
    true,
    'cookie selects student; coach-first is the default'
  )
}

// Task 2 appends its section here.
finish()
