# Coach Caseload Overview — Design Spec

**Date:** 2026-05-18
**Status:** Approved (design); pending implementation plan
**Owner:** Andrew Curran
**Scope:** Coach-first; an instructor-scoped mode is a deferred, separate spec.

## Problem / Goal

The v2 coach caseload (`/v2/coach/caseload`) is a thin alphabetical
student list (conversation count, last activity, a `needsAttention`
boolean). Coaches asked to see, at a glance, each student's progress and
whether they have outstanding/overdue assignments — neither of which any
current coach surface shows. `/v2/coach` (Today) covers daily/session
triage and `/v2/coach/[studentId]` covers per-student depth, but there is
no caseload-level progress + outstanding-work overview.

**Goal:** evolve the existing caseload in place into a blended overview —
per-student engagement + outstanding/overdue work + an enriched
attention flag — as a scannable two-line worklist with a caseload rollup
strip, reusing the existing permission model with no schema change.

## Recon facts this design rests on (verified, read-only)

- Coach v2 surfaces today: `/v2/coach` (Today triage), `/v2/coach/
  caseload` (CaseloadView — alphabetical list with conversationCount,
  lastActivityAt, needsAttention; filters All / Needs attention),
  `/v2/coach/[studentId]` (Prep/Portfolio/Notes), `/v2/coach/tools`
  (ADMIN_EMAILS-gated).
- Permission model: coach→student is the `student.coach_id` FK enforced
  in application code, not RLS. `getV2Identity()` → `getV2CoachId()`
  resolves the authenticated coach; data is read via the service-role
  admin client and explicitly filtered by `coach_id`/`student_id`. RLS
  exists on `course`/`assignment`/`student_course`/`sync_run` (coach
  policies) but core tables (`student`, `student_work`,
  `growth_conversation`, `student_goal`, `coach_note`) are deliberately
  app-scoped. → A coach caseload overview is fully implementable with the
  established pattern; **no RLS change**.
- The existing caseload already does live per-request aggregation (it
  backs `/api/coach/students`), so extending it with more set-based
  aggregates follows the established pattern.
- Instructor is a distinct role (`course.instructor_id` + `student_
  course`), a different scoping axis than coach — out of scope here, but
  the data interface is frozen so an instructor mode can be added later
  without UI change.

## Settled decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Scope of this spec | Coach blended overview now; **coach-first, instructor-aware** (instructor-scoped mode = deferred separate spec; data interface frozen for it). |
| Placement | **Evolve `/v2/coach/caseload` in place** — no new surface, reuse route/nav, zero IA overlap. Today stays for daily/session triage. |
| Columns in v1 | **All**: Student · Last active · Conversations · Reflection coverage · Goals (active/stalled) · Outstanding/Overdue · Last coach touch · Trajectory · Attention+reason · plus a caseload **Rollup** strip. |
| Layout | **Two-line row** (primary line: name · attention+full reason · coverage · out/due · last active; secondary line: conv · goals · last touch · trajectory). Scannable, responsive (collapses to one column on mobile). Each row → existing Prep tab (worklist behaviour). |
| Compute strategy | **Live, batched** set-based queries (GROUP BY across the caseload; never per-student loops) behind one typed `getCoachCaseloadOverview(coachId)` whose return type is frozen so a precomputed summary or instructor scoping can replace internals with zero UI change. No new schema/API. |

## Architecture

Pure v2-frontend + one new server-side data function. **No schema
change, no new API route, no RLS change.** The caseload server component
resolves the coach via `getV2Identity()`/`getV2CoachId()`; the new data
function runs a small set of set-based queries via the admin client,
**every query filtered by the authenticated coach id** (the security
invariant — a client-supplied id is never trusted). Metrics are computed
live per page-load; a coach caseload is tens of students, so set-based
queries keep this well within budget.

## Components / exact change set

**Create — `getCoachCaseloadOverview` data function**, in the existing
coach data module that backs the caseload (the module behind
`/api/coach/students`; exact file path pinned in the implementation
plan):
- `getCoachCaseloadOverview(coachId: string): Promise<{ rows:
  CaseloadRow[]; rollup: CaseloadRollup }>`.
- `CaseloadRow` (**frozen interface** — instructor mode / summary swap
  must not change it): `studentId, name, lastActiveDays,
  conversationCount, reflectionCoveragePct, goalsActive, goalsStalled,
  outstandingCount, overdueCount, lastCoachTouchDays, trajectory:
  'up'|'flat'|'down', needsAttention: boolean, attentionReasons:
  string[]`.
- `CaseloadRollup`: `studentCount, needsAttentionCount,
  withOverdueCount, medianReflectionCoveragePct`.
