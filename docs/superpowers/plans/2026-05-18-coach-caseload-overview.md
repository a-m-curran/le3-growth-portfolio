# Coach Caseload Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve `/v2/coach/caseload` in place from a thin student list into a blended overview — per-student engagement + outstanding/overdue work + an enriched attention flag — as a two-line responsive worklist with a caseload rollup strip.

**Architecture:** A new typed `getCoachCaseloadOverview(coachId, isDemo)` in `src/lib/queries.ts` computes every metric with a handful of **set-based bulk queries** (one per table, then in-memory assembly — never an awaited query inside a per-student loop). The existing `/api/coach/students` route keeps the auth/identity/demo boundary and just calls the function, returning `{ students, rollup }`. The existing client `CaseloadView.tsx` renders the richer shape (rollup strip + two-line rows), keeping its filter pills and `router.push('/v2/coach/${id}')` row click. No schema, RLS, or new API route. Coach-first; the `CaseloadRow`/`CaseloadRollup` return types are the frozen contract a future instructor mode reuses.

**Tech Stack:** Next.js App Router (TypeScript, `strict`), Supabase JS client via `createAdminClient()`, Tailwind, repo structural source-scan tests run with `npx tsx`.

---

## Pre-flight (read before Task 1)

**Worktree & environment (execution harness sets this up):**
- Work in a NEW worktree `.worktrees/coach-caseload-overview` branched from current `main` HEAD. Do **not** touch any other worktree under `.worktrees/`.
- Copy the gitignored `/Users/andrewcurran/le3-growth-portfolio/.env.local` into the worktree root so `npm run build` is faithful (v1 pages eagerly init Supabase at static-export; without env you get spurious `supabaseUrl is required` export errors — not a code defect).
- Shell cwd resets between Bash commands. Always use absolute paths or `git -C <worktree>` / `cd <worktree> &&`.

**Repo conventions (enforced by every task):**
- Automated tests are a single standalone structural source-scan script run with `npx tsx scripts/test-coach-caseload-overview.ts` (pages/route-handlers/components cannot execute under tsx — we scan comment-stripped source). It imports `{ assertEqual, section, finish }` from `./_sync-test-harness`, defines local `read()`/`stripComments()` helpers, has one `section(...)` + `{ }` block per task, and exactly one trailing `finish()`. No `bootstrapTestEnv()` (pure scan).
- Gates (run from the worktree root): `npx tsc --noEmit` exits 0; `npx eslint --no-eslintrc --config .eslintrc.json <files>` prints no warnings/errors (NEVER `npx next lint` — environmentally broken in worktrees); `npm run build` exits 0.
- `@/` path alias → `src/` (tsconfig). `.eslintrc.json` exists at repo root (`{ "extends": ["next/core-web-vitals", "next/typescript"] }`).
- Commit after every task (frequent commits). Use `git -C <worktree> add <exact files>` then commit.

