# Course Quarter Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the D2L sync's `currentQuarter()` placeholder for `assignment.quarter` and `student_work.quarter` with a real per-course quarter derived from D2L's CourseOffering (Semester.Name preferred → StartDate-derived → `currentQuarter()` safety net), persisted to a new `course.quarter` column and denormalized at sync write time.

**Architecture:** Pull `Semester` and `StartDate` from D2L's `/courses/{orgUnitId}` endpoint into an extended `NormalizedCourse`. A pure `deriveQuarter` helper in `src/lib/d2l/mappers.ts` computes the canonical `"Season YYYY"` value with a 3-step priority chain. Sync's `upsertCourse` writes it to `course.quarter` (new column from migration 019). `upsertAssignment` and `processSubmission` take a `courseQuarter` parameter threaded from the sync loop instead of calling `currentQuarter()` directly. An owner-runnable backfill script refetches the 47 courses from D2L and updates the chain idempotently.

**Tech Stack:** TypeScript / Next.js 14 (server-side library code in `src/lib`), Supabase (Postgres + service-role admin client), D2L Brightspace Valence API (existing client in `src/lib/d2l/`), structural source-scan test via `npx tsx` against `scripts/_sync-test-harness.ts`.

---

## Pre-flight (READ BEFORE STARTING)

- **Owner-applied steps the implementer must NOT take:**
  - **Do NOT apply migration 019** (`019_course_quarter.sql`). It is committed to `supabase/migrations/` but applied by the owner via the Supabase migration workflow as part of the final runbook.
  - **Do NOT run** `npx tsx scripts/backfill-course-quarter.ts`. It is committed but run by the owner against production in the final runbook.
  - `tsc`, `eslint`, `npm run build`, and the structural test do NOT require `course.quarter` to exist in the DB — all queries are untyped (no generated Supabase types in this repo). The structural test scans source files, not a live DB.
- **Reversibility:** migration 019 is additive — `alter table course drop column quarter` cleanly reverses. No data dependencies. Backfill is idempotent (skip if derived equals stored).
- **No env vars added. No infra changes.**
- **Regression baselines that MUST stay green at every task gate** (call these out by name + count):
  - `scripts/test-sync-course.ts` → **5 passed / 0 failed**
  - `scripts/test-sync-engine.ts` → **27 / 0**
  - `scripts/test-sync-dup-d2l-id.ts` → **5 / 0**
  - `scripts/test-sync-inspect.ts` → **12 / 0**
  - `scripts/test-sync-race.ts` → **6 / 0**
  - `scripts/test-sync-run.ts` → **8 / 0**
  - `scripts/test-staff-passlink.ts` → **35 / 0**
  - `scripts/test-student-passlinks.ts` → **56 / 0**
  - `scripts/test-reflect-today-redesign.ts` → **125 / 0**
- **Worktree:** execute in a NEW worktree `.worktrees/course-quarter` branched from current `origin/main` HEAD. Copy `/Users/andrewcurran/le3-growth-portfolio/.env.local` into it so `npm run build` is faithful. Do NOT touch the parked worktrees (`conversation-validator`, `conversation-v2-enablement`, `mobile-bottom-nav`, `student-passlinks`, `v2-cutover`, `v2-dual-role`, `v2-me-preferences`, `reflect-course-code-drop`).
- **Gates:**
  - `npx tsc --noEmit` exit 0.
  - `npx eslint --no-eslintrc --config .eslintrc.json <changed files>` exit 0, no warnings.
  - **NEVER** `npx next lint`.
  - `npm run build` exit 0 (only at the final verification task).
- **`@/` rule:** in-app code (`src/lib`, `src/app`) uses `@/` aliases + `createAdminClient` from `@/lib/supabase-admin` normally. The backfill script in `scripts/` MUST use relative imports + own service-role client via `createClient(url, key, { auth: { persistSession: false } })`, mirroring `scripts/issue-passlink.ts` exactly. This is the only file where `@/` aliases are forbidden.
- **One commit per task. Structural test built up section-per-task before a single trailing `finish()` via marker `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<`.**

---

## File Structure (decomposition)

**New files:**
| Path | Responsibility |
|---|---|
| `scripts/test-sync-quarter.ts` | Structural source-scan test for the whole feature. Built section-by-task. |
| `src/lib/sync/quarter.ts` | Extracted `currentQuarter()` function. Pure; no imports from sync-course.ts. Imported by `sync-course.ts` (replaces local definition) and `mappers.ts` (safety-net in `deriveQuarter`). |
| `src/lib/d2l/mappers.ts` | New file. Exports `deriveQuarter({ semesterName, startDate })` and a helper for the full `D2LCourseOffering → NormalizedCourse` mapping. |
| `supabase/migrations/019_course_quarter.sql` | Owner-applied. Adds nullable `quarter text` column to `course` with a column comment. |
| `scripts/backfill-course-quarter.ts` | Owner-runnable tsx CLI. Refetches all 47 courses from D2L, derives quarter, updates `course` + `assignment` + `student_work` in a per-course transaction. Idempotent. |

**Modified files:**
| Path | Change |
|---|---|
| `src/lib/d2l/types.ts` | Add `D2LCourseOffering` raw interface. Extend `NormalizedCourse` with `quarter: string`, `startDate: string | null`, `semesterName: string | null`. |
| `src/lib/d2l/courses.ts` | `getCourse()` requests the full CourseOffering payload + delegates to the new mapper. `listCoursesUnderOrgUnit()` enriches each descendant via `getCourse(orgUnitId)` so callers always get a fully-shaped NormalizedCourse. |
| `src/lib/sync/sync-course.ts` | (a) Remove local `currentQuarter()` definition; import from `@/lib/sync/quarter`. (b) `upsertCourse` writes `quarter: course.quarter` (was `currentQuarter()`). (c) `upsertAssignment` adds a `courseQuarter: string` param; uses it instead of `currentQuarter()`. (d) `processSubmission` adds `courseQuarter: string` to its params interface; uses it for both the `student_work` insert AND the in-memory `StudentWork` object built for `autoTagWork`. (e) `syncSingleCourse` threads `course.quarter` into all three call sites. **OUT OF SCOPE (regression-assert preserved):** line 384's `cohort: currentQuarter()` stays unchanged. |

**Unchanged (regression-assert):**
- Other student_work write paths: `src/app/api/work/submit/route.ts`, `src/app/api/lti/notice/route.ts`, `src/app/api/work/import/route.ts`, `src/lib/recovery/recover-extractions.ts`. They set `quarter` independently and are out of scope.
- All passlinks/admin/auth code, ReflectTree, TodayBuckets, conversation views.
- `cohort: currentQuarter()` at sync-course.ts line 384.

---

## Task 1: Test scaffold

**Files:**
- Create: `scripts/test-sync-quarter.ts`

- [ ] **Step 1: Create the test scaffold**

Create `scripts/test-sync-quarter.ts` with EXACTLY this content:

```ts
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

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<

finish()
```

The marker `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<` is CRITICAL; future tasks insert sections immediately above it.