- Implemented as set-based queries: (a) coach's students (`coach_id =
  coachId`, `is_demo = false`); (b) per-student work + conversation
  aggregates; (c) outstanding/overdue via `assignment` (active) ×
  `student_course` × `student_work` × `due_date`; (d) `student_goal`
  active/stalled; (e) `coach_note` recency per student; (f) two 14-day
  engagement-count windows for trajectory. Assembled in code into rows +
  rollup. **No awaited query inside a per-student loop.**

**Modify — caseload page** (`src/app/v2/(coach)/coach/caseload/page.tsx`,
recon-confirmed):
- Replace the thin list with a `CaseloadRollup` strip then `CaseloadRow`
  two-line rows, preserving the existing All / Needs-attention filter.
- Extract presentational `CaseloadRow` / `CaseloadRollup` components
  (alongside the page) so the page stays lean. Row click → existing
  per-student Prep route (target unchanged).

**Explicitly UNCHANGED:** `/api/coach/students`; `getV2Identity` /
`getV2CoachId`; `/v2/coach` Today; `/v2/coach/[studentId]`; all
schema/migrations; RLS; demo-as.

## Metric definitions (pinned — resolves prior ambiguity)

- **Reflection coverage:** % of the student's `student_work` rows with
  ≥1 associated `growth_conversation`. Implementation verifies the
  conversation↔work linkage; if conversations are student-level not
  work-level, degrade to "work items with any conversation in the same
  quarter" (explicit documented fallback).
- **Outstanding:** an `active` assignment in a course the student is
  enrolled in (`student_course`) with no matching `student_work`.
  **Overdue:** outstanding **and** `assignment.due_date < now()`.
- **Trajectory:** sign of (engagement events last 14d − prior 14d) →
  `'up'`/`'flat'`/`'down'`; `'flat'` within ±1 event. Engagement event =
  a new `student_work` or `growth_conversation` in the window.
- **Goals:** active = `student_goal` not completed/abandoned; **stalled**
  = active with no progress/update in **21 days**.
- **Last coach touch:** days since the most recent `coach_note` for
  (coachId, studentId).
- **Attention:** flagged if inactive ≥14d **OR** ≥1 overdue **OR** ≥1
  stalled goal; `attentionReasons` = the matched subset, rendered inline
  on the primary line.
- **Rollup:** `studentCount`; `needsAttentionCount`; `withOverdueCount`
  (≥1 overdue); `medianReflectionCoveragePct`.

## Data flow

```
caseload page (server)
  → getV2Identity() → coachId   (coach-only; non-coach → existing redirect/empty)
  → getCoachCaseloadOverview(coachId)
      → set-based queries (students; work+conv aggregates;
        outstanding/overdue; goals; coach_note recency;
        2× 14d engagement windows)
      → assemble { rows: CaseloadRow[], rollup }
  → render Rollup strip + two-line rows (All / Needs-attention filter)
  → row click → existing /v2/coach/[studentId] Prep
```

## Error handling / security

- Coach-only: role check via `getV2Identity()`; non-coach gets the
  existing redirect/empty behaviour.
- Every query is server-side scoped by `coachId`; `is_demo = false`
  preserved (consistent with the existing caseload).
- **Graceful degradation:** if a single metric query fails, that column
  renders "—" for affected rows; the caseload still loads (one failing
  metric never 500s the page).
- No data exposed beyond what coaches already see on existing surfaces;
  no client-supplied identifiers trusted.

## Testing / definition of done

- **Structural source-scan** (`npx tsx
  scripts/test-coach-caseload-overview.ts`, repo `_sync-test-harness`
  convention — no `bootstrapTestEnv`, local `read()`/`stripComments()`,
  single `finish()`): asserts the caseload page imports/uses
  `getCoachCaseloadOverview`; the function filters by `coachId`; the
  two-line row renders the locked fields; the rollup is rendered; no
  per-student query loop (set-based heuristic — no awaited query inside a
  `students.map`/`for…of`).
- Gates: `npx tsc --noEmit` exit 0 · `npx eslint --no-eslintrc --config
  .eslintrc.json <files>` no warnings · `npm run build` exit 0.
- **Manual:** a coach sees only their own caseload; spot-check metrics
  against a direct DB query; the two-line row collapses cleanly on
  mobile; row → Prep navigates correctly; All / Needs-attention filter
  works.

## Rollout & sequencing

Code-only; no migration; own PR. Independent of other in-flight work
(touches only the coach caseload surface + the coach data module). No
cross-spec sequencing constraint.

## Out of scope / non-goals

- Instructor-scoped mode (deferred separate spec; the `CaseloadRow` /
  function interface is frozen so it slots in without UI change).
- Precomputed/materialized summary (live batched chosen; the frozen
  interface allows swapping later if scale demands).
- Any schema/migration change; any RLS change; any new API route.
- Write or notification actions from the dashboard (read + navigate
  only).
- Session modeling beyond `coach_note` for "last coach touch".