**Frozen-contract & reconciliation notes (the recon surfaced these — honor them):**
- The spec's data flow said "server component → getV2Identity → function". The **actual** caseload is `page.tsx` (server shell) → `CaseloadView.tsx` (`'use client'`) → `fetch('/api/coach/students')`. We follow the existing pattern: the **route** owns identity/auth/demo resolution and calls the lib function. This is "reuse the established pattern" from the spec — not a new API route.
- `/api/coach/students` is also consumed by the v2 `StudentPicker`. Therefore `CaseloadRow` is a **superset**: it keeps `id, firstName, lastName, email, cohort, conversationCount, lastActivityAt, needsAttention` (existing shape) AND adds the new metric fields. Response key stays `students`; `rollup` is added alongside. This keeps `StudentPicker` working with zero change.
- `student_goal` has **no** `updated_at`/progress timestamp (schema-verified). "Stalled" is therefore defined concretely as: `status='active'` AND `created_at` older than 21 days AND `progress_notes` null/empty. This is the pinned, data-supported definition (supersedes any vaguer reading).
- `growth_conversation.work_id` (nullable uuid) **exists** (schema-verified) — reflection coverage uses it directly (a work is "reflected" if a completed conversation has `work_id` = that work). The spec's student-level fallback is moot; do not implement it.
- "Last active" = most recent of {completed `growth_conversation.started_at`, `student_work.submitted_at`} (richer than the existing convo-only signal; still set-based).
- Demo coaches: `identity.isDemo` ⇒ overview spans all `is_demo=true` active students (mirrors existing route behavior). The function takes `isDemo` to preserve this; the `CaseloadRow`/`CaseloadRollup` return types are unaffected (the frozen contract).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/types.ts` | `CaseloadRow`, `CaseloadRollup`, `CaseloadOverview` interfaces (frozen contract) | Modify (append) |
| `src/lib/queries.ts` | `getCoachCaseloadOverview(coachId, isDemo)` — set-based metric aggregation | Modify (append) |
| `src/app/api/coach/students/route.ts` | Auth/identity/demo boundary; calls the function; returns `{ students, rollup }` | Replace body |
| `src/app/v2/(coach)/coach/caseload/CaseloadView.tsx` | Rollup strip + two-line rows; filter pills + row click preserved | Replace file |
| `scripts/test-coach-caseload-overview.ts` | Structural source-scan invariants (one section per task) | Create |

---

### Task 1: Frozen result types

**Files:**
- Modify: `src/lib/types.ts` (append at end of file)
- Create: `scripts/test-coach-caseload-overview.ts`

- [ ] **Step 1: Create the test file with the Task 1 section (the failing test)**

Create `scripts/test-coach-caseload-overview.ts` with exactly this content:

```ts
/**
 * Structural invariants for the coach caseload overview.
 * Pages/routes/components can't run under tsx; comment-stripped source scan.
 * USAGE: npx tsx scripts/test-coach-caseload-overview.ts
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

section('Task 1: frozen result types in types.ts')
{
  const t = stripComments(read('src/lib/types.ts'))
  assertEqual(/export interface CaseloadRow/.test(t), true, 'CaseloadRow exported')
  assertEqual(/export interface CaseloadRollup/.test(t), true, 'CaseloadRollup exported')
  assertEqual(/export interface CaseloadOverview/.test(t), true, 'CaseloadOverview exported')
  assertEqual(/reflectionCoveragePct/.test(t), true, 'CaseloadRow has reflectionCoveragePct')
  assertEqual(/outstandingCount/.test(t) && /overdueCount/.test(t), true, 'CaseloadRow has outstanding/overdue counts')
  assertEqual(/attentionReasons/.test(t), true, 'CaseloadRow has attentionReasons')
  assertEqual(/medianReflectionCoveragePct/.test(t), true, 'CaseloadRollup has medianReflectionCoveragePct')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
```

- [ ] **Step 2: Run the test, verify the Task 1 section fails**

Run: `cd <worktree> && npx tsx scripts/test-coach-caseload-overview.ts`
Expected: FAIL — lines like `✗ CaseloadRow exported` (types not added yet); process exits 1.

- [ ] **Step 3: Append the interfaces to `src/lib/types.ts`**

Append exactly this at the end of `src/lib/types.ts`:

```ts

/**
 * Coach caseload overview — the frozen contract.
 * A future instructor-scoped mode reuses these exact shapes; only the
 * scoping/query internals differ. Superset of the legacy caseload row
 * (id/firstName/lastName/email/cohort/conversationCount/lastActivityAt/
 * needsAttention) so the StudentPicker consumer is unaffected.
 */
export interface CaseloadRow {
  id: string
  firstName: string
  lastName: string
  email: string
  cohort: string | null
  conversationCount: number
  lastActivityAt: string | null
  lastActiveDays: number | null
  reflectionCoveragePct: number
  goalsActive: number
  goalsStalled: number
  outstandingCount: number
  overdueCount: number
  lastCoachTouchDays: number | null
  trajectory: 'up' | 'flat' | 'down'
  needsAttention: boolean
  attentionReasons: string[]
}

export interface CaseloadRollup {
  studentCount: number
  needsAttentionCount: number
  withOverdueCount: number
  medianReflectionCoveragePct: number
}

export interface CaseloadOverview {
  rows: CaseloadRow[]
  rollup: CaseloadRollup
}
```

- [ ] **Step 4: Run the test, verify the Task 1 section passes**

Run: `cd <worktree> && npx tsx scripts/test-coach-caseload-overview.ts`
Expected: PASS — all Task 1 assertions `✓`; `7 passed, 0 failed`; exit 0.

- [ ] **Step 5: Typecheck + commit**

Run: `cd <worktree> && npx tsc --noEmit`
Expected: exit 0, no output.

```bash
git -C <worktree> add src/lib/types.ts scripts/test-coach-caseload-overview.ts
git -C <worktree> commit -m "feat(caseload): frozen CaseloadRow/Rollup/Overview types + structural test"
```

---

### Task 2: `getCoachCaseloadOverview` data function

**Files:**
- Modify: `src/lib/queries.ts` (append a new exported function; add the type import)
- Modify: `scripts/test-coach-caseload-overview.ts` (insert the Task 2 section)

- [ ] **Step 1: Insert the Task 2 section (the failing test)**

In `scripts/test-coach-caseload-overview.ts`, replace the line:

```ts
// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

with exactly:

