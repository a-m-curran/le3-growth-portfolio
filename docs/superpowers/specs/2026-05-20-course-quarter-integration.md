# Course Quarter Integration — Design Spec

**Date:** 2026-05-20
**Status:** Brainstormed + approved; ready for implementation plan.
**Base:** `main` at `94dae35` (post PR #14 redesign merge + PR #15 sync-week-number).
**Scope:** D2L Valence sync + course schema + admin-runnable backfill.

---

## Goal

Replace the placeholder `currentQuarter()` (calendar-quarter-at-sync-time) that the D2L sync currently writes to `assignment.quarter` and `student_work.quarter` with a real per-course quarter derived from D2L's CourseOffering payload, with a graceful priority chain.

---

## Background

The new `/v2/reflect` Quarter → Course → Week tree groups submissions by `student_work.quarter`. Because the D2L Valence sync's `processSubmission` writes `quarter: currentQuarter()` (the calendar quarter when the sync RUNS), every assignment and submission gets tagged with whatever quarter the sync happened in. Production data confirms:
- **`student_work`:** 6,879 of 6,899 rows tagged `"Spring 2026"` (~99.7%); the only divergences are 20 rows from older test runs / the dualrole manual seed.
- **`assignment`:** **556 of 556 rows tagged `"Spring 2026"`** — across 47 distinct courses, ZERO term variation in the persisted data.

D2L's CourseOffering endpoint (`GET /d2l/api/lp/{ver}/courses/{orgUnitId}`) exposes a `Semester` reference (an org unit whose `Name` is typically `"Spring 2026"`-style) plus `StartDate` and `EndDate` per course. The current Valence client (`src/lib/d2l/courses.ts`) only requests `Identifier, Name, Code, IsActive` — the term-relevant fields are discarded. The `NormalizedCourse` interface mirrors that minimal shape.

This spec pulls the missing fields and uses them as the source of truth.

---

## Non-goals

- Changing the `cohort` columns on `student` / `coach` / `course` (separate label from quarter; the sync's `cohort: currentQuarter()` write on line 384 of `sync-course.ts` is out of scope).
- Touching the non-sync `student_work` write paths: `/api/work/submit`, `/api/lti/notice`, `/api/work/import`, `src/lib/recovery/recover-extractions.ts`. They handle quarter on their own and remain unchanged.
- Multi-term-per-course (D2L's CourseOffering is single-term by design).
- D2L instance auto-discovery, term-org-unit walking, or other Brightspace structural changes.
- Backfilling courses that have been deleted from D2L between sync runs.

---

## Architecture

```
D2L CourseOffering API (per course)
   │
   ▼
raw D2LCourseOffering type (new, in src/lib/d2l/types.ts)
   │
   ▼  mapper (deriveQuarter helper, in src/lib/d2l/mappers.ts)
NormalizedCourse { quarter, startDate, semesterName, ... }
   │
   ▼  sync-course.ts upserts
course.quarter (DB)
   │
   ▼  read at write-time inside the same sync pass
assignment.quarter (DB)         ← was currentQuarter()
student_work.quarter (DB)       ← was currentQuarter()
   │
   ▼
/api/student/reflect, /api/student/today, ReflectTree
```

Priority chain inside `deriveQuarter`:

1. `Semester.Name` if it matches `/^(Winter|Spring|Summer|Fall)\s+\d{4}$/` — strict canonical only.
2. `StartDate` if parseable — derive Season from month (0–2=Winter, 3–5=Spring, 6–8=Summer, 9–11=Fall), use the date's year.
3. `currentQuarter()` — preserved as a safety net so sync never inserts NULL into a downstream NOT NULL column.

The mapper is a pure function — unit-testable via the structural test.

---

## D2L mapping

### Raw type (added to `src/lib/d2l/types.ts`)

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
  // but are not consumed by the sync.
}
```

### NormalizedCourse (extended)

```ts
export interface NormalizedCourse {
  orgUnitId: string
  name: string
  code: string | null
  active: boolean
  instructorEmail?: string
  /** Canonical "Season YYYY" form. Never null (currentQuarter() fallback ensures a value). */
  quarter: string
  /** Raw D2L StartDate, for traceability. */
  startDate: string | null
  /** Raw D2L Semester.Name, for traceability. */
  semesterName: string | null
}
```

### `deriveQuarter` helper (new, in `src/lib/d2l/mappers.ts`)

```ts
import { currentQuarter } from '@/lib/sync/quarter'   // see below — extract from sync-course.ts

const SEASON_BY_MONTH: ReadonlyArray<'Winter' | 'Spring' | 'Summer' | 'Fall'> = [
  'Winter', 'Winter', 'Winter',
  'Spring', 'Spring', 'Spring',
  'Summer', 'Summer', 'Summer',
  'Fall',   'Fall',   'Fall',
]

const CANONICAL = /^(Winter|Spring|Summer|Fall)\s+\d{4}$/

export function deriveQuarter(input: {
  semesterName: string | null
  startDate: string | null
}): string {
  if (input.semesterName && CANONICAL.test(input.semesterName)) {
    return input.semesterName
  }
  if (input.startDate) {
    const d = new Date(input.startDate)
    if (!isNaN(d.getTime())) {
      return `${SEASON_BY_MONTH[d.getMonth()]} ${d.getFullYear()}`
    }
  }
  return currentQuarter()
}
```

### Mapper updates

- `listCoursesUnderOrgUnit()` continues to use `/orgstructure/{id}/descendants/` (which returns lightweight `D2LOrgUnitDescendant` without Semester/StartDate). The descendant results are used only as a discovery list of org unit ids.
- `getCourse(orgUnitId)` is updated to request the full CourseOffering shape and run the discovered raw payload through the new mapper. Returns `NormalizedCourse` with the term fields populated.
- The sync pipeline (`sync-run.ts` / `sync-course.ts`) calls `getCourse(orgUnitId)` once per discovered course at the start of each course's sync iteration (it already does similar — see line 62 of `sync-course.ts`: `const courseRowId = await upsertCourse(course)`; `course` there is the NormalizedCourse passed in). Since the existing pipeline passes the discovered NormalizedCourse forward, the plan must enrich it with the full CourseOffering before the upsert — either by calling `getCourse(orgUnitId)` for each entry in the discovery list, or by extending `listCoursesUnderOrgUnit` to do the enrichment internally. **Default: enrich inside `listCoursesUnderOrgUnit`** so callers see fully-shaped NormalizedCourse objects (one extra `getCourse` call per discovered course; ~47 today). The descendant call alone is preserved for the "self is a course offering" fallback at line 47–65 of the current courses.ts.

### `currentQuarter()` extraction

`currentQuarter()` currently lives at `src/lib/sync/sync-course.ts:672`. The plan extracts it to a new module `src/lib/sync/quarter.ts` so both `mappers.ts` (for `deriveQuarter`'s fallback) and `sync-course.ts` (for the existing `cohort: currentQuarter()` call site) can import it without circular references. No behavior change.

---

## Schema

### Migration `019_course_quarter.sql` (owner-applied)

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

- Reversible: `alter table course drop column quarter`. The other two `.quarter` columns (assignment, student_work) are NOT touched by this migration — they keep their existing types.
- Owner-applied step (the implementer never runs migrations).

---

## Sync changes (`src/lib/sync/sync-course.ts`)

Five `currentQuarter()` call sites exist in the file today. **Four are in-scope** (changed to use the new per-course quarter); **one (line 384's `cohort`) is out of scope** and stays.

In-scope changes:

1. **Line 222** (course-cohort, inside upsertCourse) — `const quarter = currentQuarter()` → reuse `course.quarter` from the NormalizedCourse arg. Also: add `quarter: course.quarter` to the course insert/update.
2. **Line 449** (assignment, inside upsertAssignment) — `const quarter = currentQuarter()` → upsertAssignment gains a new `courseQuarter: string` parameter; the caller passes `course.quarter` from the sync loop; the function writes `courseQuarter` to `assignment.quarter`.
3. **Line 616** (student_work, inside processSubmission) — `quarter: currentQuarter()` → processSubmission gains a `courseQuarter: string` field on its params object; the caller (`syncSingleCourse`) passes `course.quarter`; the function writes `courseQuarter` to `student_work.quarter`.
4. **Line 647** (student_work, the second processSubmission-adjacent call site — verify in the file; this is the "Auto-tag with skills" downstream path or a separate insert variant) — same treatment as (3).

Out-of-scope (unchanged):

- **Line 384** (student-cohort, inside upsertStudent) — `cohort: currentQuarter()` — this is a cohort label, not a quarter; separate concern; stays.

The sync loop (`syncSingleCourse` at line ~50) already has `const courseRowId = await upsertCourse(course)`; `course` is the NormalizedCourse, which after this spec has a `quarter` field populated by the mapper. Pass `course.quarter` down through:
- `upsertAssignment(assignment, courseRowId, course.orgUnitId, course.quarter)` — new fourth arg.
- `processSubmission({ ..., courseQuarter: course.quarter })` — new field on the params object.

After the refactor, the only remaining `currentQuarter()` call site in the production write paths is the safety-net inside `deriveQuarter` (in `src/lib/d2l/mappers.ts`). Line 384's `cohort: currentQuarter()` continues to call into the extracted `src/lib/sync/quarter.ts` module.

---

## Backfill (`scripts/backfill-course-quarter.ts`)

Owner-runnable via `npx tsx scripts/backfill-course-quarter.ts`. Follows the established tsx CLI pattern (loads `.env.local`, uses own admin client, no `@/` aliases).

For each `course` row (47 today, with `brightspace_org_unit_id` non-null):
1. Read `course.id`, `course.brightspace_org_unit_id`, `course.quarter` (current value).
2. Call D2L `getCourse(brightspace_org_unit_id)` — uses the updated client; receives `NormalizedCourse` with `quarter` derived.
3. If derived quarter equals the stored value, **log skip + continue** (idempotent).
4. Else: in a single transaction —
   - `UPDATE course SET quarter = $derived WHERE id = $courseId`.
   - `UPDATE assignment SET quarter = $derived WHERE course_id = $courseId`.
   - `UPDATE student_work SET quarter = $derived WHERE assignment_id IN (SELECT id FROM assignment WHERE course_id = $courseId)`.
5. Log: courseId, name, old quarter (from DB), new quarter (from derivation), counts of assignment + student_work rows updated.
6. On D2L API failure for a single course: log the error, continue with the next course (don't abort the whole backfill).

Final summary log: total courses processed, total updated, total skipped, total errored. Exit 0 if no errors; exit 1 if any course errored (so an automation can detect failures).

---

## Testing

### New: `scripts/test-sync-quarter.ts`

Structural source-scan test via `npx tsx`, harness `_sync-test-harness`, marker pattern (same as `test-reflect-today-redesign.ts` etc.). Asserts:

- **`deriveQuarter` branches:**
  - Canonical Semester.Name `"Spring 2026"` → returned as-is.
  - Non-canonical Semester.Name `"SP26"` + valid StartDate `"2026-04-01"` → returns `"Spring 2026"` (StartDate-derived).
  - Non-canonical Semester.Name + no StartDate → returns a string matching `/^(Winter|Spring|Summer|Fall) \d{4}$/` (currentQuarter() shape).
  - Null Semester.Name + valid StartDate `"2025-10-15"` → returns `"Fall 2025"`.
  - Both null → returns `currentQuarter()` shape.
- **Migration 019 shape:** file exists, contains `alter table course add column quarter`, contains a comment.
- **`NormalizedCourse` extended:** type has `quarter: string`, `startDate: string | null`, `semesterName: string | null`.
- **`D2LCourseOffering` raw type:** has `Semester` and `StartDate` fields.
- **`sync-course.ts` post-refactor:** the three production write paths (upsertCourse insert, upsertAssignment insert, processSubmission insert) use `course.quarter` / a passed-in `courseQuarter` parameter, NOT `currentQuarter()` directly. Line 384's `cohort: currentQuarter()` is still present (regression guard for the out-of-scope cohort field).
- **`currentQuarter()` extraction:** lives at `src/lib/sync/quarter.ts` with the same return shape; `sync-course.ts` imports it.
- **Backfill script `scripts/backfill-course-quarter.ts`:** exists; has `dotenv` load + admin client (own, not `@/`); imports `getCourse` and `deriveQuarter`; contains three UPDATE statements; contains an idempotent skip.

### Regression

All must remain green at every gate:
- `scripts/test-sync-course.ts` 5/0
- `scripts/test-sync-engine.ts` 27/0
- `scripts/test-sync-dup-d2l-id.ts` 5/0
- `scripts/test-sync-inspect.ts` 12/0
- `scripts/test-sync-race.ts` 6/0
- `scripts/test-sync-run.ts` 8/0
- `scripts/test-staff-passlink.ts` 35/0
- `scripts/test-student-passlinks.ts` 56/0
- `scripts/test-reflect-today-redesign.ts` 125/0

Total regression target after this change: 280 passing assertions across the prior suites, plus whatever the new sync-quarter test ends up at (~15–20).

---

## Reversibility

- **Code:** revert the merge commit. Sync reverts to writing `currentQuarter()` everywhere; the new column on `course` becomes dead data (NULL for new inserts; old values harmlessly remain).
- **Schema:** migration 019 is cleanly reversible: `alter table course drop column quarter`.
- **Backfill:** idempotent and overwrite-only. To undo (rarely needed): a one-shot script could re-set `quarter` to the original placeholder, but practically the values being set ARE the correct derived values — there's nothing meaningful to undo.

The three previously-shipped fixes (PR #11/#12/#13/#15/#14/#16) are unaffected by this work.

---

## Open questions deferred to plan stage

- Whether `listCoursesUnderOrgUnit` enriches each descendant via a `getCourse` call internally (1 extra HTTP per course at discovery, bounded to ~47), or whether `syncSingleCourse` calls `getCourse` itself before `upsertCourse`. **Default: enrich inside `listCoursesUnderOrgUnit`** so callers always get fully-shaped NormalizedCourse.
- Whether to persist `course.start_date` / `course.semester_name` alongside `course.quarter` for traceability / re-derivation. **Default: NO** — derived quarter is the single persisted source of truth; raw fields stay in-memory on NormalizedCourse and are not stored.
- Whether to support non-canonical Semester naming conventions (e.g., `"SP26"`, `"2026-Spring"`, `"Spring 2026 - LE3"`). **Default: NO** — strict canonical regex; non-matching names fall through to StartDate derivation. Adding tolerant parsing is a follow-up if the backfill reveals NLU sends a consistent non-canonical format.
- Whether to expose the new `course.quarter` in any UI surface beyond ReflectTree (e.g., on the admin Tools page). **Default: NO** — this fix is purely about correctness of the existing `student_work.quarter` value flowing into ReflectTree.
