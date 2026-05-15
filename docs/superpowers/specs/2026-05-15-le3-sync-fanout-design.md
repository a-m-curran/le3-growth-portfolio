# LE3 Sync Fan-Out — Design Spec

**Date:** 2026-05-15
**Status:** Approved (design); pending implementation plan
**Owner:** Andrew Curran

## Problem

The LE3 D2L/Valence integration is confirmed working end-to-end (auth,
permissions, org traversal, classlist, dropbox, submissions, file download,
text extraction). The remaining failure is entirely in our own ingestion
infrastructure.

The current `runLe3Sync` is a single Trigger.dev task that walks all ~56 LE3
course offerings **sequentially in one process**. Two failure modes were hit
and partially mitigated:

1. **OOM** — `createAdminClient()` minted a fresh Supabase client per DB call
   (thousands per run, each with sub-clients + a refresh-timer). Killed the
   worker at ~15 courses. Mitigated by a memoized singleton (`c37e8e7`),
   `machine: large-2x` (`7d3fc10`), and `maxDuration: 3600` (`bc08b1a`).
2. **Non-convergence (unresolved)** — the engine has **no course-level
   cursor**. Every run re-walks all 56 courses *from the top*, re-fetching
   classlists and doing a DB dedup-lookup for every already-synced
   submission, before making any new forward progress. The first ~6 courses
   carry ~16 months of history; a single `maxDuration` window is fully
   consumed re-skipping prior work + grinding those few courses. Empirically:
   after 1.5+ hours of cumulative runtime across multiple runs, only **6 of
   56 courses** ever produced data and `real_students` never climbed past
   **15**. The design does not converge for a backfill this deep.

Resume-from-dedup makes re-runs *correct* but not *convergent*. A code change
is required to land the backfill at all.

## Decision: Per-Course Fan-Out (Approach A)

Replace the monolithic single-process loop with a parent orchestrator task
that fans out one child task per course offering, bounded by a Trigger.dev
queue. Chosen over a lighter "course-completion cursor" because this pilot
puts real student coursework in front of coaches/execs: per-course retry
isolation and a completion guarantee are the difference between a transient
D2L blip silently leaving courses' students with empty portfolios vs.
self-healing. Right-sized for pilot stakes, not architectural elegance.

### Settled decisions (from brainstorming)

| Decision | Choice |
|---|---|
| `sync_run` model | One parent row. Per-course progress/status streamed into the parent's Trigger.dev run metadata. No schema change; admin dashboard (`sync-inspect` → `SyncStatusPanel`/`LiveActivityPanel`, latest-10 newest-first) unchanged. Per-course history is not persisted past the run. |
| Failure semantics | Partial success = `completed`. Failed courses recorded in `sync_run.error_details` + parent metadata. Parent is `failed` *only* on pre-fan-out catastrophic failure (bad config / enumeration fails). Re-run picks up failed/unreached courses via existing resume-from-dedup. |
| Concurrency | Child task `queue: { concurrencyLimit: N }`, `N = env SYNC_COURSE_CONCURRENCY ?? 4`. Conservative default, env-tunable. Valence fetch layer retries 429 with backoff. |
| Scope | Keep the single-course `le3OrgUnitId` override (→ parent fans out exactly one child; preserves the sandbox/diagnostic workflow). Remove the inline-on-Vercel fallback entirely. |

## Architecture

### Task topology

- **`sync-le3` (parent)** — one run per logical sync. Orchestrates.
- **`sync-course` (child)** — one run per course offering. ~56 per backfill,
  1 for a single-course override.

### Components & responsibilities

**Parent `sync-le3`:**
1. Validate Valence config (catastrophic failure here ⇒ `sync_run` `failed`).
2. Create the single `sync_run` row (`status: running`).
3. Enumerate course OUs via the existing org-structure traversal. Honor the
   `le3OrgUnitId` override: a single course OU (no descendants) yields a
   1-element list.
4. Compute `defaultCoachId` **once** (currently `pickDefaultCoachId()`), pass
   it to every child — avoids 56 redundant lookups and a creation race.
5. `batchTriggerAndWait` the children, one payload per course.
6. Aggregate the returned `Result[]` into total counts + collected
   per-course errors.
7. Write a per-course status map into the parent run metadata as children
   report (children target `metadata.parent` / `metadata.root`).
8. Finalize the `sync_run` row: `completed`, aggregated counts,
   `error_details` listing failed courses.
- `maxDuration` stays generous (3600). `batchTriggerAndWait` is checkpointed
  — the parent does not burn compute or hold memory while children run.

**Child `sync-course`:**
- Input schema: `{ syncRunId, courseOuId, courseName, courseCode, mode, defaultCoachId }`.
- Runs `syncOneCourse()`: classlist → upsert instructors → resolve/upsert
  students (race-hardened) → upsert `student_course` → list assignments →
  per submission: pre-download dedup-check → download → extract → upsert
  `student_work`.
- Streams per-course progress/status to `metadata.parent` for live-activity.
- Returns `{ courseOuId, courseName, counts, errors }`.
- Own retry policy (per-course transient failures retried independently).
- Holds only **one course's** working set ⇒ peak memory structurally
  bounded. This is the real OOM fix; the singleton/large-2x/maxDuration
  changes become stopgaps that can later be relaxed (out of scope here).
