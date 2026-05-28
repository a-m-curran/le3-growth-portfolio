/**
 * Structural invariants for Spec A — inline guidance + recent submissions.
 * Components/routes can't run under tsx; comment-stripped source scan.
 * USAGE: npx tsx scripts/test-spec-a-guidance.ts
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

section('Item 1: page subtitle calibration')
{
  const reflect = stripComments(read('src/app/v2/(student)/reflect/page.tsx'))
  assertEqual(/Pick a piece of work to talk through\. Your reflections become part of your growth story\./.test(reflect), true, 'reflect subtitle calibrated')
  assertEqual(/Reflect on submitted student work/.test(reflect), false, 'old reflect subtitle removed')

  const growth = stripComments(read('src/app/v2/(student)/growth/page.tsx'))
  assertEqual(/Watch your skills grow over time\. Click any to see the conversations behind it\./.test(growth), true, 'growth subtitle calibrated')

  const career = stripComments(read('src/app/v2/(student)/career/page.tsx'))
  assertEqual(/How to talk about your growth — in resumes, in interviews, in your own words\./.test(career), true, 'career subtitle calibrated')

  const narrative = stripComments(read('src/app/v2/(student)/narrative/page.tsx'))
  assertEqual(/Your story for each skill, built from how you talk about your work\./.test(narrative), true, 'narrative subtitle calibrated')

  const today = stripComments(read('src/app/v2/(student)/today/TodayView.tsx'))
  assertEqual(/of work waiting for you/.test(today), true, 'today actionable subtitle calibrated')
  assertEqual(/You're caught up\. Nothing waiting on you right now\./.test(today), true, 'today caught-up subtitle calibrated')
  assertEqual(/Your portfolio fills in as you submit work\./.test(today), true, 'today welcome subtitle calibrated')
  assertEqual(/things? to reflect on/.test(today), false, 'old today subtitle removed')

  const journal = stripComments(read('src/app/v2/(student)/journal/page.tsx'))
  assertEqual(/think through it together\./.test(journal), true, 'journal subtitle unchanged (voice bar)')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
