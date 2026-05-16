# LE3 Sync Fan-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the non-convergent single-process LE3 sync with a parent orchestrator that fans out one Trigger.dev child task per course offering, bounded by a queue.

**Architecture:** Decompose `runLe3Sync` into composable units — `syncOneCourse()` (per-course pipeline), `sync-run` helpers (row lifecycle + enumeration + result aggregation). A child task `sync-course` runs one course with bounded queue concurrency; the parent task `sync-le3` enumerates courses, fans out via `batchTriggerAndWait`, aggregates, and finalizes the single `sync_run` row. Per-course detail goes to parent run metadata.

**Tech Stack:** TypeScript, Next.js 14, Trigger.dev v4 (`@trigger.dev/sdk`), Supabase (`@supabase/supabase-js`), tsx test scripts + `mock-valence.ts` fetch dispatcher (established convention — NOT vitest/jest).

**Spec:** `docs/superpowers/specs/2026-05-15-le3-sync-fanout-design.md`

---

## File Structure

**New:**
- `src/lib/sync/sync-course.ts` — `syncOneCourse()` + the per-course private helpers (`upsertCourse`, `upsertInstructor`, `upsertStudent`, `upsertStudentCourse`, `upsertAssignment`, `processSubmission`, `recordError`, `currentQuarter`, `flagStaleStudentFromInstructor`) moved from `sync-engine.ts`. Exports `CourseSyncResult`, `SyncOneCourseParams`. One responsibility: sync exactly one course.
- `src/lib/sync/sync-run.ts` — `createSyncRun()`, `finalizeSyncRun()`, `enumerateCourses()`, `pickDefaultCoachId()` (moved from engine), `aggregateCourseResults()`. Owns `sync_run` row lifecycle + parent-side orchestration helpers. Re-exports the shared `SyncCounts`/`SyncError` types.
- `src/trigger/sync-course.ts` — child Trigger.dev task `sync-course` (queue concurrency, retry, metadata).
- `scripts/test-sync-course.ts` — tsx harness: mock-valence, exercises `syncOneCourse` + dedup/resume.
- `scripts/test-sync-race.ts` — tsx harness: concurrent `syncOneCourse` on the two courses sharing student 5001 → asserts no duplicate, no unhandled `23505`.
- `scripts/test-sync-run.ts` — tsx harness: pure-function tests for `aggregateCourseResults` + partial-success finalize semantics.

**Modified:**
- `src/lib/sync/sync-engine.ts` — `runLe3Sync` and its loop deleted; file becomes a thin barrel re-exporting the moved types/functions for back-compat of any stray importers. Keeps the public type exports (`SyncOptions`, `SyncCounts`, `SyncError`, etc.).
- `src/trigger/sync-le3.ts` — parent rewritten: enumerate → fan out `sync-course` children via `batchTriggerAndWait` → aggregate → finalize.
- `src/app/api/admin/sync-le3/route.ts` — inline fallback + `runLe3Sync` dynamic import removed; always enqueues the parent.
- `scripts/test-sync-engine.ts` — retargeted: instead of two `runLe3Sync` runs, drive the new composition (`enumerateCourses` → `syncOneCourse` per course → `aggregateCourseResults` → `finalizeSyncRun`) so the end-to-end regression harness survives.

**Deleted:** none (files are refactored, not removed).

---

## Conventions (read before starting)

- **Test harness pattern:** copy the scaffolding of `scripts/test-sync-engine.ts` verbatim for new scripts: same imports (`installMockValence, uninstallMockValence, MOCK_STATS, getMockRequestLog` from `@/lib/d2l/__mocks__/mock-valence`; `clearValenceTokenCache` from `@/lib/d2l/auth`; `createAdminClient` from `@/lib/supabase-admin`), same `assertEqual`/`assertGte`/`section` helpers, same `passed`/`failed` counters, same `cleanupMockData(admin)` before+after, `installMockValence()`+`clearValenceTokenCache()` before runs, `uninstallMockValence()` in `finally`, `process.exit(failed > 0 ? 1 : 0)` at the end. Read `scripts/test-sync-engine.ts` lines 1–74 for the exact env/dotenv bootstrap and `cleanupMockData` implementation and reuse them.
- **Run a test script:** `npx tsx scripts/<name>.ts` (tsx is in devDependencies).
- **Typecheck:** `npx tsc --noEmit` (expect `exit 0`).
- **Lint:** `npx next lint --file <path>` (expect `✔ No ESLint warnings or errors`).
- **Mock fixture facts** (`src/lib/d2l/__mocks__/mock-valence.ts`): LE3 OU `1001`; courses `2001` (HUM, instructor 9001) + `2002` (SOC, instructor 9002); students `5001`(both),`5002`(2001),`5003`(2002),`5004`(both); `MOCK_STATS` has `courseCount/instructorCount/studentCount/assignmentCount/submissionCount`. Student `5001` (Aja) and `5004` (Jordan) are enrolled in BOTH courses — the cross-course fixtures for the race test.
- **Commit cadence:** one commit per task, message ending with the standard `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- Do NOT introduce vitest/jest. Do NOT change Valence auth/permission code. Do NOT dial the machine preset back.

---

## Task 1: Extract `syncOneCourse` + per-course helpers into `sync-course.ts`

Pure structural move — no behavior change yet. This isolates the per-course pipeline so it can be unit-tested and run from a child task.

**Files:**
- Create: `src/lib/sync/sync-course.ts`
- Modify: `src/lib/sync/sync-engine.ts` (remove moved code; re-export)
- Test: `scripts/test-sync-course.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-sync-course.ts`. Copy the env/dotenv bootstrap + `cleanupMockData` + assertion helpers from `scripts/test-sync-engine.ts` (lines 1–135) verbatim, then:

```ts
import { syncOneCourse } from '@/lib/sync/sync-course'
import { enumerateCourses } from '@/lib/sync/sync-run'   // added in Task 5; for Task 1 use listCoursesUnderOrgUnit directly
import { listCoursesUnderOrgUnit } from '@/lib/d2l'