```ts
section('Task 2: getCoachCaseloadOverview — set-based, coach-scoped')
{
  const q = stripComments(read('src/lib/queries.ts'))
  assertEqual(/export async function getCoachCaseloadOverview\s*\(/.test(q), true, 'getCoachCaseloadOverview exported')
  assertEqual(/coachId:\s*string/.test(q) && /isDemo\s*=\s*false/.test(q), true, 'signature (coachId, isDemo=false)')
  assertEqual(/\.eq\('coach_id',\s*coachId\)/.test(q), true, 'scopes students by coach_id')
  assertEqual(/isDemo[\s\S]{0,80}\.eq\('is_demo',\s*true\)/.test(q), true, 'demo branch spans is_demo students')
  assertEqual(/Promise\.all\(\[/.test(q), true, 'bulk fetch via Promise.all (set-based)')
  assertEqual(/students\.map\(\s*async/.test(q), false, 'NO awaited query inside a per-student map')
  assertEqual(/from\('growth_conversation'\)/.test(q) && /from\('student_work'\)/.test(q) && /from\('student_goal'\)/.test(q) && /from\('coach_note'\)/.test(q) && /from\('student_course'\)/.test(q) && /from\('assignment'\)/.test(q), true, 'reads all metric tables')
  assertEqual(/reflectedWorkIds/.test(q) && /reflectionCoveragePct/.test(q), true, 'reflection coverage via work_id')
  assertEqual(/outstandingCount/.test(q) && /overdueCount/.test(q) && /due_date/.test(q), true, 'outstanding/overdue from assignment/student_course')
  assertEqual(/trajectory/.test(q) && /'up'/.test(q) && /'down'/.test(q) && /'flat'/.test(q), true, 'trajectory up/flat/down')
  assertEqual(/attentionReasons/.test(q) && /Inactive/.test(q) && /overdue/.test(q) && /stalled goal/.test(q), true, 'attention reasons composed')
  assertEqual(/medianReflectionCoveragePct/.test(q), true, 'rollup computes median coverage')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

- [ ] **Step 2: Run the test, verify Task 2 fails (Task 1 still passes)**

Run: `cd <worktree> && npx tsx scripts/test-coach-caseload-overview.ts`
Expected: FAIL — Task 1 `✓`, Task 2 `✗ getCoachCaseloadOverview exported` etc.; exit 1.

- [ ] **Step 3: Add the type import to `src/lib/queries.ts`**

`src/lib/queries.ts` already imports from `./types` (e.g. `Coach`, `Student`). Find the existing `from './types'` import and add `CaseloadRow`, `CaseloadRollup`, `CaseloadOverview` to that import list. If (and only if) there is no existing `from './types'` import, add this line after the `./supabase-admin` import:

```ts
import type { CaseloadRow, CaseloadRollup, CaseloadOverview } from './types'
```

- [ ] **Step 4: Append the function to `src/lib/queries.ts`**

Append exactly this at the end of `src/lib/queries.ts` (uses the file-local `getAdmin()` helper, consistent with `getCoachDashboard`/`getSessionPrep`):

```ts

/**
 * Coach caseload overview — every metric via set-based bulk queries
 * (one query per table, then in-memory assembly). NO awaited query
 * inside a per-student loop. Caller (the /api/coach/students route)
 * owns auth: it passes the server-resolved coachId and isDemo; this
 * function never trusts client input.
 *
 * Definitions (schema-pinned):
 *  - last active: most recent of {completed conversation started_at,
 *    work submitted_at}
 *  - reflection coverage: % of the student's works that have >=1
 *    completed conversation (growth_conversation.work_id)
 *  - outstanding: an active assignment in an enrolled course with no
 *    matching student_work; overdue: outstanding AND due_date < now
 *  - goals stalled: active goal created >21d ago with empty
 *    progress_notes (student_goal has no updated_at)
 *  - trajectory: sign of (events last 14d - prior 14d); flat within +-1
 *  - attention: inactive >=14d OR >=1 overdue OR >=1 stalled goal
 */
