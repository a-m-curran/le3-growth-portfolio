/**
 * Structural invariants for the course-quarter integration.
 * Routes/scripts/SQL can't run under tsx; comment-stripped source scan
 * (SQL read raw). USAGE: npx tsx scripts/test-sync-quarter.ts
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

section('Task 2: currentQuarter() extracted to src/lib/sync/quarter.ts')
{
  const q = stripComments(read('src/lib/sync/quarter.ts'))
  assertEqual(/export function currentQuarter\(\)\s*:\s*string/.test(q), true, 'currentQuarter exported with string return type')
  assertEqual(/Winter|Spring|Summer|Fall/.test(q), true, 'returns one of Winter/Spring/Summer/Fall')
  const s = stripComments(read('src/lib/sync/sync-course.ts'))
  assertEqual(/import\s*\{\s*currentQuarter\s*\}\s*from\s*['"]@\/lib\/sync\/quarter['"]/.test(s), true, 'sync-course.ts imports currentQuarter from new module')
  assertEqual(/^function currentQuarter\(\)/m.test(s), false, 'sync-course.ts no longer defines currentQuarter locally')
  // Regression-assert: line 384's `cohort: currentQuarter()` still present (unchanged).
  assertEqual(/cohort:\s*currentQuarter\(\)/.test(s), true, "line 384's cohort: currentQuarter() preserved (OUT OF SCOPE)")
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<

finish()
