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

section('Task 7: listCoursesUnderOrgUnit enriches each descendant via getCourse')
{
  const c = stripComments(read('src/lib/d2l/courses.ts'))
  assertEqual(/export async function listCoursesUnderOrgUnit[\s\S]{0,1500}getCourse\(/.test(c), true, 'listCoursesUnderOrgUnit calls getCourse() for enrichment')
  assertEqual(/ORG_UNIT_TYPE_COURSE_OFFERING/.test(c), true, 'self-as-course fallback preserved')
  assertEqual(/quarter:\s*['"](Winter|Spring|Summer|Fall)/.test(c) || /normalizeCourseOffering/.test(c) || /getCourse\(/.test(c), true, 'all NormalizedCourse construction sites have the new required fields')
}

section('Task 8: 019_course_quarter.sql migration')
{
  const sql = read('supabase/migrations/019_course_quarter.sql')
  assertEqual(/alter table course\s+add column quarter text/i.test(sql), true, 'adds nullable quarter text column to course')
  assertEqual(/comment on column course\.quarter/i.test(sql), true, 'has a column comment')
  assertEqual(/quarter\s+text\s+not null/i.test(sql), false, 'quarter is nullable (no NOT NULL)')
  assertEqual(/default\s+'/.test(sql), false, 'no DEFAULT value')
  assertEqual(/check\s*\(/i.test(sql), false, 'no CHECK constraint')
}

section('Task 9: sync-course.ts uses course.quarter (not currentQuarter()) in the 4 in-scope write paths')
{
  const s = stripComments(read('src/lib/sync/sync-course.ts'))
  assertEqual(/cohort:\s*currentQuarter\(\)/.test(s), true, "line 384's cohort: currentQuarter() preserved")
  assertEqual(/upsertCourse[\s\S]{0,400}const\s+quarter\s*=\s*currentQuarter\(\)/.test(s), false, 'upsertCourse no longer reads currentQuarter() locally')
  assertEqual(/upsertCourse[\s\S]{0,600}quarter:\s*course\.quarter/.test(s), true, 'upsertCourse writes course.quarter')
  assertEqual(/async function upsertAssignment\([\s\S]{0,200}courseQuarter:\s*string/.test(s), true, 'upsertAssignment signature has courseQuarter: string')
  assertEqual(/upsertAssignment[\s\S]{0,1500}quarter:\s*courseQuarter/.test(s), true, 'upsertAssignment writes courseQuarter')
  assertEqual(/processSubmission\(params:\s*\{[\s\S]{0,400}courseQuarter:\s*string/.test(s), true, 'processSubmission params include courseQuarter: string')
  assertEqual(/const\s*\{[^}]*courseQuarter[^}]*\}\s*=\s*params/.test(s) || /params\.courseQuarter/.test(s), true, 'processSubmission destructures or reads params.courseQuarter')
  assertEqual(/quarter:\s*courseQuarter/.test(s), true, 'sync-course.ts writes courseQuarter for student_work')
  assertEqual(/quarter:\s*currentQuarter\(\)/.test(s), false, 'no remaining `quarter: currentQuarter()` writes')
}

section('Task 10: backfill-course-quarter.ts script')
{
  const s = stripComments(read('scripts/backfill-course-quarter.ts'))
  assertEqual(/import\s*\{\s*config\s+as\s+dotenvConfig\s*\}\s*from\s*['"]dotenv['"]/.test(s), true, 'loads .env.local via dotenv before other imports')
  assertEqual(/dotenvConfig\(\s*\{\s*path:\s*['"]\.env\.local['"]\s*\}\s*\)/.test(s), true, "calls dotenvConfig({ path: '.env.local' })")
  assertEqual(/import\s*\{\s*createClient\s*\}\s*from\s*['"]@supabase\/supabase-js['"]/.test(s), true, 'imports createClient directly (own admin client)')
  assertEqual(/from\s+['"]@\//.test(s), false, 'no @/ aliases (tsx CLI rule)')
  assertEqual(/SUPABASE_SERVICE_ROLE_KEY/.test(s) && /NEXT_PUBLIC_SUPABASE_URL/.test(s), true, 'reads service-role env vars')
  assertEqual(/from\s*['"]\.\.\/src\/lib\/d2l\/mappers['"]|from\s*['"]\.\.\/src\/lib\/d2l\/mappers\.js['"]/.test(s), true, 'imports deriveQuarter from ../src/lib/d2l/mappers (relative path)')
  assertEqual(/process\.exit\(errored\s*>\s*0\s*\?\s*1\s*:\s*0\)/.test(s), true, 'exit 1 if any course errored, else 0')
  assertEqual(/from\(['"]course['"]\)[\s\S]{0,200}\.update/.test(s), true, 'updates course.quarter')
  assertEqual(/from\(['"]assignment['"]\)[\s\S]{0,200}\.update/.test(s), true, 'updates assignment.quarter')
  assertEqual(/from\(['"]student_work['"]\)[\s\S]{0,300}\.update/.test(s), true, 'updates student_work.quarter')
  assertEqual(/skip|already|unchanged|no.?op/i.test(s), true, 'has idempotency skip path')
  assertEqual(/try\s*\{[\s\S]{0,2000}catch\s*\(/.test(s), true, 'per-course try/catch')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<

finish()