export async function getCoachCaseloadOverview(
  coachId: string,
  isDemo = false
): Promise<CaseloadOverview> {
  const admin = getAdmin()
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const t14 = new Date(now - 14 * DAY)
  const t28 = new Date(now - 28 * DAY)
  const stalledCutoff = new Date(now - 21 * DAY)

  let sQuery = admin
    .from('student')
    .select('id, first_name, last_name, email, cohort')
    .eq('status', 'active')
    .order('last_name', { ascending: true })
  if (isDemo) {
    sQuery = sQuery.eq('is_demo', true)
  } else {
    sQuery = sQuery.eq('coach_id', coachId).eq('is_demo', false)
  }
  const { data: studentsRaw } = await sQuery

  interface SRow { id: string; first_name: string; last_name: string; email: string; cohort: string | null }
  const students = (studentsRaw ?? []) as unknown as SRow[]

  const emptyRollup: CaseloadRollup = {
    studentCount: 0, needsAttentionCount: 0, withOverdueCount: 0, medianReflectionCoveragePct: 0,
  }
  if (students.length === 0) return { rows: [], rollup: emptyRollup }

  const ids = students.map(s => s.id)

  const [
    { data: convosRaw },
    { data: worksRaw },
    { data: goalsRaw },
    { data: notesRaw },
    { data: enrollRaw },
  ] = await Promise.all([
    admin.from('growth_conversation')
      .select('student_id, started_at, status, work_id')
      .in('student_id', ids)
      .eq('status', 'completed'),
    admin.from('student_work')
      .select('id, student_id, submitted_at, assignment_id')
      .in('student_id', ids),
    admin.from('student_goal')
      .select('student_id, status, created_at, progress_notes')
      .in('student_id', ids),
    admin.from('coach_note')
      .select('student_id, session_date')
      .eq('coach_id', coachId)
      .in('student_id', ids),
    admin.from('student_course')
      .select('student_id, course_id')
      .in('student_id', ids),
  ])

  interface ConvoRow { student_id: string; started_at: string; status: string; work_id: string | null }
  interface WorkRow { id: string; student_id: string; submitted_at: string; assignment_id: string | null }
  interface GoalRow { student_id: string; status: string; created_at: string; progress_notes: string | null }
  interface NoteRow { student_id: string; session_date: string }
  interface EnrollRow { student_id: string; course_id: string }
  const convos = (convosRaw ?? []) as unknown as ConvoRow[]
  const works = (worksRaw ?? []) as unknown as WorkRow[]
  const goals = (goalsRaw ?? []) as unknown as GoalRow[]
  const notes = (notesRaw ?? []) as unknown as NoteRow[]
  const enroll = (enrollRaw ?? []) as unknown as EnrollRow[]

  const courseIds = Array.from(new Set(enroll.map(e => e.course_id)))
  interface AssignRow { id: string; course_id: string; due_date: string | null }
  let assigns: AssignRow[] = []
  if (courseIds.length > 0) {
    const { data: assignsRaw } = await admin
      .from('assignment')
      .select('id, course_id, due_date')
      .in('course_id', courseIds)
      .eq('active', true)
    assigns = (assignsRaw ?? []) as unknown as AssignRow[]
  }

  const assignsByCourse = new Map<string, AssignRow[]>()
  for (const a of assigns) {
    const arr = assignsByCourse.get(a.course_id)
    if (arr) arr.push(a)
    else assignsByCourse.set(a.course_id, [a])
  }
  const coursesByStudent = new Map<string, Set<string>>()
  for (const e of enroll) {
    const set = coursesByStudent.get(e.student_id)
    if (set) set.add(e.course_id)
    else coursesByStudent.set(e.student_id, new Set([e.course_id]))
  }
  const reflectedWorkIds = new Set<string>()
  for (const c of convos) if (c.work_id) reflectedWorkIds.add(c.work_id)

  const worksByStudent = new Map<string, WorkRow[]>()
  for (const w of works) {
    const arr = worksByStudent.get(w.student_id)
    if (arr) arr.push(w)
    else worksByStudent.set(w.student_id, [w])
  }
  const convosByStudent = new Map<string, ConvoRow[]>()
  for (const c of convos) {
    const arr = convosByStudent.get(c.student_id)
    if (arr) arr.push(c)
    else convosByStudent.set(c.student_id, [c])
  }
  const goalsByStudent = new Map<string, GoalRow[]>()
  for (const g of goals) {
    const arr = goalsByStudent.get(g.student_id)
    if (arr) arr.push(g)
    else goalsByStudent.set(g.student_id, [g])
  }
  const lastNoteByStudent = new Map<string, string>()
  for (const n of notes) {
    const prev = lastNoteByStudent.get(n.student_id)
    if (!prev || n.session_date > prev) lastNoteByStudent.set(n.student_id, n.session_date)
  }

  const rows: CaseloadRow[] = students.map(s => {
    const sWorks = worksByStudent.get(s.id) ?? []
    const sConvos = convosByStudent.get(s.id) ?? []
    const sGoals = goalsByStudent.get(s.id) ?? []

    const conversationCount = sConvos.length

    let lastTs = 0
    for (const c of sConvos) {
      const t = new Date(c.started_at).getTime()
      if (t > lastTs) lastTs = t
    }
    for (const w of sWorks) {
      const t = new Date(w.submitted_at).getTime()
      if (t > lastTs) lastTs = t
    }
    const lastActivityAt = lastTs > 0 ? new Date(lastTs).toISOString() : null
    const lastActiveDays = lastTs > 0 ? Math.floor((now - lastTs) / DAY) : null

    const totalWorks = sWorks.length
    const reflectedWorks = sWorks.filter(w => reflectedWorkIds.has(w.id)).length
    const reflectionCoveragePct = totalWorks > 0
      ? Math.round((reflectedWorks / totalWorks) * 100)
      : 0

    const activeGoals = sGoals.filter(g => g.status === 'active')
    const goalsActive = activeGoals.length
    const goalsStalled = activeGoals.filter(g =>
      new Date(g.created_at) < stalledCutoff &&
      (!g.progress_notes || g.progress_notes.trim() === '')
    ).length

    const enrolledCourses = coursesByStudent.get(s.id) ?? new Set<string>()
    const doneAssignmentIds = new Set<string>()
    for (const w of sWorks) if (w.assignment_id) doneAssignmentIds.add(w.assignment_id)
    let outstandingCount = 0
    let overdueCount = 0
    for (const cid of enrolledCourses) {
      for (const a of assignsByCourse.get(cid) ?? []) {
        if (doneAssignmentIds.has(a.id)) continue
        outstandingCount++
        if (a.due_date && new Date(a.due_date).getTime() < now) overdueCount++
      }
    }

    let ev14 = 0
    let evPrev = 0
    for (const w of sWorks) {
      const t = new Date(w.submitted_at)
      if (t >= t14) ev14++
      else if (t >= t28) evPrev++
    }
    for (const c of sConvos) {
      const t = new Date(c.started_at)
      if (t >= t14) ev14++
      else if (t >= t28) evPrev++
    }
    const trajectory: 'up' | 'flat' | 'down' =
      ev14 > evPrev + 1 ? 'up' : ev14 < evPrev - 1 ? 'down' : 'flat'

    const lastNote = lastNoteByStudent.get(s.id) ?? null
    const lastCoachTouchDays = lastNote
      ? Math.floor((now - new Date(lastNote).getTime()) / DAY)
      : null

    const attentionReasons: string[] = []
    if (lastActiveDays === null) attentionReasons.push('No activity yet')
    else if (lastActiveDays >= 14) attentionReasons.push(`Inactive ${lastActiveDays}d`)
    if (overdueCount > 0) attentionReasons.push(`${overdueCount} overdue`)
    if (goalsStalled > 0) {
      attentionReasons.push(`${goalsStalled} stalled goal${goalsStalled === 1 ? '' : 's'}`)
    }
    const needsAttention = attentionReasons.length > 0

    return {
      id: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      email: s.email,
      cohort: s.cohort,
      conversationCount,
      lastActivityAt,
      lastActiveDays,
      reflectionCoveragePct,
      goalsActive,
      goalsStalled,
      outstandingCount,
      overdueCount,
      lastCoachTouchDays,
      trajectory,
      needsAttention,
      attentionReasons,
    }
  })

  const coverages = rows.map(r => r.reflectionCoveragePct).sort((a, b) => a - b)
  const median = coverages.length === 0
    ? 0
    : coverages.length % 2 === 1
      ? coverages[(coverages.length - 1) / 2]
      : Math.round((coverages[coverages.length / 2 - 1] + coverages[coverages.length / 2]) / 2)

  const rollup: CaseloadRollup = {
    studentCount: rows.length,
    needsAttentionCount: rows.filter(r => r.needsAttention).length,
    withOverdueCount: rows.filter(r => r.overdueCount > 0).length,
    medianReflectionCoveragePct: median,
  }

  return { rows, rollup }
}
```

- [ ] **Step 5: Run the test, verify Task 2 passes**

Run: `cd <worktree> && npx tsx scripts/test-coach-caseload-overview.ts`
Expected: PASS — Task 1 + Task 2 all `✓`; exit 0.

- [ ] **Step 6: Typecheck + lint + commit**

Run: `cd <worktree> && npx tsc --noEmit`
Expected: exit 0.
Run: `cd <worktree> && npx eslint --no-eslintrc --config .eslintrc.json src/lib/queries.ts src/lib/types.ts`
Expected: exit 0, no output.

```bash
git -C <worktree> add src/lib/queries.ts scripts/test-coach-caseload-overview.ts
git -C <worktree> commit -m "feat(caseload): set-based getCoachCaseloadOverview metric aggregation"
```

---

### Task 3: Wire the existing API route

**Files:**
- Modify: `src/app/api/coach/students/route.ts` (replace whole file — auth/demo boundary preserved, inline aggregation removed)
- Modify: `scripts/test-coach-caseload-overview.ts` (insert the Task 3 section)

- [ ] **Step 1: Insert the Task 3 section (the failing test)**

In `scripts/test-coach-caseload-overview.ts`, replace the (now-second) line:

```ts
// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