- [ ] **Step 2: Run test to verify the scaffold runs**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: `0 passed, 0 failed`. Exit code 0.

- [ ] **Step 3: tsc + eslint**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx eslint --no-eslintrc --config .eslintrc.json scripts/test-sync-quarter.ts
```
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && git add scripts/test-sync-quarter.ts && git commit -m "feat(course-quarter): scaffold structural test"
```

---

## Task 2: Extract `currentQuarter()` to its own module

**Files:**
- Create: `src/lib/sync/quarter.ts`
- Modify: `src/lib/sync/sync-course.ts` (remove local `currentQuarter`, import from new module)
- Modify: `scripts/test-sync-quarter.ts` (insert section above marker)

- [ ] **Step 1: Write the failing test**

Insert ABOVE the marker:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: 5 assertions FAIL (file doesn't exist; sync-course.ts still has local definition).

- [ ] **Step 3: Create `src/lib/sync/quarter.ts`**

Create `src/lib/sync/quarter.ts` with EXACTLY:

```ts
/**
 * Calendar-quarter-at-call-time, in canonical "Season YYYY" form.
 *
 * Extracted from sync-course.ts so it can be imported by
 * src/lib/d2l/mappers.ts (the deriveQuarter helper's safety-net
 * fallback) without a circular dep between d2l and sync modules.
 *
 * No behavior change from the prior in-file definition.
 */
export function currentQuarter(): string {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  if (month < 3) return `Winter ${year}`
  if (month < 6) return `Spring ${year}`
  if (month < 9) return `Summer ${year}`
  return `Fall ${year}`
}
```

- [ ] **Step 4: Remove the local definition + add the import in sync-course.ts**

Remove the local `function currentQuarter()` definition (lines ~681-689 — the exact span ends with the function's closing `}`). Locate the line `function currentQuarter(): string {` and use Edit to replace the entire function body with nothing (or delete the lines). The exact text to find and remove:

```ts
function currentQuarter(): string {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  if (month < 3) return `Winter ${year}`
  if (month < 6) return `Spring ${year}`
  if (month < 9) return `Summer ${year}`
  return `Fall ${year}`
}
```

Replace with nothing (empty string).

Then add the import. Find the existing import block at the top of the file (the lines starting with `import ...`) and add a new line at the end of that block:

```ts
import { currentQuarter } from '@/lib/sync/quarter'
```

If your Edit tool fails because the import block doesn't have a unique anchor, use this targeted replacement — find the line that imports `NormalizedCourse` (around line 17):

```ts
  type NormalizedCourse,
```

And replace with:

```ts
  type NormalizedCourse,
} from '@/lib/d2l'
import { currentQuarter } from '@/lib/sync/quarter'
import {
```

…NO. That approach is fragile. Instead, find a stable anchor — the LAST line of the existing import block. Read the file's import region (typically lines 1-25) and append the new import as a single line immediately after the last existing `import …` line. Verify after the edit that no duplicate imports were created.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: 5 passed, 0 failed (the assertions from this task; Task 1's scaffold has 0 of its own).

- [ ] **Step 6: tsc + eslint + regressions**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx eslint --no-eslintrc --config .eslintrc.json src/lib/sync/quarter.ts src/lib/sync/sync-course.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-course.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-engine.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-run.ts
```
Expected: tsc 0, eslint 0; sync-course 5/0; sync-engine 27/0; sync-run 8/0.

- [ ] **Step 7: Commit**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && git add src/lib/sync/quarter.ts src/lib/sync/sync-course.ts scripts/test-sync-quarter.ts && git commit -m "refactor(sync): extract currentQuarter() to src/lib/sync/quarter.ts"
```

---

## Task 3: Add `D2LCourseOffering` raw type

**Files:**
- Modify: `src/lib/d2l/types.ts`
- Modify: `scripts/test-sync-quarter.ts`

- [ ] **Step 1: Write the failing test**

Insert ABOVE the marker:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: 6 new assertions fail.

- [ ] **Step 3: Add the interface to types.ts**

In `src/lib/d2l/types.ts`, locate the section header `// ─── NORMALIZED APPLICATION TYPES ───` (the comment block before `NormalizedCourse`). Insert this new interface IMMEDIATELY BEFORE that section header:

```ts
/** Response shape from /lp/{ver}/courses/{orgUnitId} — full CourseOffering. */
export interface D2LCourseOffering {
  Identifier: string
  Name: string
  Code: string | null
  IsActive: boolean
  Path: string
  StartDate: string | null
  EndDate: string | null
  Semester: {
    Identifier: string
    Name: string
    Code: string | null
  } | null
  // Other CourseOffering fields exist (Department, CourseTemplate, etc.)
  // but the sync does not consume them.
}

```

(The trailing blank line preserves the section break with the NORMALIZED APPLICATION TYPES comment.)

Use Edit to anchor on the section comment. Find:

```ts
// ─── NORMALIZED APPLICATION TYPES ───────────────────
```

And replace with:

```ts
/** Response shape from /lp/{ver}/courses/{orgUnitId} — full CourseOffering. */
export interface D2LCourseOffering {
  Identifier: string
  Name: string
  Code: string | null
  IsActive: boolean
  Path: string
  StartDate: string | null
  EndDate: string | null
  Semester: {
    Identifier: string
    Name: string
    Code: string | null
  } | null
  // Other CourseOffering fields exist (Department, CourseTemplate, etc.)
  // but the sync does not consume them.
}

// ─── NORMALIZED APPLICATION TYPES ───────────────────
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: Tasks 2 + 3 = 11 passed, 0 failed.

- [ ] **Step 5: tsc + eslint**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx eslint --no-eslintrc --config .eslintrc.json src/lib/d2l/types.ts
```

- [ ] **Step 6: Commit**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && git add src/lib/d2l/types.ts scripts/test-sync-quarter.ts && git commit -m "feat(d2l): D2LCourseOffering raw type"
```

---

## Task 4: Extend `NormalizedCourse` with quarter / startDate / semesterName

**Files:**
- Modify: `src/lib/d2l/types.ts`
- Modify: `scripts/test-sync-quarter.ts`

- [ ] **Step 1: Write the failing test**

Insert ABOVE the marker:

```ts
section('Task 4: NormalizedCourse extended with quarter / startDate / semesterName')
{
  const t = stripComments(read('src/lib/d2l/types.ts'))
  // Locate the NormalizedCourse interface and assert the new fields are present.
  assertEqual(/export interface NormalizedCourse\s*\{[\s\S]{0,400}quarter:\s*string\b/.test(t), true, 'NormalizedCourse.quarter (non-null string)')
  assertEqual(/export interface NormalizedCourse\s*\{[\s\S]{0,500}startDate:\s*string\s*\|\s*null/.test(t), true, 'NormalizedCourse.startDate (nullable)')
  assertEqual(/export interface NormalizedCourse\s*\{[\s\S]{0,600}semesterName:\s*string\s*\|\s*null/.test(t), true, 'NormalizedCourse.semesterName (nullable)')
  // Preserve the existing fields.
  assertEqual(/orgUnitId:\s*string/.test(t) && /name:\s*string/.test(t) && /code:\s*string\s*\|\s*null/.test(t) && /active:\s*boolean/.test(t), true, 'existing NormalizedCourse fields preserved')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: 4 new assertions fail (first 3 — the existing-fields one passes).

- [ ] **Step 3: Extend the interface**

In `src/lib/d2l/types.ts`, find the current `NormalizedCourse` interface (around line 172):

```ts
export interface NormalizedCourse {
  orgUnitId: string
  name: string
  code: string | null
  active: boolean
  instructorEmail?: string
}
```

Replace with:

```ts
export interface NormalizedCourse {
  orgUnitId: string
  name: string
  code: string | null
  active: boolean
  instructorEmail?: string
  /** Canonical "Season YYYY". Never null (currentQuarter() safety net guarantees a value). */
  quarter: string
  /** Raw D2L CourseOffering.StartDate, for traceability. */
  startDate: string | null
  /** Raw D2L CourseOffering.Semester.Name, for traceability. */
  semesterName: string | null
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: Tasks 2 + 3 + 4 = 15 passed, 0 failed.

- [ ] **Step 5: eslint (deferred tsc gate)**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx eslint --no-eslintrc --config .eslintrc.json src/lib/d2l/types.ts
```
Expected: exit 0.

**The full-project `npx tsc --noEmit` gate is intentionally DEFERRED from this task to Task 7.** Making `quarter` / `startDate` / `semesterName` required on `NormalizedCourse` opens an expected cascade: `courses.ts`'s existing `listCoursesUnderOrgUnit` and `getCourse` callers build NormalizedCourse object literals without those three fields, so tsc surfaces `TS2741: Property 'quarter' is missing` (and similar for the other two) at those call sites. Tasks 5–7 close the cascade. Running `npx tsc --noEmit` here WILL fail with those exact errors; do NOT spend time chasing them — proceed to Task 5. The cascade is fully closed at Task 7 Step 5, which is the authoritative gate.

To confirm `types.ts` parses cleanly in isolation:
```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsc --noEmit src/lib/d2l/types.ts
```
Expected: exit 0 (interface extension alone is locally valid).

- [ ] **Step 6: Commit**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && git add src/lib/d2l/types.ts scripts/test-sync-quarter.ts && git commit -m "feat(d2l): extend NormalizedCourse with quarter / startDate / semesterName

Opens an expected tsc cascade: courses.ts callers now lack the three
new required fields. Tasks 5-7 close the cascade; Task 7's tsc gate
is the authoritative check."
```

---

## Task 5: Create `deriveQuarter` helper + `src/lib/d2l/mappers.ts`

**Files:**
- Create: `src/lib/d2l/mappers.ts`
- Modify: `scripts/test-sync-quarter.ts`

- [ ] **Step 1: Write the failing test**

Insert ABOVE the marker:

```ts
section('Task 5: deriveQuarter helper in src/lib/d2l/mappers.ts')
{
  const m = stripComments(read('src/lib/d2l/mappers.ts'))
  assertEqual(/export function deriveQuarter/.test(m), true, 'deriveQuarter exported')
  // Imports the safety-net currentQuarter from the extracted module.
  assertEqual(/import\s*\{\s*currentQuarter\s*\}\s*from\s*['"]@\/lib\/sync\/quarter['"]/.test(m), true, 'imports currentQuarter from @/lib/sync/quarter')
  // Strict canonical regex anchored at start/end.
  assertEqual(/\^\(Winter\|Spring\|Summer\|Fall\)\\s\+\\d\{4\}\$/.test(m), true, 'canonical Semester.Name regex present')
  // SEASON_BY_MONTH lookup table covers all 12 months.
  assertEqual(/SEASON_BY_MONTH/.test(m) && /Winter.*Spring.*Summer.*Fall/.test(m), true, 'SEASON_BY_MONTH array present')
  // Helper accepts the right input shape.
  assertEqual(/semesterName:\s*string\s*\|\s*null/.test(m) && /startDate:\s*string\s*\|\s*null/.test(m), true, 'helper input shape (semesterName + startDate, both nullable)')
  // Returns string (never null).
  assertEqual(/deriveQuarter[\s\S]{0,200}\):\s*string\b/.test(m), true, 'deriveQuarter returns string')
  // Full mapper for D2LCourseOffering -> NormalizedCourse.
  assertEqual(/export function normalizeCourseOffering/.test(m), true, 'normalizeCourseOffering exported (maps raw D2L payload to NormalizedCourse)')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: 7 new assertions fail.

- [ ] **Step 3: Create mappers.ts**

Create `src/lib/d2l/mappers.ts` with EXACTLY:

```ts
/**
 * Mappers from raw D2L Valence payloads to the application's
 * NormalizedCourse type.
 *
 * The pure deriveQuarter helper computes the canonical "Season YYYY"
 * for a course using the priority chain:
 *   1. Semester.Name (if matches /^(Winter|Spring|Summer|Fall)\s+\d{4}$/)
 *   2. StartDate month → Season + Year
 *   3. currentQuarter() safety net (calendar-quarter-at-call-time)
 *
 * deriveQuarter is pure and unit-testable. The structural test in
 * scripts/test-sync-quarter.ts asserts all branches of its shape.
 */

import { currentQuarter } from '@/lib/sync/quarter'
import type { D2LCourseOffering, NormalizedCourse } from './types'

const SEASON_BY_MONTH: ReadonlyArray<'Winter' | 'Spring' | 'Summer' | 'Fall'> = [
  'Winter', 'Winter', 'Winter',   // Jan-Mar (0-2)
  'Spring', 'Spring', 'Spring',   // Apr-Jun (3-5)
  'Summer', 'Summer', 'Summer',   // Jul-Sep (6-8)
  'Fall',   'Fall',   'Fall',     // Oct-Dec (9-11)
]

const CANONICAL_SEMESTER = /^(Winter|Spring|Summer|Fall)\s+\d{4}$/

export function deriveQuarter(input: {
  semesterName: string | null
  startDate: string | null
}): string {
  // Priority 1: D2L Semester.Name, if it's already canonical.
  if (input.semesterName && CANONICAL_SEMESTER.test(input.semesterName)) {
    return input.semesterName
  }
  // Priority 2: StartDate month → Season + the date's year.
  if (input.startDate) {
    const d = new Date(input.startDate)
    if (!isNaN(d.getTime())) {
      return `${SEASON_BY_MONTH[d.getMonth()]} ${d.getFullYear()}`
    }
  }
  // Priority 3: calendar-quarter-at-call-time (safety net).
  return currentQuarter()
}

/**
 * Map a raw D2L CourseOffering payload to NormalizedCourse.
 * Used by getCourse() (and listCoursesUnderOrgUnit() after enrichment).
 */
export function normalizeCourseOffering(raw: D2LCourseOffering): NormalizedCourse {
  return {
    orgUnitId: raw.Identifier,
    name: raw.Name,
    code: raw.Code,
    active: raw.IsActive,
    quarter: deriveQuarter({
      semesterName: raw.Semester?.Name ?? null,
      startDate: raw.StartDate,
    }),
    startDate: raw.StartDate,
    semesterName: raw.Semester?.Name ?? null,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: Tasks 2-5 = 22 passed, 0 failed.

- [ ] **Step 5: eslint (tsc still deferred — see Task 4)**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx eslint --no-eslintrc --config .eslintrc.json src/lib/d2l/mappers.ts
```
Expected: exit 0. Full-project `npx tsc --noEmit` is still in the deferred cascade (closes at Task 7 Step 5). `mappers.ts` itself parses cleanly:
```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsc --noEmit src/lib/d2l/mappers.ts
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && git add src/lib/d2l/mappers.ts scripts/test-sync-quarter.ts && git commit -m "feat(d2l): deriveQuarter helper + normalizeCourseOffering mapper"
```

---

## Task 6: Refactor `getCourse()` to request full CourseOffering + use mapper

**Files:**
- Modify: `src/lib/d2l/courses.ts`
- Modify: `scripts/test-sync-quarter.ts`

- [ ] **Step 1: Write the failing test**

Insert ABOVE the marker:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: 5 new fails.

- [ ] **Step 3: Refactor courses.ts**

Read `src/lib/d2l/courses.ts` in full (89 lines). Use Edit to replace the existing imports + `getCourse()` function with the refactored versions.

Replace the imports block (top of file):

```ts
import { lpGet, lpGetAllPaged } from './client'
import type { D2LOrgUnitDescendant, NormalizedCourse } from './types'
```

With:

```ts
import { lpGet, lpGetAllPaged } from './client'
import type { D2LCourseOffering, D2LOrgUnitDescendant, NormalizedCourse } from './types'
import { normalizeCourseOffering } from './mappers'
```

Then replace the existing `getCourse()` function (currently ~lines 71-88):

```ts
/**
 * Get details for a single course offering by org unit ID.
 */
export async function getCourse(orgUnitId: string): Promise<NormalizedCourse> {
  const info = await lpGet<{
    Identifier: string
    Name: string
    Code: string | null
    IsActive: boolean
  }>(`/courses/${orgUnitId}`)

  return {
    orgUnitId: info.Identifier,
    name: info.Name,
    code: info.Code,
    active: info.IsActive,
  }
}
```

With:

```ts
/**
 * Get details for a single course offering by org unit ID. Returns a
 * fully-shaped NormalizedCourse including derived quarter (via
 * normalizeCourseOffering, which applies the Semester→StartDate→
 * currentQuarter() priority chain).
 */
export async function getCourse(orgUnitId: string): Promise<NormalizedCourse> {
  const info = await lpGet<D2LCourseOffering>(`/courses/${orgUnitId}`)
  return normalizeCourseOffering(info)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: Tasks 2-6 = 27 passed, 0 failed.

- [ ] **Step 5: eslint (tsc still deferred — closes at Task 7)**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx eslint --no-eslintrc --config .eslintrc.json src/lib/d2l/courses.ts
```
Expected: exit 0. After Task 6, `getCourse()` produces fully-shaped NormalizedCourse via the mapper, but `listCoursesUnderOrgUnit`'s descendant `.map()` still hand-builds minimal objects → tsc continues to surface the cascade errors. Task 7 closes them.

- [ ] **Step 6: Commit**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && git add src/lib/d2l/courses.ts scripts/test-sync-quarter.ts && git commit -m "feat(d2l): getCourse() requests full CourseOffering + uses normalizeCourseOffering"
```

---

## Task 7: `listCoursesUnderOrgUnit()` enriches each descendant via `getCourse()`

**Files:**
- Modify: `src/lib/d2l/courses.ts`
- Modify: `scripts/test-sync-quarter.ts`

- [ ] **Step 1: Write the failing test**

Insert ABOVE the marker:

```ts
section('Task 7: listCoursesUnderOrgUnit enriches each descendant via getCourse')
{
  const c = stripComments(read('src/lib/d2l/courses.ts'))
  // Body of listCoursesUnderOrgUnit references getCourse (enriches each descendant).
  assertEqual(/export async function listCoursesUnderOrgUnit[\s\S]{0,1500}getCourse\(/.test(c), true, 'listCoursesUnderOrgUnit calls getCourse() for enrichment')
  // The descendant-fallback path (self-is-a-course) still works.
  assertEqual(/ORG_UNIT_TYPE_COURSE_OFFERING/.test(c), true, 'self-as-course fallback preserved')
  // The map() over descendants no longer hand-builds NormalizedCourse with only {orgUnitId, name, code, active}.
  // It either calls getCourse or builds the full shape with all required fields.
  assertEqual(/quarter:\s*['"](Winter|Spring|Summer|Fall)/.test(c) || /normalizeCourseOffering/.test(c) || /getCourse\(/.test(c), true, 'all NormalizedCourse construction sites have the new required fields')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: 3 new fails (the third may pass spuriously if Task 6's getCourse import is present, but body-of-list assertion fails).

- [ ] **Step 3: Refactor `listCoursesUnderOrgUnit`**

Find the existing function (currently ~lines 26-69):

```ts
export async function listCoursesUnderOrgUnit(
  parentOrgUnitId: string
): Promise<NormalizedCourse[]> {
  const path = `/orgstructure/${parentOrgUnitId}/descendants/?ouTypeId=${ORG_UNIT_TYPE_COURSE_OFFERING}`

  let descendants: D2LOrgUnitDescendant[] = []
  try {
    descendants = await lpGetAllPaged<D2LOrgUnitDescendant>(path)
  } catch {
    descendants = await lpGet<D2LOrgUnitDescendant[]>(path)
  }

  if (descendants.length > 0) {
    return descendants.map(d => ({
      orgUnitId: d.Identifier,
      name: d.Name,
      code: d.Code || null,
      active: true,
    }))
  }

  // No descendants. Check whether the configured org unit is itself a
  // Course Offering — if so, treat it as the (single) course to sync.
  const self = await lpGet<{
    Identifier: string
    Name: string
    Code: string | null
    Type: { Id: number; Code: string; Name: string }
  }>(`/orgstructure/${parentOrgUnitId}`)

  if (self.Type?.Id === ORG_UNIT_TYPE_COURSE_OFFERING) {
    return [
      {
        orgUnitId: self.Identifier,
        name: self.Name,
        code: self.Code || null,
        active: true,
      },
    ]
  }

  // Genuinely empty (container exists but has no course children).
  return []
}
```

Replace with:

```ts
export async function listCoursesUnderOrgUnit(
  parentOrgUnitId: string
): Promise<NormalizedCourse[]> {
  const path = `/orgstructure/${parentOrgUnitId}/descendants/?ouTypeId=${ORG_UNIT_TYPE_COURSE_OFFERING}`

  let descendants: D2LOrgUnitDescendant[] = []
  try {
    descendants = await lpGetAllPaged<D2LOrgUnitDescendant>(path)
  } catch {
    descendants = await lpGet<D2LOrgUnitDescendant[]>(path)
  }

  if (descendants.length > 0) {
    // The descendants endpoint returns lightweight rows (no Semester /
    // StartDate). Round-trip getCourse() per descendant to enrich each
    // one with the full CourseOffering payload, so callers always see
    // a fully-shaped NormalizedCourse (with derived quarter).
    // Bounded by ~47 today; one extra HTTP per discovered course is
    // acceptable at this scale. If a per-course fetch fails, fall
    // back to a minimal NormalizedCourse with currentQuarter() so the
    // sync isn't blocked.
    const enriched: NormalizedCourse[] = []
    for (const d of descendants) {
      try {
        enriched.push(await getCourse(d.Identifier))
      } catch {
        enriched.push(normalizeCourseOffering({
          Identifier: d.Identifier,
          Name: d.Name,
          Code: d.Code || null,
          IsActive: true,
          Path: '',
          StartDate: null,
          EndDate: null,
          Semester: null,
        }))
      }
    }
    return enriched
  }

  // No descendants. Check whether the configured org unit is itself a
  // Course Offering — if so, treat it as the (single) course to sync.
  const self = await lpGet<{
    Identifier: string
    Name: string
    Code: string | null
    Type: { Id: number; Code: string; Name: string }
  }>(`/orgstructure/${parentOrgUnitId}`)

  if (self.Type?.Id === ORG_UNIT_TYPE_COURSE_OFFERING) {
    // Self-as-course: enrich via getCourse() so we get the full
    // CourseOffering (Semester / StartDate) and the derived quarter.
    return [await getCourse(self.Identifier)]
  }

  // Genuinely empty (container exists but has no course children).
  return []
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: Tasks 2-7 = 30 passed, 0 failed.

- [ ] **Step 5: tsc + eslint + regressions (final cascade gate)**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx eslint --no-eslintrc --config .eslintrc.json src/lib/d2l/courses.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-course.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-engine.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-dup-d2l-id.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-inspect.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-race.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-run.ts
```
Expected: tsc 0; eslint 0; all 6 sync tests pass with the baseline counts (5/0, 27/0, 5/0, 12/0, 6/0, 8/0).

- [ ] **Step 6: Commit**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && git add src/lib/d2l/courses.ts scripts/test-sync-quarter.ts && git commit -m "feat(d2l): listCoursesUnderOrgUnit enriches each descendant via getCourse"
```

---

## Task 8: Migration `019_course_quarter.sql`

**Files:**
- Create: `supabase/migrations/019_course_quarter.sql`
- Modify: `scripts/test-sync-quarter.ts`

- [ ] **Step 1: Write the failing test**

Insert ABOVE the marker:

```ts
section('Task 8: 019_course_quarter.sql migration')
{
  const sql = read('supabase/migrations/019_course_quarter.sql')
  assertEqual(/alter table course\s+add column quarter text/i.test(sql), true, 'adds nullable quarter text column to course')
  assertEqual(/comment on column course\.quarter/i.test(sql), true, 'has a column comment')
  // NOT NULL, defaults, or CHECK constraints would be wrong (spec is nullable, no default, no constraint).
  assertEqual(/quarter\s+text\s+not null/i.test(sql), false, 'quarter is nullable (no NOT NULL)')
  assertEqual(/default\s+'/.test(sql), false, 'no DEFAULT value')
  assertEqual(/check\s*\(/i.test(sql), false, 'no CHECK constraint')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: 5 new fails (file doesn't exist).

- [ ] **Step 3: Create the migration**

Create `supabase/migrations/019_course_quarter.sql` with EXACTLY:

```sql
-- Per-course curriculum quarter, sourced from D2L's CourseOffering at
-- sync time. Derivation priority (in src/lib/d2l/mappers.ts):
--   1. Semester.Name (if matches "Season YYYY" exactly)
--   2. StartDate month → Season+Year
--   3. currentQuarter() at sync time (safety-net fallback)
--
-- Nullable so that any sync run before the backfill / before the column
-- exists in a deploy doesn't fail; sync writes the derived value every
-- run, so nulls are transient.
alter table course
  add column quarter text;

comment on column course.quarter is
  'Curriculum quarter in "Season YYYY" form. Sourced from D2L CourseOffering (Semester.Name preferred; StartDate-derived fallback). Sync writes once per course; assignment.quarter and student_work.quarter denormalize from here at insert time.';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: Tasks 2-8 = 35 passed, 0 failed.

- [ ] **Step 5: Commit**

The implementer does NOT apply this migration. tsc/build/structural-test do not require the column to exist (untyped queries).

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && git add supabase/migrations/019_course_quarter.sql scripts/test-sync-quarter.ts && git commit -m "feat(course-quarter): 019 migration — add course.quarter column"
```

---

## Task 9: Refactor sync-course.ts — thread `course.quarter` through 4 in-scope sites

**Files:**
- Modify: `src/lib/sync/sync-course.ts`
- Modify: `scripts/test-sync-quarter.ts`

This is the substantive sync change. Four `currentQuarter()` call sites in sync-course.ts become `course.quarter` (or a `courseQuarter` parameter); one (line 384's `cohort`) stays.

- [ ] **Step 1: Write the failing test**

Insert ABOVE the marker:

```ts
section('Task 9: sync-course.ts uses course.quarter (not currentQuarter()) in the 4 in-scope write paths')
{
  const s = stripComments(read('src/lib/sync/sync-course.ts'))
  // Regression: line 384's cohort: currentQuarter() preserved (OUT OF SCOPE).
  assertEqual(/cohort:\s*currentQuarter\(\)/.test(s), true, "line 384's cohort: currentQuarter() preserved")
  // In-scope: upsertCourse no longer has `const quarter = currentQuarter()`.
  assertEqual(/upsertCourse[\s\S]{0,400}const\s+quarter\s*=\s*currentQuarter\(\)/.test(s), false, 'upsertCourse no longer reads currentQuarter() locally')
  // upsertCourse uses course.quarter for the course insert.
  assertEqual(/upsertCourse[\s\S]{0,600}quarter:\s*course\.quarter/.test(s), true, 'upsertCourse writes course.quarter')
  // upsertAssignment takes a courseQuarter parameter.
  assertEqual(/async function upsertAssignment\([\s\S]{0,200}courseQuarter:\s*string/.test(s), true, 'upsertAssignment signature has courseQuarter: string')
  // upsertAssignment uses courseQuarter (not currentQuarter()) in its insert.
  assertEqual(/upsertAssignment[\s\S]{0,800}quarter:\s*courseQuarter/.test(s), true, 'upsertAssignment writes courseQuarter')
  // processSubmission's params include courseQuarter.
  assertEqual(/processSubmission\(params:\s*\{[\s\S]{0,400}courseQuarter:\s*string/.test(s), true, 'processSubmission params include courseQuarter: string')
  // processSubmission destructures courseQuarter and uses it.
  assertEqual(/const\s*\{[^}]*courseQuarter[^}]*\}\s*=\s*params/.test(s) || /params\.courseQuarter/.test(s), true, 'processSubmission destructures or reads params.courseQuarter')
  // The student_work insert + the autoTagWork object both use courseQuarter (not currentQuarter()).
  assertEqual(/quarter:\s*courseQuarter/.test(s), true, 'sync-course.ts writes courseQuarter for student_work')
  // Final regression: no more `quarter: currentQuarter()` (the cohort line uses cohort:, not quarter:).
  assertEqual(/quarter:\s*currentQuarter\(\)/.test(s), false, 'no remaining `quarter: currentQuarter()` writes')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: several new fails.

- [ ] **Step 3: Refactor `upsertCourse` (line 219+)**

Find:

```ts
async function upsertCourse(course: NormalizedCourse): Promise<string> {
  const admin = createAdminClient()
  const externalId = `d2l:${course.orgUnitId}`
  const quarter = currentQuarter()

  const { data: existing } = await admin
```

Replace with:

```ts
async function upsertCourse(course: NormalizedCourse): Promise<string> {
  const admin = createAdminClient()
  const externalId = `d2l:${course.orgUnitId}`

  const { data: existing } = await admin
```

(Removed the `const quarter = currentQuarter()` line. The insert below already uses the variable `quarter` — we need to update that too. Step 4 covers it.)

- [ ] **Step 4: Update the upsertCourse insert + update to use `course.quarter`**

Find:

```ts
  if (existing) {
    await admin
      .from('course')
      .update({
        name: course.name,
        code: course.code,
        active: course.active,
        synced_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    return existing.id as string
  }

  const { data: inserted, error } = await admin
    .from('course')
    .insert({
      external_id: externalId,
      brightspace_org_unit_id: course.orgUnitId,
      name: course.name,
      code: course.code,
      quarter,
      active: course.active,
    })
```

Replace with:

```ts
  if (existing) {
    await admin
      .from('course')
      .update({
        name: course.name,
        code: course.code,
        quarter: course.quarter,
        active: course.active,
        synced_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    return existing.id as string
  }

  const { data: inserted, error } = await admin
    .from('course')
    .insert({
      external_id: externalId,
      brightspace_org_unit_id: course.orgUnitId,
      name: course.name,
      code: course.code,
      quarter: course.quarter,
      active: course.active,
    })
```

(Two changes: added `quarter: course.quarter` to the UPDATE map (was missing entirely), and changed `quarter,` to `quarter: course.quarter,` in the INSERT.)

- [ ] **Step 5: Refactor `upsertAssignment` signature + body (line 442+)**

Find:

```ts
async function upsertAssignment(
  assignment: NormalizedAssignment,
  courseRowId: string,
  orgUnitId: string
): Promise<string> {
  const admin = createAdminClient()
  const externalId = `d2l:${orgUnitId}:${assignment.folderId}`
  const quarter = currentQuarter()

  const { data: existing } = await admin
```

Replace with:

```ts
async function upsertAssignment(
  assignment: NormalizedAssignment,
  courseRowId: string,
  orgUnitId: string,
  courseQuarter: string
): Promise<string> {
  const admin = createAdminClient()
  const externalId = `d2l:${orgUnitId}:${assignment.folderId}`

  const { data: existing } = await admin
```

(Added `courseQuarter: string` parameter; removed the `const quarter = currentQuarter()` line.)

Then find the insert:

```ts
      title: assignment.name,
      description: assignment.description,
      due_date: assignment.dueDate,
      work_type: inferWorkType(assignment.name),
      quarter,
      active: assignment.active,
```

Replace with:

```ts
      title: assignment.name,
      description: assignment.description,
      due_date: assignment.dueDate,
      work_type: inferWorkType(assignment.name),
      quarter: courseQuarter,
      active: assignment.active,
```

- [ ] **Step 6: Refactor `processSubmission` params + body (line 506+)**

Find the params interface (line 506):

```ts
async function processSubmission(params: {
  submission: NormalizedSubmission
  assignment: NormalizedAssignment
  assignmentRowId: string
  courseRowId: string
  courseName: string
  courseCode: string | null
  mode: SyncRunMode
}): Promise<ProcessSubmissionResult> {
  const { submission, assignment, assignmentRowId, courseName, courseCode } = params
```

Replace with:

```ts
async function processSubmission(params: {
  submission: NormalizedSubmission
  assignment: NormalizedAssignment
  assignmentRowId: string
  courseRowId: string
  courseName: string
  courseCode: string | null
  courseQuarter: string
  mode: SyncRunMode
}): Promise<ProcessSubmissionResult> {
  const { submission, assignment, assignmentRowId, courseName, courseCode, courseQuarter } = params
```

Find the student_work insert (line ~624):

```ts
      submitted_at: submission.submittedAt || new Date().toISOString(),
      quarter: currentQuarter(),
      week_number: weekNumber,
```

Replace with:

```ts
      submitted_at: submission.submittedAt || new Date().toISOString(),
      quarter: courseQuarter,
      week_number: weekNumber,
```

Find the autoTagWork StudentWork object (line ~656):

```ts
      submittedAt: submission.submittedAt || new Date().toISOString(),
      quarter: currentQuarter(),
      attemptNumber: submission.attempt,
```

Replace with:

```ts
      submittedAt: submission.submittedAt || new Date().toISOString(),
      quarter: courseQuarter,
      attemptNumber: submission.attempt,
```

- [ ] **Step 7: Update the syncSingleCourse callers**

`syncSingleCourse` (around line 50-200) calls `upsertCourse(course)`, then later `upsertAssignment(assignment, courseRowId, course.orgUnitId)`, then `processSubmission({ ... })`. Read the file to find the exact call sites.

The upsertAssignment call (find with grep `upsertAssignment(assignment`):

```ts
        const assignmentRowId = await upsertAssignment(assignment, courseRowId, course.orgUnitId)
```

Replace with:

```ts
        const assignmentRowId = await upsertAssignment(assignment, courseRowId, course.orgUnitId, course.quarter)
```

The processSubmission call (find with grep `processSubmission({`):

```ts
            const result = await processSubmission({
              submission,
              assignment,
              assignmentRowId,
              courseRowId,
              courseName: course.name,
              courseCode: course.code,
              mode,
            })
```

Replace with:

```ts
            const result = await processSubmission({
              submission,
              assignment,
              assignmentRowId,
              courseRowId,
              courseName: course.name,
              courseCode: course.code,
              courseQuarter: course.quarter,
              mode,
            })
```

(Exact text and surrounding context may differ slightly — read the file first, then anchor on the unique surrounding lines.)

- [ ] **Step 8: Run test to verify it passes**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: Tasks 2-9 = 44 passed, 0 failed.

- [ ] **Step 9: tsc + eslint + ALL sync regressions**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx eslint --no-eslintrc --config .eslintrc.json src/lib/sync/sync-course.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-course.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-engine.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-dup-d2l-id.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-inspect.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-race.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-run.ts
```
Expected: tsc 0; eslint 0; sync-course 5/0; sync-engine 27/0; sync-dup-d2l-id 5/0; sync-inspect 12/0; sync-race 6/0; sync-run 8/0.

- [ ] **Step 10: Commit**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && git add src/lib/sync/sync-course.ts scripts/test-sync-quarter.ts && git commit -m "feat(sync): thread course.quarter through upsertCourse/upsertAssignment/processSubmission

The 4 in-scope currentQuarter() call sites in sync-course.ts now use
the per-course quarter from NormalizedCourse (which is derived from
D2L CourseOffering's Semester.Name / StartDate via deriveQuarter).
Line 384's cohort: currentQuarter() (student-cohort label) stays
unchanged per spec — OUT OF SCOPE."
```

---

## Task 10: Backfill script `scripts/backfill-course-quarter.ts`

**Files:**
- Create: `scripts/backfill-course-quarter.ts`
- Modify: `scripts/test-sync-quarter.ts`

The backfill is owner-runnable only. Mirrors the `scripts/issue-passlink.ts` tsx CLI pattern — relative imports + own admin client + NO `@/` aliases.

- [ ] **Step 1: Write the failing test**

Insert ABOVE the marker:

```ts
section('Task 10: backfill-course-quarter.ts script')
{
  const s = stripComments(read('scripts/backfill-course-quarter.ts'))
  // tsx CLI bootstrap pattern (mirror issue-passlink.ts).
  assertEqual(/import\s*\{\s*config\s+as\s+dotenvConfig\s*\}\s*from\s*['"]dotenv['"]/.test(s), true, 'loads .env.local via dotenv before other imports')
  assertEqual(/dotenvConfig\(\s*\{\s*path:\s*['"]\.env\.local['"]\s*\}\s*\)/.test(s), true, "calls dotenvConfig({ path: '.env.local' })")
  assertEqual(/import\s*\{\s*createClient\s*\}\s*from\s*['"]@supabase\/supabase-js['"]/.test(s), true, 'imports createClient directly (own admin client)')
  // No @/ aliases (tsx CLI convention).
  assertEqual(/from\s+['"]@\//.test(s), false, 'no @/ aliases (tsx CLI rule)')
  // Reads service-role env vars.
  assertEqual(/SUPABASE_SERVICE_ROLE_KEY/.test(s) && /NEXT_PUBLIC_SUPABASE_URL/.test(s), true, 'reads service-role env vars')
  // Imports getCourse + deriveQuarter via relative paths.
  assertEqual(/from\s*['"]\.\.\/src\/lib\/d2l\/courses['"]|from\s*['"]\.\.\/src\/lib\/d2l\/courses\.js['"]/.test(s), true, 'imports getCourse via relative path')
  assertEqual(/from\s*['"]\.\.\/src\/lib\/d2l\/mappers['"]|from\s*['"]\.\.\/src\/lib\/d2l\/mappers\.js['"]/.test(s), true, 'imports deriveQuarter or normalizeCourseOffering via relative path')
  // Three updates: course, assignment, student_work.
  assertEqual(/from\(['"]course['"]\)[\s\S]{0,200}\.update/.test(s), true, 'updates course.quarter')
  assertEqual(/from\(['"]assignment['"]\)[\s\S]{0,200}\.update/.test(s), true, 'updates assignment.quarter')
  assertEqual(/from\(['"]student_work['"]\)[\s\S]{0,300}\.update/.test(s), true, 'updates student_work.quarter')
  // Idempotency: skip when stored == derived.
  assertEqual(/skip|already|unchanged|no.?op/i.test(s), true, 'has idempotency skip path')
  // Per-course error handling: continues on D2L failure for a single course.
  assertEqual(/try\s*\{[\s\S]{0,2000}catch\s*\(/.test(s), true, 'per-course try/catch')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: 11 new fails.

- [ ] **Step 3: Create the backfill script**

Create `scripts/backfill-course-quarter.ts` with EXACTLY:

```ts
/**
 * Owner-runnable backfill: refetch every course from D2L, derive the
 * canonical quarter via the new mapper, and UPDATE course.quarter +
 * assignment.quarter + student_work.quarter for that course.
 *
 * Idempotent: skips any course whose stored quarter already matches the
 * derived value (no UPDATE, just a log line).
 *
 * Per-course error handling: a D2L fetch failure for one course logs
 * the error and proceeds to the next course; does not abort the whole
 * backfill. Final exit code is 1 if any course errored (so an
 * automation can detect partial failures); 0 otherwise.
 *
 * Requires env (.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, plus the D2L Valence env the existing
 * sync code reads (D2L_VALENCE_INSTANCE_URL / CLIENT_ID / etc.).
 *
 * Run: npx tsx scripts/backfill-course-quarter.ts
 */

// Load .env.local BEFORE importing any module that reads env at import time.
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { getCourse } from '../src/lib/d2l/courses'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

interface CourseRow {
  id: string
  name: string
  brightspace_org_unit_id: string | null
  quarter: string | null
}

async function main(): Promise<void> {
  const { data: courses, error: loadErr } = await supabase
    .from('course')
    .select('id, name, brightspace_org_unit_id, quarter')
    .not('brightspace_org_unit_id', 'is', null)
    .order('name')

  if (loadErr || !courses) {
    console.error('Failed to load courses:', loadErr?.message)
    process.exit(1)
  }

  const rows = courses as CourseRow[]
  console.log(`Backfilling ${rows.length} courses…\n`)

  let updated = 0
  let skipped = 0
  let errored = 0

  for (const row of rows) {
    const orgUnitId = row.brightspace_org_unit_id!
    try {
      const enriched = await getCourse(orgUnitId)
      const derived = enriched.quarter

      if (row.quarter === derived) {
        console.log(`  ✓ ${row.name}: already "${derived}" (skip)`)
        skipped++
        continue
      }

      // Update course.quarter.
      const { error: courseErr } = await supabase
        .from('course')
        .update({ quarter: derived })
        .eq('id', row.id)
      if (courseErr) throw new Error(`course update failed: ${courseErr.message}`)

      // Update assignment.quarter for all assignments under this course.
      const { error: asgnErr, count: asgnCount } = await supabase
        .from('assignment')
        .update({ quarter: derived }, { count: 'exact' })
        .eq('course_id', row.id)
      if (asgnErr) throw new Error(`assignment update failed: ${asgnErr.message}`)

      // Update student_work.quarter for all student_work rows under those
      // assignments. Two-step because PostgREST doesn't support nested
      // UPDATE…WHERE…IN(SELECT) directly: fetch assignment IDs first.
      const { data: asgnIds, error: asgnIdsErr } = await supabase
        .from('assignment')
        .select('id')
        .eq('course_id', row.id)
      if (asgnIdsErr) throw new Error(`assignment id fetch failed: ${asgnIdsErr.message}`)
      const ids = (asgnIds || []).map(a => a.id as string)

      let workCount = 0
      if (ids.length > 0) {
        const { error: workErr, count: wc } = await supabase
          .from('student_work')
          .update({ quarter: derived }, { count: 'exact' })
          .in('assignment_id', ids)
        if (workErr) throw new Error(`student_work update failed: ${workErr.message}`)
        workCount = wc ?? 0
      }

      console.log(`  → ${row.name}: "${row.quarter ?? '(null)'}" → "${derived}" (assignments: ${asgnCount ?? 0}, student_work: ${workCount})`)
      updated++
    } catch (err) {
      console.error(`  ✗ ${row.name}: ${String(err)}`)
      errored++
    }
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped} errored=${errored}`)
  process.exit(errored > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: Tasks 2-10 = 55 passed, 0 failed.

- [ ] **Step 5: tsc + eslint**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx eslint --no-eslintrc --config .eslintrc.json scripts/backfill-course-quarter.ts
```

- [ ] **Step 6: Do NOT run the backfill**

The implementer must NOT run `npx tsx scripts/backfill-course-quarter.ts`. It writes to production. Owner runs it as a runbook step.

- [ ] **Step 7: Commit**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && git add scripts/backfill-course-quarter.ts scripts/test-sync-quarter.ts && git commit -m "feat(course-quarter): owner-runnable backfill script"
```

---

## Task 11: Whole-feature verification + owner runbook

**Files:**
- No code changes.

- [ ] **Step 1: Full structural test**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-quarter.ts
```
Expected: **55 passed, 0 failed.**

- [ ] **Step 2: All sync regressions**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-course.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-engine.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-dup-d2l-id.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-inspect.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-race.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-sync-run.ts
```
Expected: 5/0, 27/0, 5/0, 12/0, 6/0, 8/0 — total **63 passed, 0 failed**.

- [ ] **Step 3: All staff/student/reflect regressions**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-staff-passlink.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-student-passlinks.ts
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: 35/0, 56/0, 125/0.

- [ ] **Step 4: tsc + eslint over all touched files**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npx eslint --no-eslintrc --config .eslintrc.json \
  scripts/test-sync-quarter.ts \
  scripts/backfill-course-quarter.ts \
  src/lib/sync/quarter.ts \
  src/lib/sync/sync-course.ts \
  src/lib/d2l/types.ts \
  src/lib/d2l/courses.ts \
  src/lib/d2l/mappers.ts
```
Expected: tsc 0; eslint 0, no warnings.

- [ ] **Step 5: `npm run build`**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && npm run build >/tmp/cq-build.log 2>&1; echo "build exit: $?"; grep -c "Compiled successfully" /tmp/cq-build.log; grep -iE "error|failed|Type error" /tmp/cq-build.log | head -5 || echo "no error lines"
```
Expected: exit 0; "Compiled successfully"; no error lines.

- [ ] **Step 6: Scope summary**

```bash
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && git log --oneline origin/main..HEAD
cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/course-quarter && git diff origin/main HEAD --stat
```
Expected: 10 commits (Tasks 1-10, one each); file change stat matches the File Structure section: 5 new files + 4 modified files.

- [ ] **Step 7: NO commit needed**

Verification-only. Branch is at final state.

## Owner runbook (post-merge)

**This PR is code-only; two owner-applied steps are needed to make it fully effective on production:**

1. **Apply migration 019:** via the Supabase migration workflow, apply `supabase/migrations/019_course_quarter.sql`. Reversible at any time via `alter table course drop column quarter`.

2. **Run the backfill:** from the project root with `.env.local` populated (D2L Valence creds + Supabase service-role key):
   ```bash
   npx tsx scripts/backfill-course-quarter.ts
   ```
   The script processes the 47 courses, logs per-course old→new transitions (and any per-course errors), and exits 0 on full success / 1 if any course errored. Re-running is safe (idempotent skip when stored equals derived).

3. **Manual smoke-test (recommended):** after the backfill, query production for the per-course quarter distribution:
   ```sql
   select quarter, count(*) from course group by quarter order by quarter;
   select quarter, count(*) from assignment group by quarter order by quarter;
   select quarter, count(*) from student_work group by quarter order by quarter limit 20;
   ```
   Expect a richer distribution (Fall 2025 / Winter 2026 / Spring 2026 / etc.) if NLU's D2L instance has varied terms; if everything is still one quarter, that may genuinely reflect a single-term pilot scope — investigate further if it looks suspicious.

4. **Without these two steps, merging the code alone only fixes future-synced rows.** Existing rows stay tagged with their previous (`currentQuarter()`-at-sync-time) values until the next full sync re-touches them.

## Status

`STATUS: DONE` if every gate above is green (test = 55/55; sync regressions 63/0; other regressions 35/0 + 56/0 + 125/0; tsc = 0; eslint = 0; build = 0). Include the exact pass counts, commit count, and file-change stat summary. If ANY gate fails, report `STATUS: BLOCKED` with the exact failure.

---

## Self-Review

**Spec coverage spot-check:**
- Architecture / data flow (spec §"Architecture") → Tasks 2, 5, 6, 7, 8, 9 cover the D2L → mapper → sync → DB chain.
- D2L mapping: raw type (spec §"D2L mapping") → Task 3. NormalizedCourse extension → Task 4. deriveQuarter + normalizeCourseOffering → Task 5. getCourse refactor → Task 6. listCoursesUnderOrgUnit enrichment → Task 7. currentQuarter() extraction → Task 2.
- Schema (spec §"Schema") → Task 8.
- Sync changes (spec §"Sync changes") → Task 9 (4 in-scope sites + cohort-preserve assertion).
- Backfill (spec §"Backfill") → Task 10.
- Testing (spec §"Testing") → all tasks build up `scripts/test-sync-quarter.ts`; Task 11 runs all the regression suites including the 6 sync tests.
- Reversibility (spec §"Reversibility") → covered in pre-flight + Task 8's commit notes.
- Open questions (spec §"Open questions deferred to plan stage") → spec defaults are baked into the tasks (`listCoursesUnderOrgUnit` enriches internally per Task 7; no extra columns persisted per Task 8; strict canonical regex per Task 5).

**Placeholder scan:** no TBD/TODO/incomplete/"similar to" patterns. Every step has verbatim code where code is needed.

**Type consistency:** `courseQuarter: string` parameter name used consistently across upsertAssignment and processSubmission (Tasks 9). `D2LCourseOffering` (Tasks 3, 5, 6). `NormalizedCourse.quarter` / `.startDate` / `.semesterName` (Tasks 4, 5). `deriveQuarter` / `normalizeCourseOffering` (Tasks 5, 6, 10). `currentQuarter()` (Tasks 2, 5).

**Deferred-gate cascade (intentional):** Tasks 4–6 commit with the full-project `npx tsc --noEmit` gate DEFERRED to Task 7. Making `NormalizedCourse.quarter` (and friends) required in Task 4 opens a type cascade that Tasks 6 + 7 progressively close. Each of Tasks 4, 5, 6 runs only `eslint` + a file-scoped `npx tsc --noEmit <file>` at its gate; Task 7 Step 5 is the authoritative full-project tsc + all 6 sync regressions. This is documented at each task; the implementer should NOT try to fix the cascade errors at intermediate tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-course-quarter-integration.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