- `maxDuration`: env-tunable `SYNC_COURSE_MAX_DURATION`, default **1200s**
  (not 600s). The heaviest foundational courses (e.g. ORG-101-LE3 — taken
  by the whole cohort across ~16 months, hundreds of submissions each
  needing download + extraction) are plausibly the slowest on the *first*
  backfill and could exceed a tight ceiling. A course that exceeds it
  fails only itself; the parent records it failed and continues, and the
  next run's pre-download dedup means the retry re-processes only that
  course's unfinished submissions — acceptable under partial-success
  semantics, but called out so a slow heavy course on run 1 is expected,
  not a surprise. Steady-state incremental runs are far under this.

**Engine decomposition (`src/lib/sync/sync-engine.ts`):**
- Extract the body of the current `for (const course of courses)` loop into
  `export async function syncOneCourse(params): Promise<CourseSyncResult>`.
- Expose `enumerateCourses()`, `createSyncRun()`, `finalizeSyncRun()` as
  separately-callable focused units the parent composes.
- Delete the monolithic single-process orchestration (no inline path).
- `syncOneCourse` must be unit-testable in isolation against a mocked
  Valence client.

**Write-race hardening:**
- `upsertStudent` and `upsertInstructor` change from check-then-insert to
  insert-then-catch-`23505`-and-refetch (the pattern `processSubmission`
  already uses for `student_work`). Required because a student/instructor
  shared across two courses is now processed by two children concurrently
  and would collide on `student_email_key` / `student_nlu_id_key`.
  Verified constraints: `student` is unique on `email`, `nlu_id`,
  `auth_user_id`.
- `upsertCourse` is per-child-unique (one course per child) — no race.
- `pickDefaultCoachId` becomes a parent-side one-time read passed down.

**API route (`src/app/api/admin/sync-le3/route.ts`):**
- Keeps coach auth + `isValenceConfigured()` check.
- Body: `{ mode?, source?, le3OrgUnitId? }`.
- Always enqueues the parent via `tasks.trigger`. **Inline fallback branch
  removed.** Returns `{ status: 'enqueued', triggerRunId }`.

### Data flow

```
coach → POST /api/admin/sync-le3
      → tasks.trigger('sync-le3', {mode, source, le3OrgUnitId?})
parent: createSyncRun(running)
      → enumerateCourses()         (honors single-course override)
      → pickDefaultCoachId()       (once)
      → batchTriggerAndWait( [{courseOuId,...} × N] )   queue concurrency=N
          child: syncOneCourse()
               → commit students/work incrementally (dedup-safe)
               → metadata.parent: per-course progress
               → return { counts, errors }
      → aggregate Result[]
      → metadata: final per-course status map
      → finalizeSyncRun(completed, counts, error_details)
dashboard: reads the single sync_run row (unchanged)
live-activity: reads parent run metadata for per-course detail
```

## Error handling

- Per-submission / per-student errors inside a child: collected and returned
  in the child result (existing behavior, unchanged).
- Child task throws (catastrophic course failure) → Trigger.dev retries per
  the child's retry policy → still failing ⇒ `batchTriggerAndWait` returns
  `{ ok: false, error }` for that item ⇒ parent marks that course failed in
  `error_details` + metadata and **continues**.
- Parent terminal status: always `completed` **except** a pre-fan-out
  catastrophic failure (config invalid / enumeration fails) ⇒ `failed`.
- Resume: a re-run re-enumerates and re-fans-out; children of already-done
  courses run fast (classlist + cheap pre-download dedup skips); unreached or
  failed courses are fully processed. Convergence is now ~1 run for the
  backfill because per-course work is parallel and bounded — the
  serial-window-exhaustion that caused non-convergence is eliminated.

## Idempotency / resume

- `student_work` dedup by `brightspace_submission_id`, checked **before**
  download/extraction — unchanged.
- `student` / `instructor` upserts idempotent and race-safe via the
  `23505`-catch-and-refetch path.
- No destructive reset anywhere; all writes remain check/insert-or-upsert.

## Testing

- **Unit:** `syncOneCourse` against a mocked Valence client (classlist /
  dropbox / submission fixtures) — asserts upserts, pre-download dedup skip,
  `23505` handling.
- **Race:** two concurrent `syncOneCourse` calls sharing a student ⇒ no
  duplicate row, no unhandled `23505`.
- **Integration:** `le3OrgUnitId = 254698` (sandbox) ⇒ parent fans out 1
  child ⇒ `sync_run` `completed` + expected `student_work` rows.
- **Backfill smoke:** full fan-out vs `248714` ⇒ `real_students` climbs past
  15, > 6 distinct courses in `student_work`, `sync_run` `completed`,
  parent metadata shows per-course terminal states.
- **Resume:** interrupt mid-run, re-trigger ⇒ no duplicate work, remaining
  courses fill.

## Rollout

- **No DB schema change.** `sync_run` model unchanged (single parent row);
  per-course detail is Trigger.dev run metadata.
- Deploy sequence: git push (Vercel — for the route change) **then
  `npx trigger.dev@latest deploy`** (load-bearing — registers both the
  parent and child tasks; git/Vercel alone does not update Trigger.dev
  workers).
- First post-deploy run is still the full backfill but now parallel and
  per-course bounded; expected to converge in ~1 run.
- Cleanup: existing zombie `sync_run` rows already marked `failed`
  (`f67c674c`, `3d67755d`); the in-flight `05fcf873` is harmless and will be
  cleaned up after deploy.

## Out of scope / non-goals (YAGNI)

- Dialing the machine preset back down from `large-2x` (possible once
  per-child memory is proven bounded — separate follow-up).
- Persisting per-course history as DB rows (explicitly rejected — metadata
  is sufficient; revisit only if per-course historical reporting is needed).
- Threshold-based failure status (rejected — partial-success = completed).
- The v2 front-door cutover and other unrelated pilot work.
- Any change to the Valence auth/permission layer (confirmed working).
