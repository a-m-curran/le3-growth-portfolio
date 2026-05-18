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

// Task 2 appends its section here.
finish()