with exactly:

```ts
section('Task 3: /api/coach/students delegates to the function')
{
  const r = stripComments(read('src/app/api/coach/students/route.ts'))
  assertEqual(/from '@\/lib\/queries'/.test(r) && /getCoachCaseloadOverview/.test(r), true, 'route imports getCoachCaseloadOverview')
  assertEqual(/identity\.role !== 'coach'/.test(r), true, 'coach role guard preserved')
  assertEqual(/getV2CoachId\(\)/.test(r), true, 'coachId resolved server-side')
  assertEqual(/getCoachCaseloadOverview\(\s*coachId,\s*identity\.isDemo\s*\)/.test(r), true, 'calls function with server coachId + isDemo')
  assertEqual(/students:\s*rows/.test(r) && /rollup/.test(r), true, 'returns { students: rows, rollup }')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

- [ ] **Step 2: Run the test, verify Task 3 fails**

Run: `cd <worktree> && npx tsx scripts/test-coach-caseload-overview.ts`
Expected: FAIL — Tasks 1–2 `✓`, Task 3 `✗ route imports getCoachCaseloadOverview` etc.; exit 1.

- [ ] **Step 3: Replace `src/app/api/coach/students/route.ts` entirely**

Replace the whole file with exactly:

```ts
import { NextResponse } from 'next/server'
import { getCoachCaseloadOverview } from '@/lib/queries'
import { getV2CoachId, getV2Identity } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/coach/students
 *
 * Returns the authenticated coach's caseload as the blended overview:
 *   { students: CaseloadRow[], rollup: CaseloadRollup }
 *
 * `students` is a superset of the legacy shape (id/firstName/lastName/
 * email/cohort/conversationCount/lastActivityAt/needsAttention) so the
 * v2 StudentPicker consumer is unaffected; the extra metric fields +
 * `rollup` power /v2/coach/caseload.
 *
 * Auth boundary lives here: real coach => their assigned non-demo
 * students; demo coach (persona cookie) => all is_demo=true students so
 * the demo caseload is populated. The server-resolved coachId is the
 * only id the aggregation trusts.
 */
