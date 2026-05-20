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

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<

finish()