async function main(): Promise<void> {
  const admin = createAdminClient()
  await cleanupMockData(admin)
  installMockValence()
  clearValenceTokenCache()
  try {
    section('syncOneCourse — single course (2001)')
    const courses = await listCoursesUnderOrgUnit(MOCK_STATS.le3OrgUnitId)
    const hum = courses.find(c => c.orgUnitId === '2001')!
    const res = await syncOneCourse({
      syncRunId: 'test-run',
      course: hum,
      mode: 'full',
      defaultCoachId: await ensureMockCoach(admin), // copy ensureMockCoach from test-sync-engine.ts
    })
    assertEqual(res.courseOuId, '2001', 'result.courseOuId is 2001')
    assertGte(res.counts.submissionsSynced, 1, 'HUM submissions synced >= 1')
    assertEqual(res.counts.errorsCount, 0, 'no errors for HUM')

    section('syncOneCourse — resume (re-run 2001 dedupes)')
    const res2 = await syncOneCourse({
      syncRunId: 'test-run-2', course: hum, mode: 'incremental',
      defaultCoachId: await ensureMockCoach(admin),
    })
    assertEqual(res2.counts.submissionsSynced, 0, 're-run inserts 0 new submissions')
    assertGte(res2.counts.submissionsSkipped, 1, 're-run skips >= 1 (dedup before download)')
  } finally {
    await cleanupMockData(admin)
    uninstallMockValence()
  }
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
main()
```

(`ensureMockCoach` — copy the helper that seeds a coach row from `scripts/test-sync-engine.ts`; if it is inline there, lift it into the new script verbatim.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-sync-course.ts`
Expected: FAIL — `Cannot find module '@/lib/sync/sync-course'` (module not created yet).

- [ ] **Step 3: Create `src/lib/sync/sync-course.ts` by moving code**

Move the following from `src/lib/sync/sync-engine.ts` into the new file **verbatim** (no logic change in this task):
- The private helpers `upsertCourse`, `upsertInstructor`, `upsertStudent`, `upsertStudentCourse`, `upsertAssignment`, `processSubmission`, and any private helpers they call (`recordError`, `currentQuarter`, `flagStaleStudentFromInstructor`, `ProcessSubmissionResult` interface).
- The body of the `for (let i = 0; i < courses.length; i++)` loop (sync-engine.ts ~lines 153–329) becomes the body of `syncOneCourse`, operating on a single `course` instead of `courses[i]` and removing the `onProgress` stage callbacks (the child task reports progress via metadata instead — added in Task 8).

New file header + signature (exact):

```ts
/**
 * Per-course LE3 sync pipeline. Syncs exactly one course offering:
 * classlist → instructors → students → enrollments → assignments →
 * submissions → download → extract → student_work. Idempotent and
 * race-safe (see upsertStudent/upsertInstructor 23505 handling).
 *
 * Extracted from the former monolithic runLe3Sync loop so it can run
 * as an isolated Trigger.dev child task with bounded memory.
 */
import { createAdminClient } from '@/lib/supabase-admin'
import {
  listCourseEnrollments,
  listCourseAssignments,
  listAssignmentSubmissions,
  downloadSubmissionFile,
  inferWorkType,
  type NormalizedCourse,
  type NormalizedEnrollment,
  type NormalizedAssignment,
  type NormalizedSubmission,
} from '@/lib/d2l'
import { extractText, isSupported } from '@/lib/extract-text'
import { autoTagWork } from '@/lib/conversation-engine-live'
import type { WorkType, StudentWork } from '@/lib/types'
import type { SyncCounts, SyncError } from '@/lib/sync/sync-engine'

export interface SyncOneCourseParams {
  syncRunId: string
  course: NormalizedCourse
  mode: 'full' | 'incremental'
  defaultCoachId: string | null
}

export interface CourseSyncResult {
  courseOuId: string
  courseName: string
  counts: SyncCounts
  errors: SyncError[]
}

export async function syncOneCourse(
  params: SyncOneCourseParams
): Promise<CourseSyncResult> {
  const { course, mode, defaultCoachId } = params
  const counts: SyncCounts = {
    coursesSynced: 0,
    studentsSynced: 0,
    assignmentsSynced: 0,
    submissionsSynced: 0,
    submissionsSkipped: 0,
    errorsCount: 0,
  }
  const errors: SyncError[] = []
  const studentIdsTouched = new Set<string>()

  try {
    // <<< paste the exact loop-body from sync-engine.ts lines ~160–329,
    //     with these mechanical substitutions:
    //       courses[i]            -> course
    //       course.name / .orgUnitId etc. stay as-is
    //       remove every `await options.onProgress?.({...})` call
    //       `defaultCoachId` now comes from params (do NOT call
    //         pickDefaultCoachId here — parent supplies it)
    //       counts.coursesSynced++ stays (1 per course)
    // >>>
  } catch (err) {
    recordError(errors, 'course_process', `course=${course.name}`, err)
    counts.errorsCount++
  }

  return {
    courseOuId: course.orgUnitId,
    courseName: course.name,
    counts,
    errors,
  }
}

// <<< paste moved private helpers below: upsertCourse, upsertInstructor,
//     upsertStudent, upsertStudentCourse, upsertAssignment,
//     processSubmission, recordError, currentQuarter,
//     flagStaleStudentFromInstructor, ProcessSubmissionResult >>>
```

In `src/lib/sync/sync-engine.ts`: delete the moved helpers and the loop body. Keep the `Sync*` type exports. At the bottom add re-exports so existing importers don't break:

```ts
export { syncOneCourse } from '@/lib/sync/sync-course'
export type { CourseSyncResult, SyncOneCourseParams } from '@/lib/sync/sync-course'
```

(Leave `runLe3Sync` in place for now — Task 7 rewires its callers, Task 9 removes it. Temporarily, have `runLe3Sync`'s loop call `syncOneCourse(course, ...)` and merge results so the existing `scripts/test-sync-engine.ts` keeps passing through the transition.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-sync-course.ts`
Expected: PASS — all assertions ✓, `process.exit(0)`.

- [ ] **Step 5: Regression — existing harness still green**

Run: `npx tsx scripts/test-sync-engine.ts`
Expected: PASS (runLe3Sync now delegates to syncOneCourse but behavior is unchanged).

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx next lint --file src/lib/sync/sync-course.ts --file src/lib/sync/sync-engine.ts` → no warnings

- [ ] **Step 7: Commit**

```bash
git add src/lib/sync/sync-course.ts src/lib/sync/sync-engine.ts scripts/test-sync-course.ts
git commit -m "$(cat <<'EOF'
sync: extract syncOneCourse + per-course helpers into sync-course.ts

Pure structural move — runLe3Sync still delegates to it, behavior
unchanged (test-sync-engine.ts green). Isolates the per-course
pipeline for fan-out + unit testing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Race-harden `upsertStudent`

Under fan-out, two children processing a shared student (5001/5004 are in both mock courses) race on `student_email_key`/`student_nlu_id_key`. Convert check-then-insert to insert-then-catch-`23505`-and-refetch.

**Files:**
- Modify: `src/lib/sync/sync-course.ts` (the moved `upsertStudent`)
- Test: `scripts/test-sync-race.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-sync-race.ts` (copy harness scaffolding from `test-sync-engine.ts` as in Task 1), body:

```ts
import { syncOneCourse } from '@/lib/sync/sync-course'
import { listCoursesUnderOrgUnit } from '@/lib/d2l'

async function main(): Promise<void> {
  const admin = createAdminClient()
  await cleanupMockData(admin)
  installMockValence()
  clearValenceTokenCache()
  try {
    section('Concurrent syncOneCourse on both courses (shared students 5001,5004)')
    const courses = await listCoursesUnderOrgUnit(MOCK_STATS.le3OrgUnitId)
    const c1 = courses.find(c => c.orgUnitId === '2001')!
    const c2 = courses.find(c => c.orgUnitId === '2002')!
    const coachId = await ensureMockCoach(admin)

    // Run both courses CONCURRENTLY — this is the fan-out race.
    const [r1, r2] = await Promise.all([
      syncOneCourse({ syncRunId: 't', course: c1, mode: 'full', defaultCoachId: coachId }),
      syncOneCourse({ syncRunId: 't', course: c2, mode: 'full', defaultCoachId: coachId }),
    ])

    assertEqual(r1.counts.errorsCount, 0, 'course 2001 no errors under concurrency')
    assertEqual(r2.counts.errorsCount, 0, 'course 2002 no errors under concurrency')

    // Aja (5001) is in BOTH courses → exactly one student row, not two.
    const { data: aja } = await admin
      .from('student').select('id')
      .eq('d2l_user_id', '5001')
    assertEqual(aja?.length ?? 0, 1, 'shared student 5001 has exactly one row (no dup, no 23505 throw)')
    const { data: jordan } = await admin
      .from('student').select('id').eq('d2l_user_id', '5004')
    assertEqual(jordan?.length ?? 0, 1, 'shared student 5004 has exactly one row')
  } finally {
    await cleanupMockData(admin)
    uninstallMockValence()
  }
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-sync-race.ts`
Expected: FAIL — either a duplicate row assertion failure or an unhandled `23505` surfacing as `errorsCount > 0`, because the current `upsertStudent` does `select … maybeSingle()` then `insert` (racy).

- [ ] **Step 3: Harden `upsertStudent`**

In `src/lib/sync/sync-course.ts`, replace the insert block of `upsertStudent` (the `const { data: inserted, error } = await admin.from('student').insert({...}).select('id').single()` and its error handling) with insert-then-recover:

```ts
const { data: inserted, error } = await admin
  .from('student')
  .insert({
    nlu_id: nluId,
    d2l_user_id: student.userId,
    first_name: student.firstName || 'Student',
    last_name: student.lastName || '',
    email,
    coach_id: defaultCoachId,
    cohort: currentQuarter(),
    program_start_date: new Date().toISOString().split('T')[0],
    status: 'active',
  })
  .select('id')
  .single()

if (inserted) return inserted.id as string

// 23505 = unique_violation. A concurrent child created this student
// (shared across courses) between our existence check and insert.
// Re-fetch the now-existing row by the same keys and use it. This is
// the same recovery pattern processSubmission uses for student_work.
if (error?.code === '23505') {
  const { data: raced } = await admin
    .from('student')
    .select('id')
    .or(
      `email.eq.${email},` +
      `nlu_id.eq.${nluId},` +
      `d2l_user_id.eq.${student.userId}`
    )
    .maybeSingle()
  if (raced) return raced.id as string
}

throw new Error(`Failed to insert student ${email}: ${error?.message}`)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-sync-race.ts`
Expected: PASS — exactly one row for 5001 and 5004, zero errors.

- [ ] **Step 5: Regression**

Run: `npx tsx scripts/test-sync-course.ts` → PASS
Run: `npx tsx scripts/test-sync-engine.ts` → PASS

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx next lint --file src/lib/sync/sync-course.ts` → no warnings

- [ ] **Step 7: Commit**

```bash
git add src/lib/sync/sync-course.ts scripts/test-sync-race.ts
git commit -m "$(cat <<'EOF'
sync: race-harden upsertStudent (insert-then-catch-23505-refetch)

Fan-out processes shared students concurrently; check-then-insert
collided on student_email_key. Recover by re-fetching the raced row,
matching processSubmission's existing 23505 pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Race-harden `upsertInstructor`

Same hazard for instructors shared across courses. (Mock instructors are 1-per-course so the race test won't catch a regression here, but the production tree has shared instructors; harden defensively with the identical pattern.)

**Files:**
- Modify: `src/lib/sync/sync-course.ts` (the moved `upsertInstructor`)

- [ ] **Step 1: Inspect current `upsertInstructor`**

Read `src/lib/sync/sync-course.ts` `upsertInstructor`. Identify its `insert(...).select('id').single()` call and its unique key(s) (instructor table — verify constraint with: `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='instructor'::regclass AND contype IN ('u','p');` via the Supabase SQL tool; expect a unique on `email`).

- [ ] **Step 2: Apply the same 23505 recovery**

Replace the insert+error block with the insert-then-recover shape from Task 2 Step 3, adapted to the instructor's unique key (`email`):

```ts
const { data: inserted, error } = await admin
  .from('instructor').insert({ /* existing fields, unchanged */ })
  .select('id').single()
if (inserted) return inserted.id as string
if (error?.code === '23505') {
  const { data: raced } = await admin
    .from('instructor').select('id').eq('email', email).maybeSingle()
  if (raced) return raced.id as string
}
throw new Error(`Failed to insert instructor ${email}: ${error?.message}`)
```

- [ ] **Step 3: Regression**

Run: `npx tsx scripts/test-sync-race.ts` → PASS
Run: `npx tsx scripts/test-sync-engine.ts` → PASS

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx next lint --file src/lib/sync/sync-course.ts` → no warnings

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/sync-course.ts
git commit -m "$(cat <<'EOF'
sync: race-harden upsertInstructor (23505 recover, mirrors student)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `sync-run.ts` — row lifecycle, enumeration, coach pick, aggregation

Move parent-side concerns out of the engine into a focused module.

**Files:**
- Create: `src/lib/sync/sync-run.ts`
- Modify: `src/lib/sync/sync-engine.ts` (move `pickDefaultCoachId`; re-export)
- Test: `scripts/test-sync-run.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-sync-run.ts` (harness scaffolding as before; this one needs no mock-valence — pure functions + a sync_run row):

```ts
import {
  createSyncRun, finalizeSyncRun, aggregateCourseResults,
} from '@/lib/sync/sync-run'
import type { CourseSyncResult } from '@/lib/sync/sync-course'

function fakeResult(ou: string, over: Partial<CourseSyncResult['counts']>, errs = 0): CourseSyncResult {
  return {
    courseOuId: ou, courseName: `c${ou}`,
    counts: { coursesSynced: 1, studentsSynced: 0, assignmentsSynced: 0,
      submissionsSynced: 0, submissionsSkipped: 0, errorsCount: errs, ...over },
    errors: errs ? [{ stage: 'submission_extract', context: ou, message: 'boom' }] : [],
  }
}

async function main(): Promise<void> {
  const admin = createAdminClient()
  section('aggregateCourseResults sums counts + collects errors')
  const agg = aggregateCourseResults([
    fakeResult('A', { studentsSynced: 3, submissionsSynced: 5 }),
    fakeResult('B', { studentsSynced: 2, submissionsSynced: 4 }, 1),
  ])
  assertEqual(agg.counts.coursesSynced, 2, 'coursesSynced summed')
  assertEqual(agg.counts.studentsSynced, 5, 'studentsSynced summed')
  assertEqual(agg.counts.submissionsSynced, 9, 'submissionsSynced summed')
  assertEqual(agg.counts.errorsCount, 1, 'errorsCount summed')
  assertEqual(agg.errors.length, 1, 'errors collected')

  section('partial success finalizes as completed')
  const runId = await createSyncRun(admin, { source: 'd2l_valence_manual', mode: 'full', triggeredBy: 'test' })
  await finalizeSyncRun(admin, runId, agg, Date.now() - 1000, 'completed')
  const { data: row } = await admin.from('sync_run').select('status, errors_count, students_synced').eq('id', runId).single()
  assertEqual(row!.status, 'completed', 'status completed despite 1 course error')
  assertEqual(row!.errors_count, 1, 'errors_count persisted')
  assertEqual(row!.students_synced, 5, 'aggregated students persisted')
  await admin.from('sync_run').delete().eq('id', runId)

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-sync-run.ts`
Expected: FAIL — `Cannot find module '@/lib/sync/sync-run'`.

- [ ] **Step 3: Create `src/lib/sync/sync-run.ts`**

```ts
/**
 * sync_run row lifecycle + parent-side orchestration helpers for the
 * fan-out LE3 sync. Framework-agnostic; the Trigger.dev parent task
 * composes these.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  listCoursesUnderOrgUnit, getValenceConfig, type NormalizedCourse,
} from '@/lib/d2l'
import type { SyncRunSource, SyncRunMode } from '@/lib/types'
import type { SyncCounts, SyncError } from '@/lib/sync/sync-engine'
import type { CourseSyncResult } from '@/lib/sync/sync-course'

export async function createSyncRun(
  admin: SupabaseClient,
  opts: { source: SyncRunSource; mode: SyncRunMode; triggeredBy?: string }
): Promise<string> {
  const { data, error } = await admin
    .from('sync_run')
    .insert({
      source: opts.source, mode: opts.mode,
      status: 'running', triggered_by: opts.triggeredBy || null,
    })
    .select('id').single()
  if (error || !data) throw new Error(`Failed to create sync_run: ${error?.message}`)
  return data.id as string
}

export async function enumerateCourses(le3OrgUnitIdOverride?: string): Promise<NormalizedCourse[]> {
  const config = getValenceConfig()
  const ou = le3OrgUnitIdOverride || config.le3OrgUnitId
  return listCoursesUnderOrgUnit(ou)
}

export async function pickDefaultCoachId(admin: SupabaseClient): Promise<string | null> {
  // <<< paste the exact body of pickDefaultCoachId moved from
  //     sync-engine.ts (the two-query: prefer auth_user_id present,
  //     fall back to any active coach), but take `admin` as a param
  //     instead of calling createAdminClient() internally. >>>
}

export function aggregateCourseResults(
  results: CourseSyncResult[]
): { counts: SyncCounts; errors: SyncError[] } {
  const counts: SyncCounts = {
    coursesSynced: 0, studentsSynced: 0, assignmentsSynced: 0,
    submissionsSynced: 0, submissionsSkipped: 0, errorsCount: 0,
  }
  const errors: SyncError[] = []
  for (const r of results) {
    counts.coursesSynced += r.counts.coursesSynced
    counts.studentsSynced += r.counts.studentsSynced
    counts.assignmentsSynced += r.counts.assignmentsSynced
    counts.submissionsSynced += r.counts.submissionsSynced
    counts.submissionsSkipped += r.counts.submissionsSkipped
    counts.errorsCount += r.counts.errorsCount
    errors.push(...r.errors)
  }
  return { counts, errors }
}

export async function finalizeSyncRun(
  admin: SupabaseClient,
  syncRunId: string,
  agg: { counts: SyncCounts; errors: SyncError[] },
  startedAtMs: number,
  status: 'completed' | 'failed'
): Promise<void> {
  await admin.from('sync_run').update({
    status,
    completed_at: new Date().toISOString(),
    duration_seconds: Math.round((Date.now() - startedAtMs) / 1000),
    courses_synced: agg.counts.coursesSynced,
    students_synced: agg.counts.studentsSynced,
    assignments_synced: agg.counts.assignmentsSynced,
    submissions_synced: agg.counts.submissionsSynced,
    submissions_skipped: agg.counts.submissionsSkipped,
    errors_count: agg.counts.errorsCount,
    error_details: agg.errors.length > 0 ? agg.errors : null,
  }).eq('id', syncRunId)
}
```

Delete `pickDefaultCoachId` from `sync-engine.ts`; add `export { pickDefaultCoachId, createSyncRun, finalizeSyncRun, enumerateCourses, aggregateCourseResults } from '@/lib/sync/sync-run'` to the engine barrel.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-sync-run.ts`
Expected: PASS.

- [ ] **Step 5: Regression + typecheck + lint**

Run: `npx tsx scripts/test-sync-engine.ts` → PASS
Run: `npx tsc --noEmit` → exit 0
Run: `npx next lint --file src/lib/sync/sync-run.ts --file src/lib/sync/sync-engine.ts` → clean

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/sync-run.ts src/lib/sync/sync-engine.ts scripts/test-sync-run.ts
git commit -m "$(cat <<'EOF'
sync: add sync-run module (create/finalize/enumerate/pick/aggregate)

Parent-side orchestration helpers extracted from the engine. Pure
aggregation + sync_run lifecycle, unit-tested.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Child task `src/trigger/sync-course.ts`

**Files:**
- Create: `src/trigger/sync-course.ts`

- [ ] **Step 1: Create the child task**

```ts
/**
 * sync-course — Trigger.dev child task. Syncs exactly ONE LE3 course.
 * Fanned out by the sync-le3 parent. Bounded queue concurrency keeps
 * us under D2L rate limits; one-course working set keeps memory flat.
 */
import { schemaTask, metadata, logger } from '@trigger.dev/sdk'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase-admin'
import { syncOneCourse } from '@/lib/sync/sync-course'
import type { NormalizedCourse } from '@/lib/d2l'

const CONCURRENCY = Number(process.env.SYNC_COURSE_CONCURRENCY ?? '4')
const MAX_DURATION = Number(process.env.SYNC_COURSE_MAX_DURATION ?? '1200')

export const syncCourseTask = schemaTask({
  id: 'sync-course',
  schema: z.object({
    syncRunId: z.string(),
    course: z.object({
      orgUnitId: z.string(),
      name: z.string(),
      code: z.string().nullable().optional(),
    }).passthrough(),
    mode: z.enum(['full', 'incremental']),
    defaultCoachId: z.string().nullable(),
  }),
  queue: { name: 'sync-course', concurrencyLimit: CONCURRENCY },
  machine: { preset: 'large-1x' },
  maxDuration: MAX_DURATION,
  retry: {
    maxAttempts: 3, factor: 2,
    minTimeoutInMs: 5_000, maxTimeoutInMs: 60_000, randomize: true,
  },
  run: async (payload) => {
    const course = payload.course as unknown as NormalizedCourse
    metadata.parent.set(`course:${course.orgUnitId}`, 'running')
    logger.info('sync-course start', { ou: course.orgUnitId, name: course.name })

    const result = await syncOneCourse({
      syncRunId: payload.syncRunId,
      course,
      mode: payload.mode,
      defaultCoachId: payload.defaultCoachId,
    })

    metadata.parent.set(
      `course:${course.orgUnitId}`,
      result.counts.errorsCount > 0 ? 'completed_with_errors' : 'completed'
    )
    logger.info('sync-course done', { ou: course.orgUnitId, counts: result.counts })
    return result
  },
})
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx next lint --file src/trigger/sync-course.ts` → clean
(No unit test — Trigger.dev task wiring is verified via the local `trigger.dev dev` run in Task 8 and the deploy smoke in Task 9. `syncOneCourse` itself is already covered by Task 1/2 scripts.)

- [ ] **Step 3: Commit**

```bash
git add src/trigger/sync-course.ts
git commit -m "$(cat <<'EOF'
trigger: add sync-course child task (bounded queue, per-course)

Queue concurrency SYNC_COURSE_CONCURRENCY (default 4), maxDuration
SYNC_COURSE_MAX_DURATION (default 1200). Reports per-course status to
parent metadata. One-course working set → bounded memory.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Rewrite parent `src/trigger/sync-le3.ts` to fan out

**Files:**
- Modify: `src/trigger/sync-le3.ts`

- [ ] **Step 1: Replace the `run` body**

Keep the existing `schemaTask` id/schema/machine(`large-2x`)/maxDuration(3600)/retry. Replace the `run` function with:

```ts
import { schemaTask, metadata, logger, batch } from '@trigger.dev/sdk'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  createSyncRun, finalizeSyncRun, enumerateCourses,
  pickDefaultCoachId, aggregateCourseResults,
} from '@/lib/sync/sync-run'
import { syncCourseTask } from '@/trigger/sync-course'
import type { CourseSyncResult } from '@/lib/sync/sync-course'

// ...schemaTask({ id:'sync-le3', schema: <unchanged>, machine:{preset:'large-2x'},
//    maxDuration:3600, retry:<unchanged>,
run: async (payload) => {
  const admin = createAdminClient()
  const startedAt = Date.now()
  const syncRunId = await createSyncRun(admin, {
    source: payload.source, mode: payload.mode, triggeredBy: payload.triggeredBy,
  })
  metadata.set('syncRunId', syncRunId).set('stage', 'enumerating')

  try {
    const courses = await enumerateCourses(payload.le3OrgUnitId)
    const defaultCoachId = await pickDefaultCoachId(admin)
    metadata.set('stage', 'fanning-out').set('totalCourses', courses.length)
    logger.info('sync-le3 fan-out', { courses: courses.length, syncRunId })

    const handle = await syncCourseTask.batchTriggerAndWait(
      courses.map(course => ({
        payload: { syncRunId, course, mode: payload.mode, defaultCoachId },
      }))
    )

    const results: CourseSyncResult[] = []
    for (const run of handle.runs) {
      if (run.ok) {
        results.push(run.output as CourseSyncResult)
      } else {
        // A child that exhausted retries: record the course as failed,
        // continue (partial success = completed per spec).
        results.push({
          courseOuId: 'unknown', courseName: 'unknown',
          counts: { coursesSynced: 0, studentsSynced: 0, assignmentsSynced: 0,
            submissionsSynced: 0, submissionsSkipped: 0, errorsCount: 1 },
          errors: [{ stage: 'course_process', context: 'child-run',
            message: `child run failed: ${String(run.error)}` }],
        })
      }
    }

    const agg = aggregateCourseResults(results)
    metadata.set('stage', 'completed').set('counts', agg.counts)
    await finalizeSyncRun(admin, syncRunId, agg, startedAt, 'completed')
    logger.info('sync-le3 completed', { syncRunId, counts: agg.counts })
    return { syncRunId, counts: agg.counts, errorCount: agg.errors.length }
  } catch (err) {
    // Pre-fan-out catastrophic failure only (config/enumeration).
    await finalizeSyncRun(admin, syncRunId,
      { counts: { coursesSynced: 0, studentsSynced: 0, assignmentsSynced: 0,
        submissionsSynced: 0, submissionsSkipped: 0, errorsCount: 1 },
        errors: [{ stage: 'fatal', context: 'top-level', message: String(err) }] },
      startedAt, 'failed')
    throw err
  }
},
```

> NOTE on `batchTriggerAndWait` + queue: the child task's `queue.concurrencyLimit` governs how many children execute simultaneously even though all are triggered at once — the parent waits (checkpointed) until all complete. Do NOT wrap `batchTriggerAndWait` in `Promise.all`.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx next lint --file src/trigger/sync-le3.ts` → clean

- [ ] **Step 3: Local fan-out verification (Trigger.dev dev + mock)**

This is the integration check for the parent/child wiring. In one terminal: `npx trigger.dev@latest dev`. In another, trigger the parent against the mock OU (the mock-valence host-match works because the child uses the same d2l client/global fetch; set the same `D2L_VALENCE_*` env the test scripts use so URLs hit `brightspace.test` and `le3OrgUnitId`=`1001`). Use the Trigger.dev dashboard/dev CLI to trigger `sync-le3` with `{ "mode":"full","source":"d2l_valence_manual","le3OrgUnitId":"1001" }`.
Expected: 2 child runs (one per mock course), parent `completed`, a `sync_run` row with `courses_synced=2`, `students_synced=4`, `submissions_synced=MOCK_STATS.submissionCount`, `errors_count=0`. Then `DELETE` the test rows (reuse `cleanupMockData` logic) and remove the test `sync_run`.

- [ ] **Step 4: Commit**

```bash
git add src/trigger/sync-le3.ts
git commit -m "$(cat <<'EOF'
trigger: sync-le3 parent fans out per-course children

Enumerate → pickDefaultCoachId once → batchTriggerAndWait sync-course
children (bounded queue) → aggregate → finalize single sync_run row.
Partial success = completed; pre-fan-out failure = failed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Route — remove inline fallback, always enqueue parent

**Files:**
- Modify: `src/app/api/admin/sync-le3/route.ts`

- [ ] **Step 1: Replace the enqueue/inline block**

Delete the inline fallback (the `const { runLe3Sync } = await import('@/lib/sync/sync-engine')` block and its response). Replace the Trigger.dev section so it always enqueues and errors clearly if Trigger.dev is unconfigured:

```ts
if (!process.env.TRIGGER_SECRET_KEY) {
  return NextResponse.json(
    { error: 'Sync requires Trigger.dev. TRIGGER_SECRET_KEY is not set on this deployment.' },
    { status: 503 }
  )
}
const handle = await tasks.trigger<typeof syncLe3Task>('sync-le3', {
  mode, source, triggeredBy, le3OrgUnitId: body.le3OrgUnitId,
})
return NextResponse.json({
  status: 'enqueued', triggerRunId: handle.id,
  message: 'Sync task enqueued via Trigger.dev',
})
```

Update the route docstring: remove the "Inline fallback" paragraph; state Trigger.dev is required and the single-course `le3OrgUnitId` override fans out exactly one child.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx next lint --file src/app/api/admin/sync-le3/route.ts` → clean

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/sync-le3/route.ts
git commit -m "$(cat <<'EOF'
api/sync-le3: drop inline fallback; always enqueue Trigger.dev parent

The inline path was the serverless-timeout trap and the non-convergent
monolith. 503 with a clear message if Trigger.dev is unconfigured.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Remove `runLe3Sync`; retarget the regression harness

**Files:**
- Modify: `src/lib/sync/sync-engine.ts` (delete `runLe3Sync`)
- Modify: `scripts/test-sync-engine.ts` (drive the new composition)

- [ ] **Step 1: Confirm no remaining `runLe3Sync` callers**

Run: `grep -rn "runLe3Sync" src scripts`
Expected after edits: only `scripts/test-sync-engine.ts` (about to be retargeted) and the `sync-engine.ts` definition. (Parent task → Task 6 done; route → Task 7 done.)

- [ ] **Step 2: Retarget `scripts/test-sync-engine.ts`**

Replace the two `runLe3Sync({...})` calls with the composition. Keep all existing assertions against `MOCK_STATS` (they still hold — same data, same engine):

```ts
import { enumerateCourses, pickDefaultCoachId, createSyncRun,
  finalizeSyncRun, aggregateCourseResults } from '@/lib/sync/sync-run'
import { syncOneCourse } from '@/lib/sync/sync-course'

async function runFanoutLikeSync(admin, mode: 'full'|'incremental') {
  const courses = await enumerateCourses()           // mock OU 1001
  const coachId = await pickDefaultCoachId(admin)
  const runId = await createSyncRun(admin, { source:'d2l_valence_manual', mode, triggeredBy:'mock-harness' })
  const started = Date.now()
  const results = []
  for (const course of courses) {
    results.push(await syncOneCourse({ syncRunId: runId, course, mode, defaultCoachId: coachId }))
  }
  const agg = aggregateCourseResults(results)
  await finalizeSyncRun(admin, runId, agg, started, 'completed')
  return { syncRunId: runId, counts: agg.counts, errors: agg.errors, durationMs: Date.now()-started }
}
```

Swap `firstRun = await runLe3Sync({...full})` → `firstRun = await runFanoutLikeSync(admin,'full')` and likewise the second (incremental) run. Leave every `assertEqual/assertGte` line unchanged.

- [ ] **Step 3: Delete `runLe3Sync`**

Remove the `runLe3Sync` function from `src/lib/sync/sync-engine.ts` (lines ~95–375). Keep the type exports and the barrel re-exports added in Tasks 1 & 4.

- [ ] **Step 4: Run the retargeted harness**

Run: `npx tsx scripts/test-sync-engine.ts`
Expected: PASS — same assertions, now exercising the fan-out composition serially.

- [ ] **Step 5: Full regression sweep**

Run each, expect PASS:
`npx tsx scripts/test-sync-course.ts`
`npx tsx scripts/test-sync-race.ts`
`npx tsx scripts/test-sync-run.ts`
`npx tsx scripts/test-sync-engine.ts`
Then `npx tsc --noEmit` → exit 0; `npx next lint` (whole project) → clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/sync-engine.ts scripts/test-sync-engine.ts
git commit -m "$(cat <<'EOF'
sync: remove monolithic runLe3Sync; retarget regression harness

All callers now compose enumerate→syncOneCourse→aggregate→finalize.
test-sync-engine.ts drives the same composition serially so the
two-run dedup/resume regression coverage is preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Deploy + production verification runbook

Not code — the load-bearing rollout. Execute in order.

- [ ] **Step 1: Push** — `git push origin main` (Vercel picks up the route change).

- [ ] **Step 2: Deploy Trigger.dev** — `npx trigger.dev@latest deploy` from repo root. **This is mandatory** — registers BOTH `sync-le3` (rewritten) and `sync-course` (new). Confirm both tasks appear in the Trigger.dev dashboard for the Production environment, and that `SYNC_COURSE_CONCURRENCY` (4) / `SYNC_COURSE_MAX_DURATION` (1200) are set there (or accept defaults). The parent's `maxDuration` is now sized off the fan-out worst case from those two vars plus `SYNC_LE3_MAX_COURSES` (64) and `SYNC_LE3_DURATION_MARGIN` (1.5) — defaults give an ≈8h parent ceiling (≥ the ≈4.7h 56-course worst case), never below the prior 3600s; raise `SYNC_LE3_MAX_COURSES`/`SYNC_LE3_DURATION_MARGIN` to widen the one-time backfill window without a redeploy (Gap A).

- [ ] **Step 3: Single-course override smoke** — `POST /api/admin/sync-le3` with `{"le3OrgUnitId":"254698"}` (the sandbox). Verify via SQL: exactly one `sync_run` row, `status=completed`, the sandbox student/work present, parent metadata shows `course:254698 = completed`. Confirms the override path fans out exactly one child.

- [ ] **Step 4: Full backfill** — `POST /api/admin/sync-le3` with `{}` (env OU `248714`). Watch the Trigger.dev dashboard: ~56 `sync-course` children, ≤4 running at once. Then SQL-verify the win conditions: `real_students` climbs well past 15; `SELECT count(DISTINCT course_name) FROM student_work WHERE source='d2l_valence_sync'` ≫ 6; the parent `sync_run` row ends `completed`; `error_details` lists only genuinely-failed courses (if any).

- [ ] **Step 5: Resume check** — immediately re-trigger the full backfill. Verify it completes much faster (children cheap-skip done submissions via pre-download dedup) and `submissions_synced` is ~0 with `submissions_skipped` high, no duplicate `student_work` (`SELECT brightspace_submission_id, count(*) FROM student_work GROUP BY 1 HAVING count(*)>1` → 0 rows).

- [ ] **Step 6: Zombie cleanup** — mark the harmless in-flight pre-refactor run failed if still `running`:
```sql
UPDATE sync_run SET status='failed', completed_at=now()
WHERE id='05fcf873-...' AND status='running';
```
(Use the actual id; confirm it predates the deploy.)

- [ ] **Step 7: Final commit (docs)** — update the spec's Status to `Implemented`; commit.

---

## Self-Review

**Spec coverage:**
- Parent/child topology → Tasks 5, 6 ✓
- Engine decomposition (`syncOneCourse`, `createSyncRun`, `finalizeSyncRun`, `enumerateCourses`) → Tasks 1, 4 ✓
- Single parent `sync_run` row + per-course metadata → Task 6 (`metadata.parent`/`metadata.set`) ✓
- Partial success = completed; failed only pre-fan-out → Task 6 finalize branches; Task 4 test asserts ✓
- Concurrency env-tunable + 429 retry → Task 5 `queue.concurrencyLimit` + task `retry`; **429 backoff: verify the d2l fetch layer already retries 429 — if not, add it.** Added as Task 5 Step note → **GAP: make explicit.** (See fix below.)
- Keep `le3OrgUnitId` override → Tasks 6 (`enumerateCourses(override)`), 7, 9 Step 3 ✓
- Drop inline fallback → Task 7 ✓
- Write-race hardening (student + instructor) → Tasks 2, 3 ✓
- Idempotency/resume (pre-download dedup unchanged) → preserved by verbatim move (Task 1); asserted Task 1 Step 1 + Task 9 Step 5 ✓
- Testing (unit/race/integration/backfill/resume) → Tasks 1,2,4 (unit/race), 6 Step 3 + 9 Steps 3-5 (integration/backfill/resume) ✓
- Child maxDuration env-tunable 1200 → Task 5 ✓
- No DB schema change → confirmed (no migration tasks) ✓
- Rollout (push → trigger.dev deploy) → Task 9 ✓

**Gap fix (429 retry):** Add to Task 5 as **Step 1a** before committing: `grep -n "429\|Retry-After\|retry" src/lib/d2l/*.ts`. If the d2l fetch helper does not already retry on HTTP 429 with backoff, add a minimal retry (max 3, exponential, honoring `Retry-After`) to the shared d2l request function and note it in the Task 5 commit. If it already does, record "verified existing 429 handling" and proceed.

**Placeholder scan:** The `<<< paste … >>>` markers in Tasks 1 & 4 are precise verbatim-move instructions with exact source line ranges and explicit mechanical substitutions — not TODOs. Every novel unit (new modules, tasks, tests, race-hardening delta, parent rewrite) has complete code.

**Type consistency:** `CourseSyncResult` / `SyncOneCourseParams` defined in Task 1, imported consistently in Tasks 4,5,6,8. `SyncCounts`/`SyncError` remain exported from `sync-engine.ts` and imported by `sync-course.ts`/`sync-run.ts` (no circular runtime import — type-only imports). `aggregateCourseResults`/`createSyncRun`/`finalizeSyncRun`/`enumerateCourses`/`pickDefaultCoachId` signatures defined in Task 4 and used with matching arguments in Tasks 6 & 8. `syncCourseTask` id `'sync-course'` consistent between Task 5 definition and Task 6 `batchTriggerAndWait`.

Issues found and fixed inline: added the explicit 429-retry verification/implementation step to Task 5.