export async function GET() {
  const identity = await getV2Identity()
  if (!identity || identity.role !== 'coach') {
    return NextResponse.json({ error: 'Coach access required' }, { status: 401 })
  }
  const coachId = await getV2CoachId()
  if (!coachId) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 })
  }

  const { rows, rollup } = await getCoachCaseloadOverview(coachId, identity.isDemo)
  return NextResponse.json({ students: rows, rollup })
}
```

- [ ] **Step 4: Run the test, verify Task 3 passes**

Run: `cd <worktree> && npx tsx scripts/test-coach-caseload-overview.ts`
Expected: PASS — Tasks 1–3 all `✓`; exit 0.

- [ ] **Step 5: Typecheck + lint + commit**

Run: `cd <worktree> && npx tsc --noEmit`
Expected: exit 0.
Run: `cd <worktree> && npx eslint --no-eslintrc --config .eslintrc.json "src/app/api/coach/students/route.ts"`
Expected: exit 0, no output.

```bash
git -C <worktree> add "src/app/api/coach/students/route.ts" scripts/test-coach-caseload-overview.ts
git -C <worktree> commit -m "feat(caseload): /api/coach/students returns blended overview + rollup"
```

---

### Task 4: Two-line rows + rollup strip in CaseloadView

**Files:**
- Modify: `src/app/v2/(coach)/coach/caseload/CaseloadView.tsx` (replace whole file)
- Modify: `scripts/test-coach-caseload-overview.ts` (insert the Task 4 section)

- [ ] **Step 1: Insert the Task 4 section (the failing test)**

In `scripts/test-coach-caseload-overview.ts`, replace the (now-third) line:

```ts
// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

with exactly:

```ts
section('Task 4: CaseloadView renders rollup strip + two-line rows')
{
  const v = stripComments(read('src/app/v2/(coach)/coach/caseload/CaseloadView.tsx'))
  assertEqual(/rollup/.test(v), true, 'consumes rollup')
  assertEqual(/medianReflectionCoveragePct/.test(v), true, 'rollup strip shows median coverage')
  assertEqual(/reflectionCoveragePct/.test(v), true, 'row shows reflection coverage')
  assertEqual(/outstandingCount/.test(v) && /overdueCount/.test(v), true, 'row shows outstanding/overdue')
  assertEqual(/trajectory/.test(v), true, 'row shows trajectory')
  assertEqual(/attentionReasons/.test(v), true, 'row shows attention reasons')
  assertEqual(/lastCoachTouchDays/.test(v), true, 'row shows last coach touch')
  assertEqual(/router\.push\(`\/v2\/coach\/\$\{s\.id\}`\)/.test(v), true, 'row still links to /v2/coach/{id}')
  assertEqual(/setFilter\('attention'\)/.test(v), true, 'attention filter preserved')
  assertEqual(/data-row-secondary/.test(v), true, 'two-line row: secondary line present')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

- [ ] **Step 2: Run the test, verify Task 4 fails**

Run: `cd <worktree> && npx tsx scripts/test-coach-caseload-overview.ts`
Expected: FAIL — Tasks 1–3 `✓`, Task 4 `✗ consumes rollup` etc.; exit 1.

- [ ] **Step 3: Replace `src/app/v2/(coach)/coach/caseload/CaseloadView.tsx` entirely**

Replace the whole file with exactly:

```tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { CaseloadRow, CaseloadRollup } from '@/lib/types'

/**
 * Client component: fetches /api/coach/students (the blended overview),
 * renders a rollup strip + two-line worklist rows. Server component
 * page.tsx mounts this so the route stays a server component. Filters:
 * "All", "Needs attention". Row click -> existing per-student Prep.
 */

type FilterMode = 'all' | 'attention'

