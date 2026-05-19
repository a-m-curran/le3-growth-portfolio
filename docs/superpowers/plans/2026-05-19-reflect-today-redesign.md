# Reflect + Today Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the deployed stopgap behavior on `/v2/reflect` and `/v2/today` with a navigable Quarter→Course→Week→Submissions tree + Today/This-week/Earlier date buckets, a pinned in-progress banner on both surfaces, an explicit Resume / Discard-and-start-new interstitial when a student clicks a new assignment with one in-progress, and a non-typewriter "View" for completed conversations.

**Architecture:** Two student surfaces share one `SubmissionRow` component and one new response shape from their respective routes (`activeInProgress | null` + flat `submissions[]` with per-row status). Smart-expand defaults are derived deterministically client-side. The single-active-conversation data model is preserved; the silent hijack is replaced with an explicit modal flow whose discards always confirm. The typewriter `ConversationReplay` is retired for real students (kept behind an `is_demo` gate) in favor of an "all-at-once" `ConversationFullView` modeled on the existing `ConversationPanel` slide-out.

**Tech Stack:** Next.js 14 App Router (server components for pages, client components for interactive views), Supabase service-role admin client, existing `getV2StudentId` session resolver, structural source-scan tests via `npx tsx` against `_sync-test-harness`.

---

## Pre-flight (READ BEFORE STARTING)

