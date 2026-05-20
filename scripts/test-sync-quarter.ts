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

section('Task 3: D2LCourseOffering raw type')
{
  const t = stripComments(read('src/lib/d2l/types.ts'))
  assertEqual(/export interface D2LCourseOffering/.test(t), true, 'D2LCourseOffering interface exported')
  assertEqual(/Identifier:\s*string/.test(t) && /Name:\s*string/.test(t) && /Code:\s*string\s*\|\s*null/.test(t), true, 'has Identifier / Name / Code')
  assertEqual(/IsActive:\s*boolean/.test(t), true, 'has IsActive')
  assertEqual(/StartDate:\s*string\s*\|\s*null/.test(t), true, 'has StartDate (nullable)')
  assertEqual(/EndDate:\s*string\s*\|\s*null/.test(t), true, 'has EndDate (nullable)')
  assertEqual(/Semester:\s*\{[\s\S]{0,200}Identifier:\s*string[\s\S]{0,200}Name:\s*string[\s\S]{0,200}\}\s*\|\s*null/.test(t), true, 'has Semester reference (nullable, with Identifier+Name)')
}

section('Task 4: NormalizedCourse extended with quarter / startDate / semesterName')
{
  const t = stripComments(read('src/lib/d2l/types.ts'))
  assertEqual(/export interface NormalizedCourse\s*\{[\s\S]{0,400}quarter:\s*string\b/.test(t), true, 'NormalizedCourse.quarter (non-null string)')
  assertEqual(/export interface NormalizedCourse\s*\{[\s\S]{0,500}startDate:\s*string\s*\|\s*null/.test(t), true, 'NormalizedCourse.startDate (nullable)')
  assertEqual(/export interface NormalizedCourse\s*\{[\s\S]{0,600}semesterName:\s*string\s*\|\s*null/.test(t), true, 'NormalizedCourse.semesterName (nullable)')
  assertEqual(/orgUnitId:\s*string/.test(t) && /name:\s*string/.test(t) && /code:\s*string\s*\|\s*null/.test(t) && /active:\s*boolean/.test(t), true, 'existing NormalizedCourse fields preserved')
}

section('Task 5: deriveQuarter helper in src/lib/d2l/mappers.ts')
{
  const m = stripComments(read('src/lib/d2l/mappers.ts'))
  assertEqual(/export function deriveQuarter/.test(m), true, 'deriveQuarter exported')
  assertEqual(/import\s*\{\s*currentQuarter\s*\}\s*from\s*['"]@\/lib\/sync\/quarter['"]/.test(m), true, 'imports currentQuarter from @/lib/sync/quarter')
  assertEqual(/\^\(Winter\|Spring\|Summer\|Fall\)\\s\+\\d\{4\}\$/.test(m), true, 'canonical Semester.Name regex present')
  assertEqual(/SEASON_BY_MONTH/.test(m) && /Winter.*Spring.*Summer.*Fall/.test(m), true, 'SEASON_BY_MONTH array present')
  assertEqual(/semesterName:\s*string\s*\|\s*null/.test(m) && /startDate:\s*string\s*\|\s*null/.test(m), true, 'helper input shape (semesterName + startDate, both nullable)')
  assertEqual(/deriveQuarter[\s\S]{0,200}\):\s*string\b/.test(m), true, 'deriveQuarter returns string')
  assertEqual(/export function normalizeCourseOffering/.test(m), true, 'normalizeCourseOffering exported (maps raw D2L payload to NormalizedCourse)')
}

section('Task 6: getCourse() requests full CourseOffering + uses mapper')
{
  const c = stripComments(read('src/lib/d2l/courses.ts'))
  // Imports the new mapper + raw type.
  assertEqual(/import\s*\{[\s\S]{0,200}normalizeCourseOffering[\s\S]{0,200}\}\s*from\s*['"]\.\/mappers['"]/.test(c), true, 'imports normalizeCourseOffering from ./mappers')
  assertEqual(/import\s+type\s*\{[\s\S]{0,200}D2LCourseOffering[\s\S]{0,200}\}\s*from\s*['"]\.\/types['"]/.test(c), true, 'imports D2LCourseOffering type from ./types')
  // getCourse uses the new mapper.
  assertEqual(/export async function getCourse\([\s\S]{0,400}return\s+normalizeCourseOffering\(/.test(c), true, 'getCourse() delegates to normalizeCourseOffering')
  // The lpGet call requests the new typed shape.
  assertEqual(/lpGet<D2LCourseOffering>/.test(c), true, 'lpGet<D2LCourseOffering>(...) typed request')
  // The minimal inline type from the old getCourse is gone.
  assertEqual(/lpGet<\{\s*Identifier:\s*string;\s*Name:\s*string;\s*Code:[\s\S]{0,80}IsActive:\s*boolean\s*\}>/.test(c), false, 'old minimal inline type removed')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<

finish()