export function CaseloadView() {
  const router = useRouter()
  const [rows, setRows] = useState<CaseloadRow[] | null>(null)
  const [rollup, setRollup] = useState<CaseloadRollup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')

  useEffect(() => {
    let cancelled = false
    fetch('/api/coach/students', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as { students: CaseloadRow[]; rollup: CaseloadRollup }
      })
      .then(j => {
        if (cancelled) return
        setRows(j.students)
        setRollup(j.rollup)
      })
      .catch(e => {
        if (cancelled) return
        setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!rows) return []
    if (filter === 'attention') return rows.filter(s => s.needsAttention)
    return rows
  }, [rows, filter])

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
        Couldn&rsquo;t load caseload: {error}
      </div>
    )
  }

  if (rows === null) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="h-24 rounded-xl bg-white border border-gray-200 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-gray-200 p-8 text-center">
        <p className="text-gray-600">No students assigned to you yet.</p>
        <p className="text-xs text-gray-500 mt-2">
          Students appear after Valence sync, or when one launches the tool
          via Brightspace LTI for the first time.
        </p>
      </div>
    )
  }

  const attentionCount = rows.filter(s => s.needsAttention).length

  return (
    <div className="space-y-4">
      {rollup && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <RollupStat label="Students" value={rollup.studentCount} />
          <RollupStat
            label="Need attention"
            value={rollup.needsAttentionCount}
            color={rollup.needsAttentionCount > 0 ? 'amber' : undefined}
          />
          <RollupStat
            label="With overdue"
            value={rollup.withOverdueCount}
            color={rollup.withOverdueCount > 0 ? 'amber' : undefined}
          />
          <RollupStat
            label="Median coverage"
            value={`${rollup.medianReflectionCoveragePct}%`}
          />
        </div>
      )}

      <div className="flex items-center gap-2 text-xs">
        <FilterPill
          label={`All (${rows.length})`}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterPill
          label={`Needs attention (${attentionCount})`}
          active={filter === 'attention'}
          onClick={() => setFilter('attention')}
          accent={attentionCount > 0 ? 'amber' : undefined}
        />
      </div>

      <ul className="space-y-2">
        {filtered.map(s => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => router.push(`/v2/coach/${s.id}`)}
              className="w-full text-left p-4 rounded-xl bg-white border border-gray-200 hover:border-green-400 hover:shadow-sm transition-colors flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-sm font-semibold shrink-0">
                {initials(s.firstName, s.lastName)}
              </div>
              <div className="flex-1 min-w-0">
                {/* Primary line */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {s.firstName} {s.lastName}
                  </h3>
                  {s.attentionReasons.map(reason => (
                    <span
                      key={reason}
                      className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-xs text-gray-600 mt-1">
                  <span>
                    <span className="font-medium text-gray-900">
                      {s.reflectionCoveragePct}%
                    </span>{' '}
                    reflected
                  </span>
                  <span>
                    <span
                      className={
                        s.overdueCount > 0
                          ? 'font-medium text-amber-700'
                          : 'font-medium text-gray-900'
                      }
                    >
                      {s.outstandingCount}/{s.overdueCount}
                    </span>{' '}
                    out/overdue
                  </span>
                  <span>
                    {s.lastActiveDays === null
                      ? 'no activity yet'
                      : `active ${formatDays(s.lastActiveDays)}`}
                  </span>
                </div>
                {/* Secondary line */}
                <div
                  data-row-secondary
                  className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[11px] text-gray-500 mt-1"
                >
                  <span>
                    {s.conversationCount} conversation
                    {s.conversationCount === 1 ? '' : 's'}
                  </span>
                  <span>
                    {s.goalsActive} goal{s.goalsActive === 1 ? '' : 's'}
                    {s.goalsStalled > 0 ? ` · ${s.goalsStalled} stalled` : ''}
                  </span>
                  <span>
                    {s.lastCoachTouchDays === null
                      ? 'no coach note'
                      : `touched ${formatDays(s.lastCoachTouchDays)}`}
                  </span>
                  <span>{trajectoryGlyph(s.trajectory)}</span>
                </div>
              </div>
              <span className="text-gray-400 text-sm shrink-0">→</span>
            </button>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <div className="text-center text-sm text-gray-500 italic py-8">
          No students match this filter.
        </div>
      )}
    </div>
  )
}

function RollupStat({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color?: 'amber'
}) {
  const valueClass = color === 'amber' ? 'text-amber-700' : 'text-gray-900'
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
      <div className={`text-lg font-semibold ${valueClass}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </div>
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
  accent,
}: {
  label: string
  active: boolean
  onClick: () => void
  accent?: 'amber'
}) {
  const activeClass =
    accent === 'amber'
      ? 'bg-amber-700 text-white border-amber-700'
      : 'bg-gray-900 text-white border-gray-900'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? activeClass
          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
      }`}
    >
      {label}
    </button>
  )
}

function initials(first: string, last: string): string {
  return ((first[0] || '') + (last[0] || '')).toUpperCase()
}