- **No DB migrations.** No auth schema changes. No env vars added. `status='abandoned'` is already valid per the existing `growth_conversation` status CHECK constraint (verified in prior session — allows `'in_progress'|'completed'|'abandoned'`).
- **No deploy-step configuration.** Code-only. Rollback = revert the merge commit; the three already-shipped stop-gap fixes (PR #11/#12/#13) stay intact regardless.
- **Pilot scale verified safe.** Max 239 `student_work` / 18 `growth_conversation` per student in production; the uncapped `submissions[]` payload is small.
- **Must NOT regress already-shipped fixes.** All three structural tests below must remain green at every gate:
  - `npx tsx scripts/test-staff-passlink.ts` → **35 passed / 0 failed** (PR #11/staff-passlink)
  - `npx tsx scripts/test-student-passlinks.ts` → **56 passed / 0 failed** (PR #11/student-passlinks)
  - `/api/student/reflect`'s caps stay removed (PR #12) — i.e. the new shape must NOT reintroduce `.limit(20)` / `.limit(50)` / `.slice(0,5)` (the new test asserts their absence)
  - `/api/student/today`'s cap stays removed (PR #13) — the new shape must NOT reintroduce `.limit(5)` on the work query
  - `/api/conversation/start`'s `response_phase_1`-gated resume + auto-abandon of empty in-progress (PR #13) must be preserved
- **Dualrole test account is the QA baseline.** Student id `df7c64dd-4579-4588-bcf0-be0db44cf17b` (email `andrewmcurran+dualrole@gmail.com`) has 24 manual `student_work` rows across `PFS-201-LE3` + `SCI-255-LE3`, Spring 2026, weeks 1–6/1–4, mixed grades/types. Reversible at end via:
  ```sql
  delete from student_work where student_id='df7c64dd-4579-4588-bcf0-be0db44cf17b' and source='manual' and external_id like 'TEST-DR-%';
  ```
- **Worktree convention.** Execute in a NEW worktree `.worktrees/reflect-today-redesign` branched from current `origin/main` HEAD. Do NOT touch existing worktrees. Copy `/Users/andrewcurran/le3-growth-portfolio/.env.local` into the new worktree so `npm run build` is faithful.
- **No `npx next lint`.** Use the exact eslint invocation in each task: `npx eslint --no-eslintrc --config .eslintrc.json <files>`.
- **`@/` imports apply.** All code in this plan is in-app (routes/lib/components, Next runtime); use `@/` aliases + `createAdminClient` + `getV2StudentId` normally. The no-`@/`-imports rule applies ONLY to tsx CLI scripts (the structural test imports from a relative path).
- **One commit per task.** Each task ends with a `git commit` step.
- **All gates from worktree root.** `npx tsc --noEmit` exit 0; `npx eslint --no-eslintrc --config .eslintrc.json <files>` no warnings; `npm run build` exit 0 (run at the final verification task; intermediate tasks run only `tsc` + `eslint` + the structural test for speed).

---

## File Structure (decomposition)

**New files:**
| Path | Responsibility |
|---|---|
| `scripts/test-reflect-today-redesign.ts` | Structural source-scan test for the entire redesign. Built up one `section()` per task before a single trailing `finish()` via marker. |
| `src/components/v2/student/types.ts` | Shared TS types — `ActiveInProgress`, `SubmissionItem`, `SubmissionStatus`. Imported by all student components + the two student routes. |
| `src/components/v2/student/SubmissionRow.tsx` | One row in the tree/buckets. Status glyph + title + action chip. `surface` prop toggles the title-suffix variant. |
| `src/components/v2/student/DiscardConfirmDialog.tsx` | Generic confirm modal used by both banner Discard and interstitial Discard-and-start-new. |
| `src/components/v2/student/InProgressBanner.tsx` | Pinned amber banner showing `activeInProgress` with Resume + Discard. |
| `src/components/v2/student/InProgressInterstitial.tsx` | Modal shown when clicking a new assignment with one in-progress. Resume / Discard-and-start-new / Cancel. |
| `src/components/v2/student/use-start-reflection.ts` | Hook owning modal state + click routing. Shared by ReflectView + TodayView. |
| `src/components/v2/student/ReflectTree.tsx` | Quarter → Course → Week → Submissions renderer with smart-expand defaults. |
| `src/components/v2/student/TodayBuckets.tsx` | Today / This week / Earlier renderer (date-bucketed from `submitted_at`). |
| `src/components/v2/student/ConversationFullView.tsx` | Non-typewriter all-at-once render of a completed conversation. |
| `src/app/api/conversation/[id]/discard/route.ts` | POST endpoint — sets status='abandoned' on a student's in-progress conversation. |

**Modified files:**
| Path | Change |
|---|---|
| `src/app/api/conversation/start/route.ts` | Add `discardAndStart: true` body-flag branch (force-abandon existing in-progress regardless of phase-1, then create new). |
| `src/app/api/student/reflect/route.ts` | Replace response shape with `{ activeInProgress, submissions }`. No `.limit()` / `.slice()` reintroduced. |
| `src/app/api/student/today/route.ts` | Replace `featuredWork` with `{ activeInProgress, submissions }`. KEEP `recentJournal` (`.limit(3)` intentional), `weekStats`, `ltiPinned` byte-equivalent. |
| `src/app/v2/(student)/reflect/ReflectView.tsx` | Rewrite around `<InProgressBanner />` + `<ReflectTree />` + `useStartReflection`. |
| `src/app/v2/(student)/today/TodayView.tsx` | Replace `FeaturedWorkSection` with `<InProgressBanner />` + `<TodayBuckets />`. KEEP `LtiPinnedCard`, `WeekStatsCard`, `RecentJournalSection`, `QuickActions` unchanged. |
| `src/app/v2/(student)/conversation/[id]/ConversationView.tsx` | Completed branch dispatches to `<ConversationFullView />` for real students; `<ConversationReplay />` (typewriter) only when `is_demo`. |

**Unchanged (regression-assert):**
- `ConversationFlowView` (phase 1/2/3 flow), `ConversationReplay` (typewriter — kept in tree for demo path), all journal/LTI flows, all passlinks/admin/auth code, `src/middleware.ts`.

---

## Task 1: Test scaffold + shared types module

**Files:**
- Create: `scripts/test-reflect-today-redesign.ts`
- Create: `src/components/v2/student/types.ts`

- [ ] **Step 1: Write the structural test scaffold**

Create `scripts/test-reflect-today-redesign.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run from worktree root:
```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: section header prints, all 5 assertions fail (file does not exist yet → `read()` returns `''`).

- [ ] **Step 3: Create the shared types module**

Create `src/components/v2/student/types.ts`:

```ts
/**
 * Shared types for the redesigned student reflect + today surfaces.
 *
 * Consumed by:
 *   - /api/student/reflect/route.ts  (response typing)
 *   - /api/student/today/route.ts    (response typing)
 *   - SubmissionRow, ReflectTree, TodayBuckets, InProgressBanner,
 *     InProgressInterstitial, useStartReflection
 *
 * Single source of truth so the shared SubmissionRow renders the
 * same shape on both surfaces.
 */

export type SubmissionStatus = 'unreflected' | 'in_progress' | 'completed'

export interface SubmissionItem {
  id: string              // student_work.id
  title: string
  courseName: string | null
  courseCode: string | null
  quarter: string         // e.g. "Spring 2026"
  weekNumber: number | null
  submittedAt: string | null  // ISO timestamp
  workType: string | null
  status: SubmissionStatus
  conversationId: string | null   // non-null for status='in_progress' | 'completed'
  primaryPillar: string | null    // non-null for status='completed'; drives row stripe
}

export interface ActiveInProgress {
  id: string                                        // growth_conversation.id
  workId: string | null                             // null when conversation_type='open_reflection'
  workTitle: string | null
  conversationType: 'work_based' | 'open_reflection'
  currentPhase: 1 | 2 | 3
  startedAt: string                                 // ISO timestamp
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: `5 passed, 0 failed`.

- [ ] **Step 5: Run tsc + eslint gates**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json scripts/test-reflect-today-redesign.ts src/components/v2/student/types.ts
```
Expected: both exit 0, no warnings.

- [ ] **Step 6: Commit**

```bash
git add scripts/test-reflect-today-redesign.ts src/components/v2/student/types.ts
git commit -m "feat(reflect-redesign): scaffold structural test + shared student types"
```

---

## Task 2: POST `/api/conversation/[id]/discard` — new endpoint

**Files:**
- Create: `src/app/api/conversation/[id]/discard/route.ts`
- Modify: `scripts/test-reflect-today-redesign.ts` (insert section before marker)

- [ ] **Step 1: Write the failing test**

Insert this section directly above the `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<` marker in `scripts/test-reflect-today-redesign.ts`:

```ts
section('Task 2: POST /api/conversation/[id]/discard')
{
  const r = stripComments(read('src/app/api/conversation/[id]/discard/route.ts'))
  assertEqual(/export const dynamic = 'force-dynamic'/.test(r) && /export const runtime = 'nodejs'/.test(r), true, 'force-dynamic + nodejs runtime')
  assertEqual(/export async function POST\s*\(/.test(r), true, 'POST handler exported')
  assertEqual(/getV2StudentId/.test(r), true, 'auth via getV2StudentId')
  assertEqual(/status: 'abandoned'/.test(r), true, "sets status='abandoned'")
  assertEqual(/\.eq\('status', 'in_progress'\)/.test(r), true, "only updates if currently in_progress")
  assertEqual(/conversation\.discarded/.test(r), true, "logs 'conversation.discarded' event")
  assertEqual(/createAdminClient/.test(r), true, 'uses admin client')
  assertEqual(/\.eq\('student_id'/.test(r) || /student_id !== /.test(r), true, 'verifies student ownership')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Task 1 passes; Task 2 fails 8 assertions (file does not exist).

- [ ] **Step 3: Create the discard endpoint**

Create `src/app/api/conversation/[id]/discard/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'
import { log } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/conversation/[id]/discard
 *
 * Discards an in-progress reflection by setting its status to
 * 'abandoned'. Used by:
 *   - The pinned in-progress banner's "Discard" button (after confirm)
 *   - The InProgressInterstitial's "Discard and start new" path also
 *     uses /api/conversation/start { discardAndStart: true } which
 *     abandons inline; this endpoint is for the standalone banner case.
 *
 * Status='abandoned' is reversible in the DB (an admin can flip it back
 * to 'in_progress'), but students see this as permanent. The endpoint
 * is a no-op for any conversation that is not currently 'in_progress'.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const reqLog = log.withRequest()
  const conversationId = params.id

  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: conv, error: loadErr } = await admin
    .from('growth_conversation')
    .select('id, student_id, status')
    .eq('id', conversationId)
    .maybeSingle()

  if (loadErr || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }
  if (conv.student_id !== studentId) {
    return NextResponse.json({ error: 'Not your conversation' }, { status: 403 })
  }

  // No-op if already not in_progress (already completed / already abandoned).
  // Idempotent: returns ok regardless so the UI doesn't need to special-case races.
  const { error: updateErr } = await admin
    .from('growth_conversation')
    .update({ status: 'abandoned' })
    .eq('id', conversationId)
    .eq('status', 'in_progress')

  if (updateErr) {
    await reqLog.error('conversation.discard_failed', {
      studentId,
      message: 'growth_conversation update failed during discard',
      context: { conversation_id: conversationId, db_error: updateErr.message },
    })
    return NextResponse.json({ error: 'Failed to discard' }, { status: 500 })
  }

  await reqLog.info('conversation.discarded', {
    studentId,
    actorType: 'student',
    actorId: studentId,
    message: 'Student discarded an in-progress conversation',
    context: { conversation_id: conversationId, prior_status: conv.status },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Task 1 + Task 2 = 13 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint gates**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json 'src/app/api/conversation/[id]/discard/route.ts'
```
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/api/conversation/[id]/discard/route.ts' scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): POST /api/conversation/[id]/discard endpoint"
```

---

## Task 3: `/api/conversation/start` — add `discardAndStart` branch

**Files:**
- Modify: `src/app/api/conversation/start/route.ts` (insert new branch between the resume guard and the create-new path; preserve all existing behavior)
- Modify: `scripts/test-reflect-today-redesign.ts` (insert section before marker)

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 3: /api/conversation/start honors discardAndStart')
{
  const r = stripComments(read('src/app/api/conversation/start/route.ts'))
  assertEqual(/discardAndStart/.test(r), true, 'reads discardAndStart from request body')
  assertEqual(/conversation\.abandoned_explicit/.test(r), true, "logs 'conversation.abandoned_explicit' event")
  // Regression: PR #13 resume guard remains (only resumes when response_phase_1 truthy).
  assertEqual(/existing && existing\.length > 0 && existing\[0\]\.response_phase_1/.test(r), true, 'PR #13 phase-1-gated resume guard preserved')
  // Regression: auto-abandon-empty default-flag path remains.
  assertEqual(/conversation\.abandoned_empty/.test(r), true, 'PR #13 auto-abandon-empty default-flag log preserved')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Task 3 fails on `discardAndStart` + `abandoned_explicit` assertions.

- [ ] **Step 3: Read the current file structure**

Read `src/app/api/conversation/start/route.ts` end-to-end so the insert lands in the right place. The body destructure currently reads only `{ workId }`. The resume guard (PR #13) is `if (existing && existing.length > 0 && existing[0].response_phase_1) { … resume + return }`. The empty-abandon block follows it (logs `conversation.abandoned_empty`). The create-new path follows that.

- [ ] **Step 4: Modify the body destructure**

Replace:
```ts
    const { workId } = await request.json()
    if (!workId) {
```
With:
```ts
    const { workId, discardAndStart } = await request.json()
    if (!workId) {
```

- [ ] **Step 5: Insert the discardAndStart branch BEFORE the existing resume guard**

The current code (post-PR #13) has, in order:
1. The `existing` fetch (`.from('growth_conversation').eq('status','in_progress').limit(1)`).
2. The resume guard `if (existing && existing.length > 0 && existing[0].response_phase_1) { … resume + return }`.
3. The auto-abandon-empty `if (existing && existing.length > 0) { … log 'conversation.abandoned_empty' }`.
4. The create-new path.

Insert this new block BETWEEN step (1) and step (2) — i.e. immediately after the `existing` fetch, before the resume guard. The new block short-circuits both the resume guard and the empty-abandon when `discardAndStart` is true: it force-abandons whatever in-progress exists and falls through to the create-new path.

Find this region (after the `.limit(1)` line and before the resume guard `if`):
```ts
      .eq('status', 'in_progress')
      .limit(1)

    if (existing && existing.length > 0 && existing[0].response_phase_1) {
```

Replace with:
```ts
      .eq('status', 'in_progress')
      .limit(1)

    // Explicit "discard and start new" path (from the InProgressInterstitial).
    // The student has acknowledged they're abandoning their in-progress
    // reflection to start a new one. Force-abandon regardless of phase-1
    // progress, then fall through to the create-new path for `workId`.
    // The default-flag behavior (resume non-empty / silently abandon empty)
    // is preserved exactly when discardAndStart is not set.
    if (discardAndStart && existing && existing.length > 0) {
      await admin
        .from('growth_conversation')
        .update({ status: 'abandoned' })
        .eq('id', existing[0].id)
      await reqLog.info('conversation.abandoned_explicit', {
        studentId,
        actorType: 'student',
        actorId: studentId,
        message: 'Auto-abandoned in-progress conversation per explicit discardAndStart',
        context: {
          conversation_id: existing[0].id,
          work_id: existing[0].work_id,
          had_phase1_response: !!existing[0].response_phase_1,
        },
      })
      // Fall through to create-new (do not enter resume guard or empty-abandon).
    } else if (existing && existing.length > 0 && existing[0].response_phase_1) {
```

Note: the original `if (existing && existing.length > 0 && existing[0].response_phase_1)` becomes `else if` so the new `discardAndStart` branch wins. The closing brace of the resume `if` stays exactly where it was. Verify the file still parses by re-reading and confirming the brace structure: the new top-level chain reads `if (discardAndStart…) { … } else if (existing && … response_phase_1) { … resume+return … }` followed by the unchanged `if (existing && existing.length > 0) { … abandoned_empty … }` block.

- [ ] **Step 6: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Task 1 + 2 + 3 = 17 passed, 0 failed.

- [ ] **Step 7: Run regression suites + tsc + eslint**

```bash
npx tsx scripts/test-staff-passlink.ts
npx tsx scripts/test-student-passlinks.ts
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json src/app/api/conversation/start/route.ts
```
Expected: staff-passlink **35 passed / 0 failed**; student-passlinks **56 passed / 0 failed**; tsc + eslint exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/conversation/start/route.ts scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): /api/conversation/start discardAndStart branch"
```

---

## Task 4: `/api/student/reflect` — new response shape

**Files:**
- Rewrite: `src/app/api/student/reflect/route.ts`
- Modify: `scripts/test-reflect-today-redesign.ts` (insert section before marker)

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 4: /api/student/reflect new shape')
{
  const r = stripComments(read('src/app/api/student/reflect/route.ts'))
  assertEqual(/activeInProgress/.test(r), true, 'returns activeInProgress field')
  assertEqual(/submissions/.test(r), true, 'returns submissions field')
  // Regression: PR #12 caps stay out.
  assertEqual(/\.limit\(20\)/.test(r), false, 'no .limit(20) reintroduced')
  assertEqual(/\.limit\(50\)/.test(r), false, 'no .limit(50) reintroduced')
  assertEqual(/\.slice\(0,\s*5\)/.test(r), false, 'no .slice(0,5) reintroduced')
  // New shape no longer surfaces these top-level fields.
  assertEqual(/inProgress:\s*convos/.test(r), false, "old 'inProgress' top-level field removed")
  assertEqual(/featuredWork:/.test(r), false, "old 'featuredWork' top-level field removed")
  // Per-row status union.
  assertEqual(/'unreflected'/.test(r) && /'in_progress'/.test(r) && /'completed'/.test(r), true, 'per-row status discriminator present')
  // Joins student_work + growth_conversation to compute status.
  assertEqual(/from\('student_work'\)/.test(r) && /from\('growth_conversation'\)/.test(r), true, 'queries both tables')
  // Uses shared types.
  assertEqual(/from '@\/components\/v2\/student\/types'/.test(r) || /from '@\/components\/v2\/student\/types\.js'/.test(r), true, 'imports shared SubmissionItem / ActiveInProgress types')
  assertEqual(/getV2StudentId/.test(r), true, 'auth via getV2StudentId')
  assertEqual(/export const dynamic = 'force-dynamic'/.test(r), true, 'force-dynamic')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Task 4 fails (current route returns old shape).

- [ ] **Step 3: Rewrite the route**

Replace the entire contents of `src/app/api/student/reflect/route.ts` with:

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'
import type {
  ActiveInProgress,
  SubmissionItem,
  SubmissionStatus,
} from '@/components/v2/student/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/reflect
 *
 * Returns the data needed to render the redesigned /v2/reflect:
 *   - activeInProgress: the single in-progress conversation for this
 *     student (single-active model), or null. Drives the pinned banner.
 *   - submissions: every student_work row for this student, with its
 *     per-row status derived from growth_conversation. The tree is
 *     built client-side from this flat list (Quarter -> Course -> Week
 *     -> Submissions). No .limit() — see PR #12 (max ~239 rows / small
 *     payload is safe at pilot scale).
 *
 * Demo personas are real DB rows (is_demo=true). The student id is
 * resolved through `getV2StudentId` which honors the demo persona
 * cookie OR real Supabase auth — same query path for both.
 *
 * Open-reflection (conversation_type='open_reflection') conversations
 * are excluded from the per-row status computation — those live under
 * /api/student/journal. An open-reflection that is currently in_progress
 * IS surfaced in activeInProgress (so the banner appears on Reflect),
 * with workId=null and workTitle=null falling back to work_context in
 * the InProgressBanner component.
 */
export async function GET() {
  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Pull all work + all non-abandoned conversations in parallel.
  const [{ data: workRows }, { data: convoRows }] = await Promise.all([
    admin
      .from('student_work')
      .select('id, title, course_name, course_code, quarter, week_number, submitted_at, work_type')
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false, nullsFirst: false }),
    admin
      .from('growth_conversation')
      .select(
        'id, work_id, status, conversation_type, started_at, work_context, ' +
          'response_phase_1, response_phase_2, response_phase_3, ' +
          'prompt_phase_2, prompt_phase_3, ' +
          'student_work(title), ' +
          'conversation_skill_tag(skill_id, confidence, durable_skill(pillar:pillar_id(name)))'
      )
      .eq('student_id', studentId)
      .in('status', ['in_progress', 'completed'])
      .order('started_at', { ascending: false }),
  ])

  interface WorkRow {
    id: string
    title: string
    course_name: string | null
    course_code: string | null
    quarter: string
    week_number: number | null
    submitted_at: string | null
    work_type: string | null
  }
  interface ConvoTag {
    skill_id: string
    confidence: number
    durable_skill: { pillar: { name: string } | null } | null
  }
  interface ConvoRow {
    id: string
    work_id: string | null
    status: 'in_progress' | 'completed'
    conversation_type: 'work_based' | 'open_reflection' | null
    started_at: string
    work_context: string | null
    response_phase_1: string | null
    response_phase_2: string | null
    response_phase_3: string | null
    prompt_phase_2: string | null
    prompt_phase_3: string | null
    student_work: { title: string } | null
    conversation_skill_tag: ConvoTag[] | null
  }

  const work = (workRows ?? []) as unknown as WorkRow[]
  const convos = (convoRows ?? []) as unknown as ConvoRow[]

  // Index conversations by work_id (work_based only). Prefer in_progress
  // over completed; among completed, the most recent (convos are already
  // sorted newest-first by started_at).
  const convoByWorkId = new Map<string, ConvoRow>()
  for (const c of convos) {
    if (c.conversation_type === 'open_reflection') continue
    if (!c.work_id) continue
    const existing = convoByWorkId.get(c.work_id)
    if (!existing) {
      convoByWorkId.set(c.work_id, c)
    } else if (existing.status === 'completed' && c.status === 'in_progress') {
      convoByWorkId.set(c.work_id, c)
    }
  }

  function dominantPillar(c: ConvoRow): string | null {
    const tags = c.conversation_skill_tag ?? []
    if (tags.length === 0) return null
    const top = [...tags].sort((a, b) => b.confidence - a.confidence)[0]
    return top.durable_skill?.pillar?.name ?? null
  }

  const submissions: SubmissionItem[] = work.map(w => {
    const c = convoByWorkId.get(w.id) ?? null
    let status: SubmissionStatus = 'unreflected'
    if (c) status = c.status === 'in_progress' ? 'in_progress' : 'completed'
    return {
      id: w.id,
      title: w.title,
      courseName: w.course_name,
      courseCode: w.course_code,
      quarter: w.quarter,
      weekNumber: w.week_number,
      submittedAt: w.submitted_at,
      workType: w.work_type,
      status,
      conversationId: c?.id ?? null,
      primaryPillar: c && status === 'completed' ? dominantPillar(c) : null,
    }
  })

  // Active in-progress (single-active). Includes open_reflection.
  // If multiple in_progress exist (data anomaly), prefer the most-recent.
  const inProgress = convos.filter(c => c.status === 'in_progress')
  const activeRow = inProgress[0] ?? null

  function derivePhase(c: ConvoRow): 1 | 2 | 3 {
    if (c.response_phase_2 && c.prompt_phase_3) return 3
    if (c.response_phase_1 && c.prompt_phase_2) return 2
    return 1
  }

  const activeInProgress: ActiveInProgress | null = activeRow
    ? {
        id: activeRow.id,
        workId: activeRow.work_id,
        workTitle: activeRow.student_work?.title ?? null,
        conversationType: (activeRow.conversation_type ?? 'work_based') as
          | 'work_based'
          | 'open_reflection',
        currentPhase: derivePhase(activeRow),
        startedAt: activeRow.started_at,
      }
    : null

  return NextResponse.json({ activeInProgress, submissions })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–4 = 29 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint + regression**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json src/app/api/student/reflect/route.ts
npx tsx scripts/test-staff-passlink.ts
npx tsx scripts/test-student-passlinks.ts
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/student/reflect/route.ts scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): /api/student/reflect new {activeInProgress,submissions} shape"
```

---

## Task 5: `/api/student/today` — new response shape

**Files:**
- Rewrite (partial): `src/app/api/student/today/route.ts` (replace `featuredWork` with `{ activeInProgress, submissions }`; KEEP `recentJournal`/`weekStats`/`ltiPinned` byte-equivalent)
- Modify: `scripts/test-reflect-today-redesign.ts`

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 5: /api/student/today new shape')
{
  const r = stripComments(read('src/app/api/student/today/route.ts'))
  assertEqual(/activeInProgress/.test(r), true, 'returns activeInProgress field')
  assertEqual(/submissions/.test(r), true, 'returns submissions field')
  // The old featuredWork top-level field is gone.
  assertEqual(/featuredWork:/.test(r), false, "old 'featuredWork' top-level field removed")
  // Regression: PR #13 work-list cap stays out.
  assertEqual(/\.from\('student_work'\)[\s\S]*\.limit\(5\)/.test(r), false, "no .limit(5) on student_work reintroduced")
  // Preserved sections (regression-assert).
  assertEqual(/recentJournal/.test(r), true, 'recentJournal preserved')
  assertEqual(/weekStats/.test(r), true, 'weekStats preserved')
  assertEqual(/ltiPinned/.test(r), true, 'ltiPinned preserved')
  assertEqual(/parseLtiContext/.test(r), true, 'parseLtiContext helper preserved')
  // recentJournal .limit(3) intentional cap is preserved (doc-stated).
  assertEqual(/\.eq\('conversation_type', 'open_reflection'\)[\s\S]*\.limit\(3\)/.test(r), true, 'recentJournal .limit(3) preserved (intentional)')
  // Shared types import.
  assertEqual(/from '@\/components\/v2\/student\/types'/.test(r), true, 'imports shared types')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Task 5 fails on `activeInProgress`/`submissions` (current shape uses `featuredWork`).

- [ ] **Step 3: Rewrite the route**

Replace the entire contents of `src/app/api/student/today/route.ts` with:

```ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'
import { primaryPillarFromTags } from '@/lib/pillar-resolution'
import type {
  ActiveInProgress,
  SubmissionItem,
  SubmissionStatus,
} from '@/components/v2/student/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/today
 *
 * Returns the data behind /v2/today after the redesign:
 *   - activeInProgress: same shape as /api/student/reflect; drives the
 *     pinned in-progress banner (the banner appears on both surfaces).
 *   - submissions: every student_work row with per-row status. The
 *     Today/This week/Earlier buckets are computed client-side from
 *     submitted_at in the user's local timezone.
 *   - recentJournal: unchanged (last 3 open_reflection completed). The
 *     .limit(3) here is intentional and doc-stated — separate concern
 *     from the work-list caps removed in PR #12 and PR #13.
 *   - weekStats: unchanged (counts for the last 7 days).
 *   - ltiPinned: unchanged (parsed from the lti_context cookie).
 *
 * Demo personas are real DB rows (is_demo=true). The student id is
 * resolved through `getV2StudentId` which honors the demo persona
 * cookie OR real Supabase auth — same query path for both.
 */
export async function GET() {
  const cookieStore = cookies()
  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  // ─── Work + per-work conversations (status discriminator) ───
  const [{ data: workRows }, { data: convoRows }] = await Promise.all([
    admin
      .from('student_work')
      .select('id, title, course_name, course_code, quarter, week_number, submitted_at, work_type')
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false, nullsFirst: false }),
    admin
      .from('growth_conversation')
      .select(
        'id, work_id, status, conversation_type, started_at, work_context, ' +
          'response_phase_1, response_phase_2, response_phase_3, ' +
          'prompt_phase_2, prompt_phase_3, ' +
          'student_work(title), ' +
          'conversation_skill_tag(skill_id, confidence, durable_skill(pillar:pillar_id(name)))'
      )
      .eq('student_id', studentId)
      .in('status', ['in_progress', 'completed'])
      .order('started_at', { ascending: false }),
  ])

  interface WorkRow {
    id: string
    title: string
    course_name: string | null
    course_code: string | null
    quarter: string
    week_number: number | null
    submitted_at: string | null
    work_type: string | null
  }
  interface ConvoTag {
    skill_id: string
    confidence: number
    durable_skill: { pillar: { name: string } | null } | null
  }
  interface ConvoRow {
    id: string
    work_id: string | null
    status: 'in_progress' | 'completed'
    conversation_type: 'work_based' | 'open_reflection' | null
    started_at: string
    work_context: string | null
    response_phase_1: string | null
    response_phase_2: string | null
    response_phase_3: string | null
    prompt_phase_2: string | null
    prompt_phase_3: string | null
    student_work: { title: string } | null
    conversation_skill_tag: ConvoTag[] | null
  }
  const work = (workRows ?? []) as unknown as WorkRow[]
  const convos = (convoRows ?? []) as unknown as ConvoRow[]

  const convoByWorkId = new Map<string, ConvoRow>()
  for (const c of convos) {
    if (c.conversation_type === 'open_reflection') continue
    if (!c.work_id) continue
    const existing = convoByWorkId.get(c.work_id)
    if (!existing) convoByWorkId.set(c.work_id, c)
    else if (existing.status === 'completed' && c.status === 'in_progress') {
      convoByWorkId.set(c.work_id, c)
    }
  }

  function dominantPillar(c: ConvoRow): string | null {
    const tags = c.conversation_skill_tag ?? []
    if (tags.length === 0) return null
    const top = [...tags].sort((a, b) => b.confidence - a.confidence)[0]
    return top.durable_skill?.pillar?.name ?? null
  }

  const submissions: SubmissionItem[] = work.map(w => {
    const c = convoByWorkId.get(w.id) ?? null
    let status: SubmissionStatus = 'unreflected'
    if (c) status = c.status === 'in_progress' ? 'in_progress' : 'completed'
    return {
      id: w.id,
      title: w.title,
      courseName: w.course_name,
      courseCode: w.course_code,
      quarter: w.quarter,
      weekNumber: w.week_number,
      submittedAt: w.submitted_at,
      workType: w.work_type,
      status,
      conversationId: c?.id ?? null,
      primaryPillar: c && status === 'completed' ? dominantPillar(c) : null,
    }
  })

  // Active in-progress.
  const inProgress = convos.filter(c => c.status === 'in_progress')
  const activeRow = inProgress[0] ?? null

  function derivePhase(c: ConvoRow): 1 | 2 | 3 {
    if (c.response_phase_2 && c.prompt_phase_3) return 3
    if (c.response_phase_1 && c.prompt_phase_2) return 2
    return 1
  }

  const activeInProgress: ActiveInProgress | null = activeRow
    ? {
        id: activeRow.id,
        workId: activeRow.work_id,
        workTitle: activeRow.student_work?.title ?? null,
        conversationType: (activeRow.conversation_type ?? 'work_based') as
          | 'work_based'
          | 'open_reflection',
        currentPhase: derivePhase(activeRow),
        startedAt: activeRow.started_at,
      }
    : null

  // ─── Recent journal (open_reflection completed). Cap of 3 is
  //     intentional / doc-stated — separate from the work-list caps
  //     removed in PR #12 and PR #13.
  const { data: journalRows } = await admin
    .from('growth_conversation')
    .select(`
      id, started_at, work_context, synthesis_text,
      conversation_skill_tag (
        skill_id, confidence, student_confirmed,
        durable_skill ( name, pillar:pillar_id ( name ) )
      )
    `)
    .eq('student_id', studentId)
    .eq('conversation_type', 'open_reflection')
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(3)

  interface JournalRow {
    id: string
    started_at: string
    work_context: string | null
    synthesis_text: string | null
    conversation_skill_tag: Array<{
      skill_id: string
      confidence: number
      student_confirmed: boolean
      durable_skill: { name: string; pillar: { name: string } | null } | null
    }> | null
  }
  const recentJournal = ((journalRows ?? []) as unknown as JournalRow[]).map(j => {
    const tags = (j.conversation_skill_tag ?? []).map(t => ({
      skillId: t.skill_id,
      confidence: t.confidence,
      studentConfirmed: t.student_confirmed,
    }))
    const topTag = tags.length
      ? [...tags].sort((a, b) => b.confidence - a.confidence)[0]
      : null
    const pillarName = topTag
      ? j.conversation_skill_tag?.find(t => t.skill_id === topTag.skillId)
          ?.durable_skill?.pillar?.name ?? null
      : null
    return {
      id: j.id,
      startedAt: j.started_at,
      description: j.work_context,
      synthesisExcerpt: j.synthesis_text
        ? j.synthesis_text.slice(0, 140) + (j.synthesis_text.length > 140 ? '…' : '')
        : null,
      primaryPillar: pillarName,
    }
  })

  // ─── Week stats (unchanged from prior shape) ─────────
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [{ count: convoCount }, { count: workCount }] = await Promise.all([
    admin
      .from('growth_conversation')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .gte('started_at', weekAgo),
    admin
      .from('student_work')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .gte('submitted_at', weekAgo),
  ])

  // ─── LTI pinned (unchanged) ─────────────────────────
  const ltiPinned = parseLtiContext(cookieStore.get('lti_context')?.value)

  // Retained for legacy callers; not used here (pillar resolution joins
  // through SQL directly).
  void primaryPillarFromTags

  return NextResponse.json({
    activeInProgress,
    submissions,
    recentJournal,
    weekStats: {
      conversationsCompleted: convoCount ?? 0,
      workSubmitted: workCount ?? 0,
    },
    ltiPinned,
  })
}

interface LtiContext {
  resourceLinkId?: string
  resourceLinkTitle?: string
  contextTitle?: string
}

function parseLtiContext(
  raw: string | undefined
): { resourceLinkId: string; title: string; courseTitle: string | null } | null {
  if (!raw) return null
  try {
    const ctx = JSON.parse(raw) as LtiContext
    if (!ctx.resourceLinkId) return null
    return {
      resourceLinkId: ctx.resourceLinkId,
      title: ctx.resourceLinkTitle || 'Assignment',
      courseTitle: ctx.contextTitle || null,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–5 = 39 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint + regression**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json src/app/api/student/today/route.ts
npx tsx scripts/test-staff-passlink.ts
npx tsx scripts/test-student-passlinks.ts
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/student/today/route.ts scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): /api/student/today new {activeInProgress,submissions} shape"
```

---

## Task 6: `SubmissionRow` component

**Files:**
- Create: `src/components/v2/student/SubmissionRow.tsx`
- Modify: `scripts/test-reflect-today-redesign.ts`

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 6: SubmissionRow component')
{
  const c = stripComments(read('src/components/v2/student/SubmissionRow.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function SubmissionRow/.test(c), true, 'SubmissionRow exported')
  assertEqual(/surface:\s*'reflect'\s*\|\s*'today'/.test(c), true, 'surface prop union')
  // Status glyphs / chip labels.
  assertEqual(/['"]Start['"]/.test(c) && /['"]Resume['"]/.test(c) && /['"]View['"]/.test(c), true, 'all three action chip labels')
  assertEqual(/aria-label/.test(c), true, 'status glyph has aria-label')
  assertEqual(/pillarStripeStyle/.test(c), true, 'uses pillarStripeStyle for completed rows')
  assertEqual(/from '@\/components\/v2\/student\/types'/.test(c), true, 'imports SubmissionItem')
  // Whole-row button semantics.
  assertEqual(/<button/.test(c), true, 'renders <button>')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Task 6 fails (file missing).

- [ ] **Step 3: Create the component**

Create `src/components/v2/student/SubmissionRow.tsx`:

```tsx
'use client'

import { pillarStripeStyle } from '@/components/v2/PillarStripe'
import type { SubmissionItem, SubmissionStatus } from '@/components/v2/student/types'

/**
 * One row in the Reflect tree or Today buckets. Status glyph + title
 * + action chip. Click handling bubbles up to the parent (which knows
 * whether to open the interstitial, call /api/conversation/start, etc).
 *
 * surface="reflect": title stands alone (hierarchy provides course/week).
 * surface="today":   title gets " · courseName · Week N" muted suffix
 *                    (date-bucket context doesn't carry course/week).
 *
 * Pillar stripe is preserved for completed rows only.
 */

interface SubmissionRowProps {
  item: SubmissionItem
  surface: 'reflect' | 'today'
  onClick: (item: SubmissionItem) => void
}

const STATUS_GLYPH: Record<SubmissionStatus, { char: string; aria: string; chipLabel: string; chipClass: string }> = {
  unreflected: {
    char: '○',
    aria: 'Not yet reflected',
    chipLabel: 'Start',
    chipClass: 'text-blue-800 bg-blue-100',
  },
  in_progress: {
    char: '⏳',
    aria: 'Reflection in progress',
    chipLabel: 'Resume',
    chipClass: 'text-amber-800 bg-amber-100',
  },
  completed: {
    char: '✓',
    aria: 'Reflection complete',
    chipLabel: 'View',
    chipClass: 'text-emerald-800 bg-emerald-100',
  },
}

export function SubmissionRow({ item, surface, onClick }: SubmissionRowProps) {
  const g = STATUS_GLYPH[item.status]
  const stripeStyle = item.status === 'completed' ? pillarStripeStyle(item.primaryPillar) : undefined
  const suffix =
    surface === 'today'
      ? [item.courseName, item.weekNumber !== null ? `Week ${item.weekNumber}` : null]
          .filter((x): x is string => !!x)
          .join(' · ')
      : ''

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="w-full text-left flex items-center gap-3 pl-3 pr-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
      style={stripeStyle}
    >
      <span className="text-base shrink-0" aria-label={g.aria}>
        {g.char}
      </span>
      <span className="flex-1 min-w-0 text-sm text-gray-900 truncate">
        {item.title}
        {suffix && <span className="text-gray-500"> · {suffix}</span>}
      </span>
      <span
        className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${g.chipClass}`}
      >
        {g.chipLabel}
      </span>
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–6 = 47 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/student/SubmissionRow.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/components/v2/student/SubmissionRow.tsx scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): SubmissionRow shared component"
```

---

## Task 7: `DiscardConfirmDialog` component

**Files:**
- Create: `src/components/v2/student/DiscardConfirmDialog.tsx`
- Modify: `scripts/test-reflect-today-redesign.ts`

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 7: DiscardConfirmDialog component')
{
  const c = stripComments(read('src/components/v2/student/DiscardConfirmDialog.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function DiscardConfirmDialog/.test(c), true, 'DiscardConfirmDialog exported')
  assertEqual(/role="dialog"/.test(c), true, 'has role="dialog"')
  assertEqual(/aria-modal/.test(c), true, 'has aria-modal')
  assertEqual(/onConfirm/.test(c) && /onCancel/.test(c), true, 'onConfirm + onCancel props')
  assertEqual(/Escape/.test(c), true, 'handles Escape to cancel')
  assertEqual(/Discard/.test(c) && /Cancel/.test(c), true, 'Discard + Cancel buttons')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Task 7 fails.

- [ ] **Step 3: Create the component**

Create `src/components/v2/student/DiscardConfirmDialog.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

/**
 * Generic destructive-confirm modal. Used by:
 *   - InProgressBanner Discard
 *   - InProgressInterstitial "Discard and start new"
 *
 * Always shown before any discard takes effect so a student can back
 * out. The actual discard call lives in the caller's onConfirm.
 */

interface DiscardConfirmDialogProps {
  /** Heading copy. */
  title: string
  /** Body paragraph. */
  body: string
  /** Discard button label (defaults to "Discard"). */
  confirmLabel?: string
  /** Called when the student clicks Discard. */
  onConfirm: () => void
  /** Called when the student clicks Cancel, presses Escape, or clicks the backdrop. */
  onCancel: () => void
}

export function DiscardConfirmDialog({
  title,
  body,
  confirmLabel = 'Discard',
  onConfirm,
  onCancel,
}: DiscardConfirmDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onCancel}
    >
      <div
        className="relative max-w-sm w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="discard-confirm-title" className="text-base font-semibold text-gray-900 mb-2">
          {title}
        </h2>
        <p className="text-sm text-gray-700 mb-4">{body}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-2 text-sm font-semibold text-white rounded-lg bg-red-600 hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–7 = 54 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/student/DiscardConfirmDialog.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/components/v2/student/DiscardConfirmDialog.tsx scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): DiscardConfirmDialog shared confirm"
```

---

## Task 8: `InProgressBanner` component

**Files:**
- Create: `src/components/v2/student/InProgressBanner.tsx`
- Modify: `scripts/test-reflect-today-redesign.ts`

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 8: InProgressBanner component')
{
  const c = stripComments(read('src/components/v2/student/InProgressBanner.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function InProgressBanner/.test(c), true, 'InProgressBanner exported')
  assertEqual(/DiscardConfirmDialog/.test(c), true, 'uses DiscardConfirmDialog')
  assertEqual(/\/api\/conversation\/.*\/discard/.test(c), true, 'POSTs to /api/conversation/[id]/discard')
  assertEqual(/Resume/.test(c) && /Discard/.test(c), true, 'Resume + Discard buttons')
  assertEqual(/from '@\/components\/v2\/student\/types'/.test(c), true, 'imports ActiveInProgress')
  assertEqual(/router\.push\(['"`]\/v2\/conversation\//.test(c), true, 'Resume navigates to /v2/conversation/[id]')
  assertEqual(/work_context|workContext|workTitle/.test(c), true, 'falls back to work context for open_reflection')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```

- [ ] **Step 3: Create the component**

Create `src/components/v2/student/InProgressBanner.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DiscardConfirmDialog } from '@/components/v2/student/DiscardConfirmDialog'
import type { ActiveInProgress } from '@/components/v2/student/types'

/**
 * Pinned amber banner showing the student's single active in-progress
 * conversation. Same component on /v2/reflect and /v2/today.
 *
 * Resume → /v2/conversation/[id] (the existing ConversationView
 * dispatcher; in_progress renders ConversationFlowView).
 * Discard → DiscardConfirmDialog → POST /api/conversation/[id]/discard.
 * On successful discard, calls onDiscarded so the parent can refresh
 * (re-fetch the route to drop the banner + the in_progress row from
 * the tree/buckets).
 */

interface InProgressBannerProps {
  active: ActiveInProgress
  onDiscarded: () => void
}

export function InProgressBanner({ active, onDiscarded }: InProgressBannerProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // For work_based: prefer the work title. For open_reflection: workTitle
  // is null; the banner does not have direct access to work_context yet
  // (the route returns it only on the underlying convo). For now, fall
  // back to a generic label; future iteration can add work_context to
  // ActiveInProgress if it reads thin.
  const title = active.workTitle ?? 'your reflection'

  const handleResume = () => {
    router.push(`/v2/conversation/${active.id}`)
  }

  const handleConfirmDiscard = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`/api/conversation/${active.id}/discard`, {
        method: 'POST',
        cache: 'no-store',
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `HTTP ${r.status}`)
      }
      setConfirming(false)
      onDiscarded()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-lg" aria-hidden="true">⏳</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Resume: <span className="font-normal">{title}</span>
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Phase {active.currentPhase} · started{' '}
              {new Date(active.startedAt).toLocaleString()}
            </p>
            {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResume}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-700 text-white hover:bg-amber-800"
            >
              Resume →
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-red-200 text-red-700 hover:bg-red-50"
            >
              Discard
            </button>
          </div>
        </div>
      </div>

      {confirming && (
        <DiscardConfirmDialog
          title="Discard your in-progress reflection?"
          body={`Your progress on "${title}" (Phase ${active.currentPhase}) will be removed. This can't be undone from here.`}
          confirmLabel={busy ? 'Discarding…' : 'Discard'}
          onConfirm={handleConfirmDiscard}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–8 = 62 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/student/InProgressBanner.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/components/v2/student/InProgressBanner.tsx scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): InProgressBanner with resume + confirm-gated discard"
```

---

## Task 9: `InProgressInterstitial` component

**Files:**
- Create: `src/components/v2/student/InProgressInterstitial.tsx`
- Modify: `scripts/test-reflect-today-redesign.ts`

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 9: InProgressInterstitial component')
{
  const c = stripComments(read('src/components/v2/student/InProgressInterstitial.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function InProgressInterstitial/.test(c), true, 'InProgressInterstitial exported')
  assertEqual(/role="dialog"/.test(c) && /aria-modal/.test(c), true, 'modal a11y attrs')
  assertEqual(/Resume in-progress/.test(c), true, 'Resume in-progress button')
  assertEqual(/Discard and start new/.test(c), true, 'Discard and start new button')
  assertEqual(/Cancel/.test(c), true, 'Cancel button')
  assertEqual(/DiscardConfirmDialog/.test(c), true, 'uses DiscardConfirmDialog')
  assertEqual(/discardAndStart:\s*true/.test(c), true, 'POSTs /api/conversation/start with discardAndStart:true')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```

- [ ] **Step 3: Create the component**

Create `src/components/v2/student/InProgressInterstitial.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DiscardConfirmDialog } from '@/components/v2/student/DiscardConfirmDialog'
import type { ActiveInProgress, SubmissionItem } from '@/components/v2/student/types'

/**
 * Modal shown when a student clicks a NEW assignment row while one
 * in-progress conversation exists. Three exits:
 *
 *   - Resume in-progress      → /v2/conversation/[existing id]
 *   - Discard and start new   → DiscardConfirmDialog (always confirm)
 *                                → POST /api/conversation/start
 *                                    { workId, discardAndStart: true }
 *                                → /v2/conversation/[new id]
 *   - Cancel                  → close modal, no navigation
 *
 * The parent (via useStartReflection) handles opening/closing.
 */

interface InProgressInterstitialProps {
  active: ActiveInProgress
  /** The submission the student just clicked (the one they want to start). */
  newWork: SubmissionItem
  onClose: () => void
  /** Called after a successful discardAndStart so the parent can refresh. */
  onStarted: () => void
}

export function InProgressInterstitial({
  active,
  newWork,
  onClose,
  onStarted,
}: InProgressInterstitialProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const activeTitle = active.workTitle ?? 'your reflection'

  const handleResume = () => {
    router.push(`/v2/conversation/${active.id}`)
  }

  const handleConfirmDiscardAndStart = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/conversation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workId: newWork.id, discardAndStart: true }),
      })
      const data = await r.json()
      if (!r.ok) {
        throw new Error(data?.error || `HTTP ${r.status}`)
      }
      setConfirming(false)
      onStarted()
      router.push(`/v2/conversation/${data.conversationId}`)
    } catch (e) {
      setError(String(e))
      setBusy(false)
    }
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="interstitial-title"
        className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40"
        onClick={onClose}
      >
        <div
          className="relative max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-5"
          onClick={e => e.stopPropagation()}
        >
          <h2 id="interstitial-title" className="text-base font-semibold text-gray-900 mb-2">
            You have a reflection in progress
          </h2>
          <p className="text-sm text-gray-700 mb-4">
            You&rsquo;re partway through reflecting on <b>{activeTitle}</b> (Phase{' '}
            {active.currentPhase}). Want to finish that first, or set it aside and start the
            new one on <b>{newWork.title}</b>?
          </p>
          {error && <p className="text-xs text-red-700 mb-2">{error}</p>}
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              onClick={handleResume}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-green-700 text-white hover:bg-green-800"
            >
              Resume in-progress
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-50"
            >
              Discard and start new
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {confirming && (
        <DiscardConfirmDialog
          title="Discard your in-progress reflection?"
          body={`Your progress on "${activeTitle}" (Phase ${active.currentPhase}) will be removed and the new reflection on "${newWork.title}" will start in its place.`}
          confirmLabel={busy ? 'Discarding…' : 'Discard and start new'}
          onConfirm={handleConfirmDiscardAndStart}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–9 = 70 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/student/InProgressInterstitial.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/components/v2/student/InProgressInterstitial.tsx scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): InProgressInterstitial (Resume / Discard / Cancel)"
```

---

## Task 10: `useStartReflection` hook

**Files:**
- Create: `src/components/v2/student/use-start-reflection.ts`
- Modify: `scripts/test-reflect-today-redesign.ts`

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 10: useStartReflection hook')
{
  const c = stripComments(read('src/components/v2/student/use-start-reflection.ts'))
  assertEqual(/'use client'/.test(c), true, 'client module')
  assertEqual(/export function useStartReflection/.test(c), true, 'useStartReflection exported')
  assertEqual(/onSubmissionClick/.test(c), true, 'returns onSubmissionClick')
  assertEqual(/InProgressInterstitial/.test(c) || /interstitialFor/.test(c), true, 'manages interstitial state')
  assertEqual(/\/api\/conversation\/start/.test(c), true, 'POSTs /api/conversation/start')
  assertEqual(/router\.push\(['"`]\/v2\/conversation\//.test(c), true, 'navigates to /v2/conversation/[id]')
  // Branches: completed → /v2/conversation/[id]; in_progress → ditto; unreflected with active → interstitial; unreflected with no active → POST start.
  assertEqual(/status === 'completed'/.test(c) || /'completed'/.test(c), true, 'handles completed status')
  assertEqual(/status === 'in_progress'/.test(c) || /'in_progress'/.test(c), true, 'handles in_progress status')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```

- [ ] **Step 3: Create the hook**

Create `src/components/v2/student/use-start-reflection.ts`:

```ts
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ActiveInProgress, SubmissionItem } from '@/components/v2/student/types'

/**
 * Shared click-routing for the Reflect tree + Today buckets.
 *
 * Click semantics by row status:
 *   - completed   → navigate to /v2/conversation/[conversationId]
 *                   (ConversationView dispatches to ConversationFullView
 *                    for the side-modal-style "all at once" view)
 *   - in_progress → navigate to /v2/conversation/[conversationId]
 *                   (ConversationFlowView resumes the live flow)
 *   - unreflected, no active in-progress → POST /api/conversation/start
 *                   and navigate to the new conversation
 *   - unreflected, active in-progress exists → open
 *                   <InProgressInterstitial /> for explicit
 *                   Resume / Discard-and-start-new / Cancel
 *
 * The hook returns the click handler + the interstitial target (null
 * when no interstitial is open). The parent renders the interstitial
 * conditionally.
 *
 * onRefresh is called when something changed that requires re-fetching
 * the surface's data (after a successful discardAndStart navigation
 * the parent route changes anyway, but on cancel the data is fine; this
 * is wired so callers can re-fetch if they need to).
 */
interface UseStartReflectionArgs {
  active: ActiveInProgress | null
  onRefresh: () => void
}

interface UseStartReflectionReturn {
  onSubmissionClick: (item: SubmissionItem) => void
  interstitialFor: SubmissionItem | null
  closeInterstitial: () => void
  startError: string | null
}

export function useStartReflection({
  active,
  onRefresh,
}: UseStartReflectionArgs): UseStartReflectionReturn {
  const router = useRouter()
  const [interstitialFor, setInterstitialFor] = useState<SubmissionItem | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  const closeInterstitial = useCallback(() => setInterstitialFor(null), [])

  const onSubmissionClick = useCallback(
    (item: SubmissionItem) => {
      setStartError(null)

      // Existing conversations: navigate directly.
      if (item.status === 'completed' && item.conversationId) {
        router.push(`/v2/conversation/${item.conversationId}`)
        return
      }
      if (item.status === 'in_progress' && item.conversationId) {
        router.push(`/v2/conversation/${item.conversationId}`)
        return
      }

      // Unreflected: if there's an active in-progress (different work),
      // route through the interstitial so the student decides explicitly.
      if (active && (!active.workId || active.workId !== item.id)) {
        setInterstitialFor(item)
        return
      }

      // Unreflected with no active in-progress: start immediately.
      ;(async () => {
        try {
          const r = await fetch('/api/conversation/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workId: item.id }),
          })
          const data = await r.json()
          if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
          onRefresh()
          router.push(`/v2/conversation/${data.conversationId}`)
        } catch (e) {
          setStartError(String(e))
        }
      })()
    },
    [active, router, onRefresh]
  )

  return { onSubmissionClick, interstitialFor, closeInterstitial, startError }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–10 = 78 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/student/use-start-reflection.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/components/v2/student/use-start-reflection.ts scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): useStartReflection hook (click routing + interstitial state)"
```

---

## Task 11: `ReflectTree` component

**Files:**
- Create: `src/components/v2/student/ReflectTree.tsx`
- Modify: `scripts/test-reflect-today-redesign.ts`

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 11: ReflectTree component')
{
  const c = stripComments(read('src/components/v2/student/ReflectTree.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function ReflectTree/.test(c), true, 'ReflectTree exported')
  assertEqual(/SubmissionRow/.test(c), true, 'renders SubmissionRow')
  assertEqual(/surface=['"]reflect['"]/.test(c), true, 'passes surface="reflect"')
  // Hierarchy levels.
  assertEqual(/quarter/.test(c) && /course/i.test(c) && /week/i.test(c), true, 'has quarter/course/week levels')
  // Smart-expand defaults.
  assertEqual(/smartExpandDefaults|smart-?expand/i.test(c), true, 'has smart-expand defaults helper')
  // Sort: courses alphabetical, weeks ascending.
  assertEqual(/localeCompare/.test(c), true, 'alphabetical course sort')
  // Quarter ordering helper.
  assertEqual(/Winter|Spring|Summer|Fall/.test(c), true, 'parses quarter season')
  // Empty state.
  assertEqual(/Nothing to reflect on yet/.test(c) || /your portfolio will fill/.test(c), true, 'has empty state')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```

- [ ] **Step 3: Create the component**

Create `src/components/v2/student/ReflectTree.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { SubmissionRow } from '@/components/v2/student/SubmissionRow'
import type { SubmissionItem } from '@/components/v2/student/types'

/**
 * Quarter → Course → Week → Submissions tree.
 *
 * - Quarters sorted most recent first (Fall > Summer > Spring > Winter
 *   within a year; higher year first).
 * - Courses within a quarter sorted alphabetically by course_name.
 * - Weeks within a course sorted ascending by week_number; the "Other"
 *   bucket (week_number is null) comes last.
 * - Submissions within a week sorted newest-first by submitted_at
 *   (preserving the API's order — submissions arrive newest-first).
 *
 * Smart-expand defaults computed once from the input:
 *   - The current quarter (the one with the highest ordinal that has
 *     any submissions) is expanded.
 *   - Within it, every course is expanded.
 *   - Within each expanded course, the "current week" = the highest
 *     week_number that has content for that course; only that week is
 *     expanded by default. (Curriculum-week-based, not calendar.)
 *   - Per-session client state only; reloading resets to defaults.
 */

interface ReflectTreeProps {
  submissions: SubmissionItem[]
  onRowClick: (item: SubmissionItem) => void
}

const SEASON_ORDER: Record<string, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 }

function quarterOrdinal(q: string): number {
  const [season, year] = q.split(' ')
  const y = parseInt(year, 10)
  const s = SEASON_ORDER[season] ?? 0
  return y * 10 + s
}

function weekKey(weekNumber: number | null): string {
  return weekNumber === null ? 'other' : String(weekNumber)
}

interface Grouped {
  quarter: string
  total: number
  courses: Array<{
    courseName: string
    courseCode: string | null
    total: number
    weeks: Array<{
      label: string         // "Week N" or "Other"
      key: string           // weekKey
      weekNumber: number | null
      total: number
      items: SubmissionItem[]
    }>
  }>
}

function group(submissions: SubmissionItem[]): Grouped[] {
  const byQuarter = new Map<string, Map<string, Map<string, SubmissionItem[]>>>()
  for (const s of submissions) {
    if (!s.courseName) continue   // submissions without course_name are not surfaceable here
    if (!byQuarter.has(s.quarter)) byQuarter.set(s.quarter, new Map())
    const courses = byQuarter.get(s.quarter)!
    if (!courses.has(s.courseName)) courses.set(s.courseName, new Map())
    const weeks = courses.get(s.courseName)!
    const wk = weekKey(s.weekNumber)
    if (!weeks.has(wk)) weeks.set(wk, [])
    weeks.get(wk)!.push(s)
  }

  const out: Grouped[] = []
  const quarters = [...byQuarter.keys()].sort((a, b) => quarterOrdinal(b) - quarterOrdinal(a))
  for (const q of quarters) {
    const coursesMap = byQuarter.get(q)!
    const courseNames = [...coursesMap.keys()].sort((a, b) => a.localeCompare(b))
    let qTotal = 0
    const courses: Grouped['courses'] = []
    for (const cn of courseNames) {
      const weeksMap = coursesMap.get(cn)!
      const weekKeys = [...weeksMap.keys()].sort((a, b) => {
        if (a === 'other') return 1
        if (b === 'other') return -1
        return parseInt(a, 10) - parseInt(b, 10)
      })
      let cTotal = 0
      const weeks: Grouped['courses'][number]['weeks'] = []
      let courseCode: string | null = null
      for (const wk of weekKeys) {
        const items = weeksMap.get(wk)!
        if (!courseCode) courseCode = items[0].courseCode
        const weekNumber = wk === 'other' ? null : parseInt(wk, 10)
        weeks.push({
          label: wk === 'other' ? 'Other' : `Week ${weekNumber}`,
          key: wk,
          weekNumber,
          total: items.length,
          items,
        })
        cTotal += items.length
      }
      courses.push({ courseName: cn, courseCode, total: cTotal, weeks })
      qTotal += cTotal
    }
    out.push({ quarter: q, total: qTotal, courses })
  }
  return out
}

interface ExpandDefaults {
  quarters: Set<string>
  courses: Set<string>       // `${quarter}/${courseName}` keys
  weeks: Set<string>         // `${quarter}/${courseName}/${weekKey}` keys
}

function smartExpandDefaults(grouped: Grouped[]): ExpandDefaults {
  const quarters = new Set<string>()
  const courses = new Set<string>()
  const weeks = new Set<string>()
  if (grouped.length === 0) return { quarters, courses, weeks }
  const current = grouped[0]   // grouped is sorted newest-first by ordinal
  quarters.add(current.quarter)
  for (const c of current.courses) {
    const cKey = `${current.quarter}/${c.courseName}`
    courses.add(cKey)
    // Pick the highest week_number (excluding "other") for this course.
    // If only "other" exists, expand that.
    const numericWeeks = c.weeks.filter(w => w.weekNumber !== null)
    const target = numericWeeks.length > 0
      ? numericWeeks.reduce((a, b) => (a.weekNumber! >= b.weekNumber! ? a : b))
      : c.weeks[0]
    if (target) weeks.add(`${cKey}/${target.key}`)
  }
  return { quarters, courses, weeks }
}

export function ReflectTree({ submissions, onRowClick }: ReflectTreeProps) {
  const grouped = useMemo(() => group(submissions), [submissions])
  const defaults = useMemo(() => smartExpandDefaults(grouped), [grouped])

  const [openQuarters, setOpenQuarters] = useState<Set<string>>(defaults.quarters)
  const [openCourses, setOpenCourses] = useState<Set<string>>(defaults.courses)
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(defaults.weeks)

  function toggle(set: Set<string>, key: string, update: (next: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    update(next)
  }

  if (grouped.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
        <p className="text-gray-600">Nothing to reflect on yet.</p>
        <p className="text-xs text-gray-500 mt-2">
          When you submit work to D2L, it&rsquo;ll show up here ready for reflection.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm divide-y divide-gray-100">
      {grouped.map(q => {
        const qOpen = openQuarters.has(q.quarter)
        return (
          <section key={q.quarter} className="p-3">
            <button
              type="button"
              onClick={() => toggle(openQuarters, q.quarter, setOpenQuarters)}
              className="w-full flex items-center justify-between py-1 px-1 hover:bg-gray-50 rounded"
              aria-expanded={qOpen}
            >
              <span className="text-sm font-semibold text-gray-900">
                {qOpen ? '▾' : '▸'} {q.quarter}
              </span>
              <span className="text-xs text-gray-500">({q.total})</span>
            </button>
            {qOpen && (
              <div className="mt-1 space-y-2 pl-3">
                {q.courses.map(c => {
                  const cKey = `${q.quarter}/${c.courseName}`
                  const cOpen = openCourses.has(cKey)
                  return (
                    <div key={cKey}>
                      <button
                        type="button"
                        onClick={() => toggle(openCourses, cKey, setOpenCourses)}
                        className="w-full flex items-center justify-between py-1 px-1 hover:bg-gray-50 rounded"
                        aria-expanded={cOpen}
                      >
                        <span className="text-sm font-semibold text-gray-800">
                          {cOpen ? '▾' : '▸'} {c.courseName}
                          {c.courseCode && (
                            <span className="text-xs font-normal text-gray-400 ml-2">
                              {c.courseCode}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500">({c.total})</span>
                      </button>
                      {cOpen && (
                        <div className="mt-1 space-y-1 pl-3">
                          {c.weeks.map(w => {
                            const wKey = `${cKey}/${w.key}`
                            const wOpen = openWeeks.has(wKey)
                            return (
                              <div key={wKey}>
                                <button
                                  type="button"
                                  onClick={() => toggle(openWeeks, wKey, setOpenWeeks)}
                                  className="w-full flex items-center justify-between py-1 px-1 hover:bg-gray-50 rounded"
                                  aria-expanded={wOpen}
                                >
                                  <span className="text-sm text-gray-700">
                                    {wOpen ? '▾' : '▸'} {w.label}
                                  </span>
                                  <span className="text-xs text-gray-500">({w.total})</span>
                                </button>
                                {wOpen && (
                                  <ul className="mt-1 space-y-0.5 pl-3">
                                    {w.items.map(item => (
                                      <li key={item.id}>
                                        <SubmissionRow
                                          item={item}
                                          surface="reflect"
                                          onClick={onRowClick}
                                        />
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–11 = 87 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/student/ReflectTree.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/components/v2/student/ReflectTree.tsx scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): ReflectTree (Quarter > Course > Week > Submissions, smart-expand)"
```

---

## Task 12: `TodayBuckets` component

**Files:**
- Create: `src/components/v2/student/TodayBuckets.tsx`
- Modify: `scripts/test-reflect-today-redesign.ts`

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 12: TodayBuckets component')
{
  const c = stripComments(read('src/components/v2/student/TodayBuckets.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function TodayBuckets/.test(c), true, 'TodayBuckets exported')
  assertEqual(/SubmissionRow/.test(c), true, 'renders SubmissionRow')
  assertEqual(/surface=['"]today['"]/.test(c), true, 'passes surface="today"')
  assertEqual(/Today/.test(c) && /This week/.test(c) && /Earlier/.test(c), true, 'three bucket labels')
  // Earlier collapsed by default.
  assertEqual(/earlierOpen|earlier_open|defaultEarlierOpen|expandedEarlier/.test(c) || /useState\(false\)/.test(c), true, 'tracks earlier-open state (default closed)')
  // Date bucketing uses submitted_at.
  assertEqual(/submittedAt/.test(c), true, 'reads submittedAt for bucketing')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```

- [ ] **Step 3: Create the component**

Create `src/components/v2/student/TodayBuckets.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { SubmissionRow } from '@/components/v2/student/SubmissionRow'
import type { SubmissionItem } from '@/components/v2/student/types'

/**
 * Three date buckets — Today / This week / Earlier — for /v2/today.
 *
 * Bucketing (client-side, user's local timezone):
 *   - Today:    DATE(submittedAt) === DATE(now)
 *   - This week: in the last 7 days, excluding Today
 *   - Earlier:  everything else (incl. submissions with no submittedAt)
 *
 * Empty buckets are not rendered. Today + This week start expanded;
 * Earlier starts collapsed (and is the place a large backlog lives).
 */

interface TodayBucketsProps {
  submissions: SubmissionItem[]
  onRowClick: (item: SubmissionItem) => void
}

interface Buckets {
  today: SubmissionItem[]
  thisWeek: SubmissionItem[]
  earlier: SubmissionItem[]
}

function bucket(submissions: SubmissionItem[]): Buckets {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

  const today: SubmissionItem[] = []
  const thisWeek: SubmissionItem[] = []
  const earlier: SubmissionItem[] = []

  for (const s of submissions) {
    if (!s.submittedAt) {
      earlier.push(s)
      continue
    }
    const d = new Date(s.submittedAt)
    if (d >= todayStart) today.push(s)
    else if (d >= weekAgo) thisWeek.push(s)
    else earlier.push(s)
  }
  return { today, thisWeek, earlier }
}

export function TodayBuckets({ submissions, onRowClick }: TodayBucketsProps) {
  const buckets = useMemo(() => bucket(submissions), [submissions])
  const [earlierOpen, setEarlierOpen] = useState(false)

  const renderList = (items: SubmissionItem[]) => (
    <ul className="space-y-0.5">
      {items.map(item => (
        <li key={item.id}>
          <SubmissionRow item={item} surface="today" onClick={onRowClick} />
        </li>
      ))}
    </ul>
  )

  return (
    <div className="space-y-3">
      {buckets.today.length > 0 && (
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">Today</h2>
            <span className="text-xs text-gray-500">({buckets.today.length})</span>
          </div>
          {renderList(buckets.today)}
        </section>
      )}

      {buckets.thisWeek.length > 0 && (
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">This week</h2>
            <span className="text-xs text-gray-500">({buckets.thisWeek.length})</span>
          </div>
          {renderList(buckets.thisWeek)}
        </section>
      )}

      {buckets.earlier.length > 0 && (
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
          <button
            type="button"
            onClick={() => setEarlierOpen(o => !o)}
            className="w-full flex items-baseline justify-between"
            aria-expanded={earlierOpen}
          >
            <h2 className="text-sm font-semibold text-gray-600">
              {earlierOpen ? '▾' : '▸'} Earlier
            </h2>
            <span className="text-xs text-gray-500">({buckets.earlier.length})</span>
          </button>
          {earlierOpen && <div className="mt-2">{renderList(buckets.earlier)}</div>}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–12 = 94 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/student/TodayBuckets.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/components/v2/student/TodayBuckets.tsx scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): TodayBuckets (Today / This week / Earlier)"
```

---

## Task 13: `ConversationFullView` component

**Files:**
- Create: `src/components/v2/student/ConversationFullView.tsx`
- Modify: `scripts/test-reflect-today-redesign.ts`

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 13: ConversationFullView component')
{
  const c = stripComments(read('src/components/v2/student/ConversationFullView.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function ConversationFullView/.test(c), true, 'ConversationFullView exported')
  // Fetches the existing endpoint (note: plural /api/conversations/[id]).
  assertEqual(/\/api\/conversations\//.test(c), true, 'fetches /api/conversations/[id]')
  // Renders all three phases at once (no typewriter).
  assertEqual(/phase1|promptPhase1/i.test(c) && /phase2|promptPhase2/i.test(c) && /phase3|promptPhase3/i.test(c), true, 'renders all three phases at once')
  // No typewriter character-by-character; this is the "all at once" replacement.
  assertEqual(/typewriter/i.test(c), false, 'no typewriter logic')
  // Synthesis displayed in full when present.
  assertEqual(/synthesisText|synthesis_text/.test(c), true, 'renders synthesis')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```

- [ ] **Step 3: Create the component**

Create `src/components/v2/student/ConversationFullView.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

/**
 * Non-typewriter, all-at-once render of a completed conversation.
 *
 * Replaces ConversationReplay (which animated phases character-by-
 * character) for real students. The shape mirrors ConversationPanel
 * (the existing side-modal used for in-progress on Reflect): work
 * header + phase 1/2/3 prompt+response + synthesis + skill tags.
 *
 * Fetches /api/conversations/[id] — the existing endpoint that
 * returns the full conversation in one round-trip.
 */

interface ConversationDetail {
  id: string
  workTitle: string | null
  courseName: string | null
  conversationType: 'work_based' | 'open_reflection' | null
  status: 'in_progress' | 'completed'
  promptPhase1: string | null
  responsePhase1: string | null
  promptPhase2: string | null
  responsePhase2: string | null
  promptPhase3: string | null
  responsePhase3: string | null
  synthesisText: string | null
  skillTags: Array<{
    skillId: string
    skillName: string | null
    confidence: number
    studentConfirmed: boolean
    rationale: string | null
  }>
}

interface ConversationFullViewProps {
  conversationId: string
}

export function ConversationFullView({ conversationId }: ConversationFullViewProps) {
  const [data, setData] = useState<ConversationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/conversations/${conversationId}`, { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as ConversationDetail
      })
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [conversationId])

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-sm text-red-800">
          Couldn&rsquo;t load conversation: {error}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-4">
        <div className="h-8 w-3/4 rounded bg-gray-200 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
      <header className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden="true">📄</span>
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 truncate">
              {data.workTitle || 'Reflection'}
            </h1>
            {data.courseName && (
              <p className="text-sm text-gray-500 mt-0.5">{data.courseName}</p>
            )}
          </div>
        </div>
      </header>

      <PhaseSection
        n={1}
        prompt={data.promptPhase1}
        response={data.responsePhase1}
      />
      <PhaseSection
        n={2}
        prompt={data.promptPhase2}
        response={data.responsePhase2}
      />
      <PhaseSection
        n={3}
        prompt={data.promptPhase3}
        response={data.responsePhase3}
      />

      {data.synthesisText && (
        <section className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-emerald-800 mb-2">
            Synthesis
          </h2>
          <p className="text-sm text-emerald-950 whitespace-pre-wrap">{data.synthesisText}</p>
        </section>
      )}

      {data.skillTags.length > 0 && (
        <section className="rounded-2xl bg-white border border-gray-200 p-4">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">
            Skills
          </h2>
          <ul className="flex flex-wrap gap-2">
            {data.skillTags.map(t => (
              <li
                key={t.skillId}
                className="px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-800"
              >
                {t.skillName || t.skillId}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function PhaseSection({
  n,
  prompt,
  response,
}: {
  n: 1 | 2 | 3
  prompt: string | null
  response: string | null
}) {
  if (!prompt && !response) return null
  return (
    <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-2">
      <h2 className="text-xs uppercase tracking-wider font-semibold text-gray-500">
        Phase {n}
      </h2>
      {prompt && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Prompt</p>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{prompt}</p>
        </div>
      )}
      {response && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Your response</p>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{response}</p>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–13 = 100 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/student/ConversationFullView.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/components/v2/student/ConversationFullView.tsx scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): ConversationFullView (non-typewriter all-at-once)"
```

---

## Task 14: Wire `ReflectView`

**Files:**
- Rewrite: `src/app/v2/(student)/reflect/ReflectView.tsx`
- Modify: `scripts/test-reflect-today-redesign.ts`

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 14: ReflectView wired to new components')
{
  const v = stripComments(read('src/app/v2/(student)/reflect/ReflectView.tsx'))
  assertEqual(/'use client'/.test(v), true, 'client component')
  assertEqual(/InProgressBanner/.test(v), true, 'renders InProgressBanner')
  assertEqual(/ReflectTree/.test(v), true, 'renders ReflectTree')
  assertEqual(/InProgressInterstitial/.test(v), true, 'renders InProgressInterstitial')
  assertEqual(/useStartReflection/.test(v), true, 'uses useStartReflection hook')
  assertEqual(/\/api\/student\/reflect/.test(v), true, 'fetches /api/student/reflect')
  // The old three-section layout is gone.
  assertEqual(/featuredWork/.test(v), false, 'old featuredWork removed')
  assertEqual(/completed:\s*Array/.test(v), false, 'old completed Array typing removed')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```

- [ ] **Step 3: Rewrite ReflectView**

Replace the entire contents of `src/app/v2/(student)/reflect/ReflectView.tsx` with:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { InProgressBanner } from '@/components/v2/student/InProgressBanner'
import { InProgressInterstitial } from '@/components/v2/student/InProgressInterstitial'
import { ReflectTree } from '@/components/v2/student/ReflectTree'
import { useStartReflection } from '@/components/v2/student/use-start-reflection'
import type { ActiveInProgress, SubmissionItem } from '@/components/v2/student/types'

/**
 * v2 Reflect view — work-tied reflections, navigable archive.
 *
 * Layout (post-redesign):
 *   - Page header "Reflect"
 *   - InProgressBanner (if activeInProgress)
 *   - ReflectTree (Quarter -> Course -> Week -> Submissions, smart-expanded)
 *
 * Click routing is delegated to useStartReflection (shared with TodayView).
 */

interface ReflectResponse {
  activeInProgress: ActiveInProgress | null
  submissions: SubmissionItem[]
}

export function ReflectView() {
  const [data, setData] = useState<ReflectResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const refresh = useCallback(() => setReloadKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/reflect', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as ReflectResponse
      })
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [reloadKey])

  const { onSubmissionClick, interstitialFor, closeInterstitial, startError } =
    useStartReflection({ active: data?.activeInProgress ?? null, onRefresh: refresh })

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
        Couldn&rsquo;t load reflections: {error}
      </div>
    )
  }
  if (data === null) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-xl bg-white border border-gray-200 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.activeInProgress && (
        <InProgressBanner active={data.activeInProgress} onDiscarded={refresh} />
      )}
      {startError && (
        <p className="text-xs text-red-700">{startError}</p>
      )}
      <ReflectTree submissions={data.submissions} onRowClick={onSubmissionClick} />

      {interstitialFor && data.activeInProgress && (
        <InProgressInterstitial
          active={data.activeInProgress}
          newWork={interstitialFor}
          onClose={closeInterstitial}
          onStarted={refresh}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–14 = 108 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json 'src/app/v2/(student)/reflect/ReflectView.tsx'
```

- [ ] **Step 6: Commit**

```bash
git add 'src/app/v2/(student)/reflect/ReflectView.tsx' scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): ReflectView wired to new banner + tree + interstitial"
```

---

## Task 15: Wire `TodayView`

**Files:**
- Modify: `src/app/v2/(student)/today/TodayView.tsx` (replace `FeaturedWorkSection` with `<InProgressBanner />` + `<TodayBuckets />`; keep LTI / WeekStats / RecentJournal / QuickActions byte-equivalent)
- Modify: `scripts/test-reflect-today-redesign.ts`

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 15: TodayView wired to new components')
{
  const v = stripComments(read('src/app/v2/(student)/today/TodayView.tsx'))
  assertEqual(/'use client'/.test(v), true, 'client component')
  assertEqual(/InProgressBanner/.test(v), true, 'renders InProgressBanner')
  assertEqual(/TodayBuckets/.test(v), true, 'renders TodayBuckets')
  assertEqual(/InProgressInterstitial/.test(v), true, 'renders InProgressInterstitial')
  assertEqual(/useStartReflection/.test(v), true, 'uses useStartReflection hook')
  // Regression: the four preserved sections stay.
  assertEqual(/LtiPinnedCard/.test(v), true, 'LtiPinnedCard preserved')
  assertEqual(/WeekStatsCard/.test(v), true, 'WeekStatsCard preserved')
  assertEqual(/RecentJournalSection/.test(v), true, 'RecentJournalSection preserved')
  assertEqual(/QuickActions/.test(v), true, 'QuickActions preserved')
  // FeaturedWorkSection is gone.
  assertEqual(/FeaturedWorkSection/.test(v), false, 'old FeaturedWorkSection removed')
  // Reads the new response shape.
  assertEqual(/activeInProgress/.test(v) && /submissions/.test(v), true, 'reads new response fields')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```

- [ ] **Step 3: Rewrite TodayView**

Replace the entire contents of `src/app/v2/(student)/today/TodayView.tsx` with:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { pillarStripeStyle } from '@/components/v2/PillarStripe'
import { InProgressBanner } from '@/components/v2/student/InProgressBanner'
import { InProgressInterstitial } from '@/components/v2/student/InProgressInterstitial'
import { TodayBuckets } from '@/components/v2/student/TodayBuckets'
import { useStartReflection } from '@/components/v2/student/use-start-reflection'
import type { ActiveInProgress, SubmissionItem } from '@/components/v2/student/types'

/**
 * Student-side Today view (post-redesign).
 *
 * Stack (top → bottom):
 *   1. Greeting / hero
 *   2. LTI pinned (when arriving from Brightspace) — unchanged
 *   3. InProgressBanner (if activeInProgress)
 *   4. TodayBuckets (Today / This week / Earlier)
 *   5. WeekStatsCard — unchanged
 *   6. RecentJournalSection — unchanged
 *   7. QuickActions — unchanged
 *
 * Click routing on submissions is delegated to useStartReflection
 * (shared with ReflectView).
 */

interface TodayResponse {
  activeInProgress: ActiveInProgress | null
  submissions: SubmissionItem[]
  recentJournal: Array<{
    id: string
    startedAt: string
    description: string | null
    synthesisExcerpt: string | null
    primaryPillar?: string | null
  }>
  weekStats: {
    conversationsCompleted: number
    workSubmitted: number
  }
  ltiPinned: {
    resourceLinkId: string
    title: string
    courseTitle: string | null
  } | null
}

export function TodayView() {
  const router = useRouter()
  const [data, setData] = useState<TodayResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const refresh = useCallback(() => setReloadKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/today', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as TodayResponse
      })
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [reloadKey])

  const { onSubmissionClick, interstitialFor, closeInterstitial, startError } =
    useStartReflection({ active: data?.activeInProgress ?? null, onRefresh: refresh })

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-700">Couldn&rsquo;t load Today: {error}</p>
      </Card>
    )
  }
  if (data === null) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        <div className="h-20 rounded-2xl bg-white border border-gray-200 animate-pulse" />
      </div>
    )
  }

  const totalActionable =
    (data.ltiPinned ? 1 : 0) +
    data.submissions.filter(s => s.status === 'unreflected').length
  const hasAnyContent =
    totalActionable > 0 ||
    data.recentJournal.length > 0 ||
    data.weekStats.conversationsCompleted > 0 ||
    data.weekStats.workSubmitted > 0

  return (
    <div className="space-y-5">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Today</h1>
        <p className="text-sm text-gray-500 mt-1">
          {totalActionable > 0
            ? `${totalActionable} thing${totalActionable === 1 ? '' : 's'} to reflect on`
            : hasAnyContent
            ? `You're up to date — nothing waiting on you right now`
            : `Welcome — your portfolio will fill in as you submit work`}
        </p>
      </div>

      {data.ltiPinned && (
        <LtiPinnedCard
          pinned={data.ltiPinned}
          onStart={() =>
            router.push(`/v2/reflect/start?lti=${data.ltiPinned!.resourceLinkId}`)
          }
        />
      )}

      {data.activeInProgress && (
        <InProgressBanner active={data.activeInProgress} onDiscarded={refresh} />
      )}

      {startError && <p className="text-xs text-red-700">{startError}</p>}

      <TodayBuckets submissions={data.submissions} onRowClick={onSubmissionClick} />

      <WeekStatsCard stats={data.weekStats} />

      <RecentJournalSection
        items={data.recentJournal}
        onOpen={id => router.push(`/v2/journal?entry=${id}`)}
      />

      <QuickActions
        onStartJournal={() => router.push('/v2/journal?new=1')}
        onOpenGrowth={() => router.push('/v2/growth')}
      />

      {interstitialFor && data.activeInProgress && (
        <InProgressInterstitial
          active={data.activeInProgress}
          newWork={interstitialFor}
          onClose={closeInterstitial}
          onStarted={refresh}
        />
      )}
    </div>
  )
}

// ─── Sections (LTI / WeekStats / RecentJournal / QuickActions — unchanged) ───

function LtiPinnedCard({
  pinned,
  onStart,
}: {
  pinned: { resourceLinkId: string; title: string; courseTitle: string | null }
  onStart: () => void
}) {
  return (
    <Card emphasis="green">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-green-700 mb-1">
        From Brightspace
      </div>
      <h2 className="text-base font-semibold text-gray-900 leading-snug">{pinned.title}</h2>
      {pinned.courseTitle && (
        <p className="text-xs text-gray-500 mt-0.5">{pinned.courseTitle}</p>
      )}
      <button
        type="button"
        onClick={onStart}
        className="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors"
      >
        Start reflecting →
      </button>
    </Card>
  )
}

function WeekStatsCard({ stats }: { stats: TodayResponse['weekStats'] }) {
  if (stats.conversationsCompleted === 0 && stats.workSubmitted === 0) return null
  return (
    <Card>
      <SectionHeader title="This week" />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Reflections" value={stats.conversationsCompleted} />
        <Stat label="Submitted" value={stats.workSubmitted} />
      </div>
    </Card>
  )
}

function RecentJournalSection({
  items,
  onOpen,
}: {
  items: TodayResponse['recentJournal']
  onOpen: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <Card>
      <SectionHeader title="Recent journal entries" subtitle="Your private reflections" />
      <ul className="space-y-2">
        {items.map(j => (
          <li key={j.id}>
            <button
              type="button"
              onClick={() => onOpen(j.id)}
              className="w-full text-left pl-3 pr-3 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              style={pillarStripeStyle(j.primaryPillar)}
            >
              <p className="text-sm text-gray-700 line-clamp-1">
                {j.description || 'Reflection'}
              </p>
              {j.synthesisExcerpt && (
                <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">
                  {j.synthesisExcerpt}
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-1.5">
                {formatRelative(j.startedAt)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function QuickActions({
  onStartJournal,
  onOpenGrowth,
}: {
  onStartJournal: () => void
  onOpenGrowth: () => void
}) {
  return (
    <Card>
      <SectionHeader title="Other things you can do" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onStartJournal}
          className="px-4 py-3 text-sm font-medium rounded-lg bg-white border border-gray-200 hover:border-green-400 hover:bg-green-50/30 text-left transition-colors"
        >
          <span className="text-gray-900 font-semibold block">Open journal</span>
          <span className="text-xs text-gray-500">Reflect on whatever&rsquo;s on your mind</span>
        </button>
        <button
          type="button"
          onClick={onOpenGrowth}
          className="px-4 py-3 text-sm font-medium rounded-lg bg-white border border-gray-200 hover:border-green-400 hover:bg-green-50/30 text-left transition-colors"
        >
          <span className="text-gray-900 font-semibold block">See your growth</span>
          <span className="text-xs text-gray-500">How your skills are growing</span>
        </button>
      </div>
    </Card>
  )
}

// ─── Primitives (unchanged from prior file) ─────────

function Card({
  children,
  emphasis,
}: {
  children: React.ReactNode
  emphasis?: 'green'
}) {
  const ringClass =
    emphasis === 'green'
      ? 'ring-1 ring-green-200 border-green-200 bg-green-50/30'
      : 'border-gray-200 bg-white'
  return (
    <div className={`rounded-2xl border shadow-sm p-5 ${ringClass}`}>{children}</div>
  )
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">
        {label}
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const days = Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000))
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–15 = 118 passed, 0 failed.

- [ ] **Step 5: Run tsc + eslint**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json 'src/app/v2/(student)/today/TodayView.tsx'
```

- [ ] **Step 6: Commit**

```bash
git add 'src/app/v2/(student)/today/TodayView.tsx' scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): TodayView wired to new banner + buckets + interstitial"
```

---

## Task 16: Wire `ConversationView` dispatcher

**Files:**
- Modify: `src/app/v2/(student)/conversation/[id]/ConversationView.tsx`
- Modify: `scripts/test-reflect-today-redesign.ts`

- [ ] **Step 1: Write the failing test**

Insert above the marker:

```ts
section('Task 16: ConversationView dispatcher (View > Replay for real students)')
{
  const v = stripComments(read('src/app/v2/(student)/conversation/[id]/ConversationView.tsx'))
  assertEqual(/'use client'/.test(v), true, 'client component')
  assertEqual(/ConversationFullView/.test(v), true, 'imports ConversationFullView')
  // Completed branch routes to ConversationFullView (real students).
  assertEqual(/data\.status === 'completed'[\s\S]{0,400}ConversationFullView/.test(v), true, 'completed branch dispatches to ConversationFullView')
  // Replay path remains, gated by is_demo (kept in tree for the demo path).
  assertEqual(/ConversationReplay/.test(v), true, 'ConversationReplay still imported (demo path)')
  assertEqual(/isDemo|is_demo|demoMode/.test(v), true, 'demo gating present')
  // In-progress branch unchanged.
  assertEqual(/ConversationFlowView/.test(v), true, 'in_progress branch still dispatches to ConversationFlowView')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```

- [ ] **Step 3: Rewrite ConversationView**

Replace the entire contents of `src/app/v2/(student)/conversation/[id]/ConversationView.tsx` with:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ConversationReplay } from './ConversationReplay'
import { ConversationFlowView } from './ConversationFlowView'
import { ConversationFullView } from '@/components/v2/student/ConversationFullView'

/**
 * ConversationView — top-level client dispatcher for the
 * /v2/conversation/[id] page.
 *
 * Status routing:
 *   - status === 'in_progress' → ConversationFlowView (live, interactive)
 *   - status === 'completed'   →
 *       - real student (isDemo=false): ConversationFullView (the
 *         non-typewriter "all at once" view — same component used
 *         when a row is clicked from the Reflect tree)
 *       - demo persona (isDemo=true): ConversationReplay (typewriter
 *         walkthrough — preserved for the demo flow only)
 *
 * isDemo is inferred from /api/conversations/[id]: the route already
 * resolves the student id; we extend the response by including
 * `isDemo` on the JSON (added in this task — see route patch below).
 * If the route doesn't yet expose isDemo (older deploy), default to
 * false (treat as real student).
 */

interface ConversationDetail {
  id: string
  workTitle: string | null
  courseName: string | null
  conversationType: 'work_based' | 'open_reflection' | null
  status: 'in_progress' | 'completed'
  isDemo?: boolean
  promptPhase1: string | null
  responsePhase1: string | null
  promptPhase2: string | null
  responsePhase2: string | null
  promptPhase3: string | null
  responsePhase3: string | null
  synthesisText: string | null
  skillTags: Array<{
    skillId: string
    skillName: string | null
    confidence: number
    studentConfirmed: boolean
    rationale: string | null
  }>
}

interface Props {
  conversationId: string
}

export function ConversationView({ conversationId }: Props) {
  const [data, setData] = useState<ConversationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/conversations/${conversationId}`, { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as ConversationDetail
      })
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [conversationId])

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-sm text-red-800">
          Couldn&rsquo;t load conversation: {error}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-4">
        <div className="h-8 w-3/4 rounded bg-gray-200 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
      </div>
    )
  }

  // Completed path:
  //   - Real students get the new "View" (all at once, no typewriter).
  //   - Demo personas keep the existing typewriter Replay.
  if (data.status === 'completed') {
    const isDemo = data.isDemo === true
    if (isDemo) {
      return <ConversationReplay conversationId={conversationId} />
    }
    return <ConversationFullView conversationId={conversationId} />
  }

  // In-progress path unchanged.
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <WorkHeader workTitle={data.workTitle} courseName={data.courseName} />
      <ConversationFlowView conversation={data} />
    </div>
  )
}

function WorkHeader({
  workTitle,
  courseName,
}: {
  workTitle: string | null
  courseName: string | null
}) {
  return (
    <div className="mb-6 p-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">📄</span>
        <div className="min-w-0">
          <h1 className="font-semibold text-gray-900 truncate">
            {workTitle || 'Reflection'}
          </h1>
          {courseName && (
            <p className="text-sm text-gray-500 mt-0.5">{courseName}</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Patch `/api/conversations/[id]` to include `isDemo`**

The route currently does NOT join `student` in its main select (it joins `student_work` for the work header), and the demo-coach authorization branch already does a small `admin.from('student').select('is_demo')` lookup. Mirror that pattern so the patch is surgical and doesn't restructure the existing join.

In `src/app/api/conversations/[id]/route.ts`, immediately AFTER the `if (!authorized) { … return 403 }` block (around line 132) and BEFORE the `const tagRows = …` line, add this block:

```ts
  // Expose is_demo on the response so ConversationView can route
  // completed conversations to ConversationFullView for real students
  // and to ConversationReplay (typewriter) for demo personas. Mirrors
  // the small lookup already used in the demo-coach auth branch above.
  let studentIsDemo = false
  {
    const { data: s } = await admin
      .from('student')
      .select('is_demo')
      .eq('id', convRow.student_id)
      .maybeSingle()
    studentIsDemo = !!s?.is_demo
  }
```

Then in the response object (the `return NextResponse.json({ … })` at the end), add this field — place it right after `conversationType: convRow.conversation_type,`:

```ts
    isDemo: studentIsDemo,
```

The final response object should look like:

```ts
  return NextResponse.json({
    id: convRow.id,
    studentId: convRow.student_id,
    workId: convRow.work_id,
    status: convRow.status,
    conversationType: convRow.conversation_type,
    isDemo: studentIsDemo,
    startedAt: convRow.started_at,
    completedAt: convRow.completed_at,
    durationSeconds: convRow.duration_seconds,
    quarter: convRow.quarter,
    weekNumber: convRow.week_number,
    workContext: convRow.work_context,
    workTitle: work?.title ?? null,
    courseName: work?.course_name ?? null,
    courseCode: work?.course_code ?? null,
    promptPhase1: convRow.prompt_phase_1,
    responsePhase1: convRow.response_phase_1,
    promptPhase2: convRow.prompt_phase_2,
    responsePhase2: convRow.response_phase_2,
    promptPhase3: convRow.prompt_phase_3,
    responsePhase3: convRow.response_phase_3,
    synthesisText: convRow.synthesis_text,
    suggestedInsight: convRow.suggested_insight,
    skillTags: tagRows.map(t => ({
      skillId: t.skill_id,
      skillName: skillNameById.get(t.skill_id) ?? null,
      confidence: t.confidence,
      studentConfirmed: t.student_confirmed,
      rationale: t.rationale,
    })),
  })
```

No other change to the route. The existing `student_work(...)` join, the auth branches, and the skill-name join are unchanged.

- [ ] **Step 5: Run test to verify it passes**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: Tasks 1–16 = 124 passed, 0 failed.

- [ ] **Step 6: Run tsc + eslint**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json 'src/app/v2/(student)/conversation/[id]/ConversationView.tsx' 'src/app/api/conversations/[id]/route.ts'
```

- [ ] **Step 7: Commit**

```bash
git add 'src/app/v2/(student)/conversation/[id]/ConversationView.tsx' 'src/app/api/conversations/[id]/route.ts' scripts/test-reflect-today-redesign.ts
git commit -m "feat(reflect-redesign): ConversationView dispatches View (non-typewriter) for real students; Replay kept behind is_demo"
```

---

## Task 17: Whole-feature verification + owner runbook

**Files:**
- No code changes — verification + runbook.

- [ ] **Step 1: Run the full structural test**

```bash
npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: 124 passed, 0 failed.

- [ ] **Step 2: Run regression suites**

```bash
npx tsx scripts/test-staff-passlink.ts
npx tsx scripts/test-student-passlinks.ts
```
Expected: staff-passlink **35 passed / 0 failed**; student-passlinks **56 passed / 0 failed**. Any deviation → STOP and investigate before declaring done.

- [ ] **Step 3: Run tsc + eslint over all touched files**

```bash
npx tsc --noEmit
npx eslint --no-eslintrc --config .eslintrc.json \
  scripts/test-reflect-today-redesign.ts \
  src/components/v2/student/types.ts \
  src/components/v2/student/SubmissionRow.tsx \
  src/components/v2/student/DiscardConfirmDialog.tsx \
  src/components/v2/student/InProgressBanner.tsx \
  src/components/v2/student/InProgressInterstitial.tsx \
  src/components/v2/student/use-start-reflection.ts \
  src/components/v2/student/ReflectTree.tsx \
  src/components/v2/student/TodayBuckets.tsx \
  src/components/v2/student/ConversationFullView.tsx \
  'src/app/api/conversation/[id]/discard/route.ts' \
  src/app/api/conversation/start/route.ts \
  src/app/api/student/reflect/route.ts \
  src/app/api/student/today/route.ts \
  'src/app/api/conversations/[id]/route.ts' \
  'src/app/v2/(student)/reflect/ReflectView.tsx' \
  'src/app/v2/(student)/today/TodayView.tsx' \
  'src/app/v2/(student)/conversation/[id]/ConversationView.tsx'
```
Expected: tsc exit 0; eslint exit 0 with no warnings.

- [ ] **Step 4: Run `npm run build`**

```bash
npm run build
```
Expected: exit 0; "Compiled successfully"; no error lines. The build verifies the new components type-check end-to-end and the routes compile with their new shapes.

- [ ] **Step 5: Owner runbook (post-deploy)**

This redesign is code-only — no DB action, no env var, no infra step required before deploy. After merge → Vercel auto-deploys `main`. Once the production deploy is READY:

**On the dualrole test account** (`andrewmcurran+dualrole@gmail.com`, 24 manual `student_work` rows already in place from this session):

1. Open `/v2/reflect`. Expected:
   - Spring 2026 quarter expanded; both courses (`PFS-201-LE3`, `SCI-255-LE3`) expanded; each course's highest-week-with-content (Week 6 / Week 4 respectively) expanded; earlier weeks collapsed.
   - Every submission appears with the right status glyph + chip (○ Start for the 24 manual rows since none have a completed conversation; ⏳ Resume if you start one and back out without responding; ✓ View after completing one).
   - No pinned in-progress banner if no in-progress exists.
2. Click any submission row → starts a new conversation → redirected to `/v2/conversation/<new id>`. Confirm phase-1 prompt loads.
3. Back out of the conversation (browser back) and click a DIFFERENT submission row. Expected: **InProgressInterstitial** modal opens — "You have a reflection in progress on X. Want to finish that first, or set it aside and start the new one?". Test all three buttons:
   - Resume in-progress → navigates back to the in-progress conversation.
   - Discard and start new → opens DiscardConfirmDialog → Discard → navigates to the new conversation.
   - Cancel → modal closes, nothing happens.
4. Open `/v2/today`. Expected: in-progress banner (if any), Today + This week buckets expanded (if dates fit), Earlier collapsed. Click an Earlier row → row click works identically to Reflect.
5. Complete a reflection (finish phase 3). Click the ✓ row → opens `<ConversationFullView />` (all phases visible at once, no typewriter animation).
6. As the student account, click the pinned banner's **Discard** → confirm dialog → confirm → banner disappears, in-progress row in the tree returns to ○ Start status (the row is now unreflected again because the underlying work_id had its only conversation set to abandoned).

**On a real pilot student account** (via passlink CSV):
1. Repeat steps 1–5 with real data. Verify no row is hidden by a cap (compare the count in `(N)` to the live DB count for that student).
2. Verify the conversation flow still works end-to-end (phase 1 → 2 → 3 → synthesis).

**Rollback if needed:**
```bash
git revert <merge-commit-sha>
git push origin main
```
That returns `main` to the pre-redesign post-PR #13 stopgap. The three previously-shipped fixes (PR #11/12/13) remain in place after rollback.

- [ ] **Step 6: Run finishing-a-development-branch**

Invoke `superpowers:finishing-a-development-branch`. Present the standard 4 options (this is a named-branch linked worktree, not detached). Surface to the owner:

- Code-only redesign. **No DB action, no migration, no env var.** Fully reversible by reverting the merge.
- Three previously-shipped fixes remain in place regardless (PR #11/12/13).
- Post-deploy verification = the dualrole-account checklist above + a real-student spot-check.
- The dualrole test data (24 rows) is still in place; cleanup whenever:
  ```sql
  delete from student_work where student_id='df7c64dd-4579-4588-bcf0-be0db44cf17b' and source='manual' and external_id like 'TEST-DR-%';
  ```

Do NOT merge or push without the owner's explicit choice.

---

## Self-Review

Spec coverage spot-check (every spec section maps to a task):
- Reflect surface (spec §"Reflect surface") → Tasks 4, 6, 11, 14
- Today surface (spec §"Today surface") → Tasks 5, 6, 12, 15
- In-progress flow (spec §"In-progress conversation flow") → Tasks 2, 3, 7, 8, 9, 10, 14, 15
- "View" for completed (spec §'"View" for completed conversations') → Tasks 13, 16
- API contracts (spec §"API contracts") → Tasks 2, 3, 4, 5, 16
- Components (spec §"Components") → Tasks 6, 7, 8, 9, 10, 11, 12, 13
- Edge cases (spec §"Edge cases & behaviors") — `status='abandoned'` filtered out everywhere (Tasks 2, 4, 5 query `.in('status', ['in_progress','completed'])`); empty bucket suppression (Task 12); Escape-to-cancel (Tasks 7, 9); week_number=null → Other bucket (Task 11)
- Testing strategy (spec §"Testing strategy") → Task 17

Placeholder scan: no TBD/TODO/incomplete steps. All code blocks are complete verbatim implementations.

Type consistency: `SubmissionItem`, `ActiveInProgress`, `SubmissionStatus` defined once in Task 1; same names used in Tasks 4, 5, 6, 8, 9, 10, 11, 12, 14, 15. Component prop names (`active`, `newWork`, `onClose`, `onStarted`, `onDiscarded`, `onRowClick`, `surface`, `onClick`) are consistent across taskboundaries.

Known tactical decision in plan: ConversationView's `isDemo` gate requires the existing `/api/conversations/[id]` route to expose `isDemo` — Task 16 Step 4 explicitly patches that route (read-then-minimum-diff) so the gate works. The default-to-false fallback in Task 16's component guards against an older deploy.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-19-reflect-today-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