function formatDays(days: number): string {
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function trajectoryGlyph(t: 'up' | 'flat' | 'down'): string {
  if (t === 'up') return '↑ trending up'
  if (t === 'down') return '↓ trending down'
  return '→ steady'
}
```

- [ ] **Step 4: Run the test, verify Task 4 passes**

Run: `cd <worktree> && npx tsx scripts/test-coach-caseload-overview.ts`
Expected: PASS — Tasks 1–4 all `✓`; exit 0.

- [ ] **Step 5: Typecheck + lint + commit**

Run: `cd <worktree> && npx tsc --noEmit`
Expected: exit 0.
Run: `cd <worktree> && npx eslint --no-eslintrc --config .eslintrc.json "src/app/v2/(coach)/coach/caseload/CaseloadView.tsx"`
Expected: exit 0, no output.

```bash
git -C <worktree> add "src/app/v2/(coach)/coach/caseload/CaseloadView.tsx" scripts/test-coach-caseload-overview.ts
git -C <worktree> commit -m "feat(caseload): two-line worklist rows + rollup strip"
```

---

### Task 5: Whole-feature verification + manual DoD runbook

**Files:** none modified (verification only).

- [ ] **Step 1: Full structural test green**

Run: `cd <worktree> && npx tsx scripts/test-coach-caseload-overview.ts`
Expected: every section `✓`; final line `N passed, 0 failed`; exit 0.

- [ ] **Step 2: Typecheck (whole project)**

Run: `cd <worktree> && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 3: Lint all changed files**

Run: `cd <worktree> && npx eslint --no-eslintrc --config .eslintrc.json src/lib/types.ts src/lib/queries.ts "src/app/api/coach/students/route.ts" "src/app/v2/(coach)/coach/caseload/CaseloadView.tsx"`
Expected: exit 0, no output.

- [ ] **Step 4: Production build**

Run: `cd <worktree> && npm run build`
Expected: exit 0; build completes (`.env.local` must be present in the worktree — see Pre-flight).

- [ ] **Step 5: Manual DoD runbook (record results in the PR description)**

Verify by hand against the deployed/preview build:
1. Sign in as a real coach → `/v2/coach/caseload` shows the rollup strip (Students / Need attention / With overdue / Median coverage) and two-line rows.
2. Pick one student; spot-check against a direct DB query: reflection coverage = (works with a completed conversation by `work_id`) / (total works); outstanding/overdue = active assignments in enrolled courses minus submitted; `Inactive Nd` matches max(last completed convo, last submission).
3. Only that coach's students appear (no cross-coach leakage); a coach with demo persona sees the populated demo caseload.
4. "Needs attention" filter narrows to flagged rows; "All" restores.
5. Clicking a row navigates to `/v2/coach/<id>` (Prep tab).
6. Narrow the viewport (mobile): the two-line row reflows without horizontal scroll; rollup strip goes 2-up.

- [ ] **Step 6: Commit any runbook notes (if a results file was added); otherwise no-op**

If you recorded a verification note file, commit it; otherwise nothing to commit (verification task).

---

## Self-Review

**1. Spec coverage** — every spec requirement maps to a task:
- Evolve `/v2/coach/caseload` in place → Task 4 (CaseloadView replaced; same route/page).
- All columns v1 (engagement, coverage, goals, out/overdue, last touch, trajectory, attention+reason) + rollup → Task 2 (compute) + Task 4 (render).
- Two-line responsive row, row→Prep, filter preserved → Task 4.
- Live, batched, set-based, frozen typed function, coach-scoped, admin client, no per-student loop → Task 2 (+ Task 1 frozen types; Task 3 server-scoped call).
- No schema/RLS/new API route → Task 3 reuses the existing route; no migration anywhere.
- Coach-first/instructor-aware → Task 1 frozen `CaseloadRow`/`CaseloadRollup`/`CaseloadOverview` documented as the reused contract.
- Error handling: route 401/404 guards preserved (Task 3); empty caseload handled in function + view (Tasks 2, 4); a failed metric does not 500 (each metric defaults: coverage 0, counts 0, trajectory 'flat', touch null) — graceful by construction.
- Testing/DoD: structural test (Tasks 1–4 sections) + gates + manual runbook (Task 5).

**2. Placeholder scan** — no TBD/TODO; every code step shows complete code; commands have exact expected output; no "similar to Task N". The single insertion marker `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<` is an explicit, verbatim mechanism, not a placeholder.

**3. Type consistency** — `CaseloadRow`/`CaseloadRollup`/`CaseloadOverview` defined in Task 1 are used verbatim in Task 2 (`Promise<CaseloadOverview>`, `CaseloadRow[]`, `CaseloadRollup`), Task 3 (`{ rows, rollup }` destructure → `{ students: rows, rollup }`), Task 4 (`import type { CaseloadRow, CaseloadRollup }`, `{ students: CaseloadRow[]; rollup: CaseloadRollup }`). Function name `getCoachCaseloadOverview` and signature `(coachId: string, isDemo = false)` identical across Tasks 2/3 and the Task 2/3 test regexes. Field names (`reflectionCoveragePct`, `outstandingCount`, `overdueCount`, `lastCoachTouchDays`, `attentionReasons`, `trajectory`, `medianReflectionCoveragePct`) consistent across types, function return, view render, and test assertions. `getAdmin()` is the existing queries.ts-local helper (consistent with `getCoachDashboard`). No dangling references.

No issues found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-18-coach-caseload-overview.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, two-stage review (spec-compliance then code-quality) between tasks, fast iteration, in the `.worktrees/coach-caseload-overview` worktree.

**2. Inline Execution** — execute tasks in this session with executing-plans, batched checkpoints.

Which approach?
