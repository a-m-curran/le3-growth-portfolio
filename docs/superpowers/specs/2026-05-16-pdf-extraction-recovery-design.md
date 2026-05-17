# PDF Extraction Fix + Empty-Row Recovery — Design Spec

**Date:** 2026-05-16
**Status:** Approved (design); pending implementation plan
**Owner:** Andrew Curran

## Problem / Goal

The LE3 fan-out backfill completed and converged (52 students, 61
courses, 3694 submissions), but **PDF text extraction was broken** the
whole time. `src/lib/extract-text.ts:43` does
`const pdfParse = require('pdf-parse')` and `pdf-parse@2.4.5` is
pdf.js-based: under Trigger.dev's bundled Node-21 sandbox the CJS
`require()` interop yields `pdfParse is not a function`, and pdf.js
needs the `DOMMatrix` browser global (`DOMMatrix is not defined`). The
`.docx` path on line 49 (`await import('mammoth')`) is unaffected and
works.

Result: of the synced `student_work` rows, **2,797 have extracted text**
(the working `.docx`/text path) and **2,953 are empty**. A
ground-truth-aware decomposition (joining the latest run `05a5a3ba`'s
`error_details`) breaks the 2,953 down as:

| Bucket | Count | What it is | In recovery scope? |
|---|---|---|---|
| PDF parse bug | ~1,313 | `pdfParse is not a function` / `DOMMatrix` | **Yes** |
| Unsupported media | 571 | images / video — no document text exists | No — correctly empty |
| Other download fail | 1 | one-off | No |
| No error recorded | 1,068 | submission existed, no extractable document | Mostly no |

**Honest caveat baked into the design:** only the latest run's
`error_details` was joined, so a PDF-bug row first attempted in an
earlier run has no joined error and is hiding in the 1,068 "no error"
bucket. **1,313 is a floor.** Earlier runs' error arrays may be
truncated, so this fuzziness is irreducible from the logs. The recovery
job therefore classifies by **ground truth — the actual file in
D2L** — not by the (possibly incomplete) error log.

Two goals:

1. **Fix the extractor** so all *future* syncs work.
2. **Recover the historical PDF-bug rows** — repopulate `content` for
   exactly the rows whose real D2L file is a now-supported type, without
   re-syncing, without touching anything else, and without paying for
   LLM auto-tagging.

**Hard constraint:** raw submission buffers were never persisted
(in-memory only during sync), so recovery *must* re-fetch from D2L. The
recovery write path must only `.update()` existing `student_work` rows'
`content`/`extractionError` — never insert, never touch other tables or
other students' rows, never run LLM tagging while the seam is off.

## Settled decisions (from brainstorming)

| Decision | Choice |
|---|---|
| PDF library | **`unpdf`** — purpose-built serverless/worker PDF text extraction (no-DOM pdf.js build, zero native deps, ESM), loaded via `await import('unpdf')` exactly like the working mammoth path. Drop `pdf-parse`. |
| Recovery scope | **By actual file type.** Parse `external_id` → re-list the D2L folder → inspect the real file extension → re-extract only now-supported types. Robust to the truncated-error-log caveat; catches PDF-bug rows hiding in the no-error bucket; skips media/no-file rows. |
| Job runtime | **Trigger.dev task**, per-course fan-out mirroring `sync-le3` → `sync-course`, reusing `fetchWithRetry` / `ValenceRateLimitError` / checkpointed-batch infra. Triggered from the admin Tools page. |
| LLM auto-tagging | **Off now.** Recovery only repopulates `content` + clears `extractionError`. Built with a `runAutoTag` seam (default false) so it can be enabled later without a rewrite. |
| Dry-run | **Default true.** A dry run does everything except the write and reports would-recover/skip counts by real file type — finally de-fuzzing the 1,313-floor / 1,068-caveat by ground truth before any write. |
| Sync history | **No `sync_run` row.** This is not a sync; reporting is via task return + Trigger dashboard, keeping sync history clean. |

Rejected: a local tsx script (re-invents rate-limit handling, risks the
OOM/timeout class the fan-out refactor just fixed, no dashboard
observability). Rejected: a `mode:'re-extract'` flag on the live
`sync-course` write path (puts conditional behavior in the real write
path — the same risk pattern explicitly rejected for the conversation
validator's Approach B). Rejected: pinning back to `pdf-parse@1.x` (dead
branch — the 1.x→2.x rewrite is what broke us, CJS interop was the
failure mode). Rejected: using `pdfjs-dist` legacy directly (more code
to write/maintain; `unpdf` is exactly that, done well and maintained).

## Architecture

### Component 1 — the extractor fix (`src/lib/extract-text.ts`)

Replace line 43's `const pdfParse = require('pdf-parse') as ...; const
result = await pdfParse(buffer)` with `unpdf`, loaded via
`await import('unpdf')` (mirroring line 49's mammoth pattern). Remove the
`pdf-parse` dependency from `package.json`. In `trigger.config.ts`: add
`unpdf` to `external:[...]` alongside `mammoth` if bundling requires it,
and update the existing comment that documented the pdf-parse/Node-21
hazard to record the resolution.

`extractText` is shared by **both** the live sync (`processSubmission`
in `src/lib/sync/sync-course.ts`) and the new recovery task. Fixing it
once stops *future* syncs reproducing the bug; recovery handles the
historical backlog. A committed sample-PDF fixture + a test asserting
`extractText` returns non-empty text from it closes the exact gap
(missing extractor test) that let this ship broken.

### Component 2 — recovery task (`src/trigger/recover-empty-extractions.ts` + `src/trigger/recover-course.ts`)

Per-course fan-out mirroring `src/trigger/sync-le3.ts` →
`src/trigger/sync-course.ts`:

- **Parent `recover-empty-extractions`:** enumerate courses that have
  empty rows; `batchTriggerAndWait` a `recover-course` child per course;
  aggregate child results (mirror `aggregateCourseResults` in
  `src/lib/sync/sync-run.ts`); return one summary. No `sync_run` row.
  `machine`/`maxDuration` mirror the sync parent. Accepts
  `{ dryRun=true, runAutoTag=false }`.
- **Child `recover-course`:** for each empty row in that course —
  1. Parse `external_id` (`d2l:{orgUnitId}:{folderId}:{submissionId}`).
  2. Re-list the D2L folder's submissions (one list call serves all
     rows sharing a folder — group rows by `folderId` within the child),
     reusing the same listing helper `sync-course` uses.
  3. Find the matching submission by `submissionId`; inspect its file's
     real extension.
  4. If the extension is now-supported (`isSupported`): download via the
     existing `leGetBuffer` (`src/lib/d2l/client.ts`), run the fixed
     `extractText`. On non-empty text and **not** `dryRun`:
     `.update()` that row's `content` + clear `extractionError`.
  5. If `runAutoTag` (default false): run the existing per-submission
     LLM skill auto-tagging. Off now — the seam exists, unused.
  6. Otherwise (unsupported, no file, submission gone, still-empty
     text): log and leave the row empty.

Reuses `fetchWithRetry` / `ValenceRateLimitError` / checkpointed
`batchTriggerAndWait` from the fan-out refactor.

### Component 3 — admin trigger surface

A button + result readout in `src/app/v2/(coach)/coach/tools/ToolsView.tsx`,
backed by a new admin-gated route
`src/app/api/admin/recover-extractions/route.ts`, mirroring
`src/app/api/admin/sync-le3/route.ts`: same
`identity.role==='coach' && isAdminEmail(identity.email)` gate, `503` if
no `TRIGGER_SECRET_KEY`, always enqueues the Trigger task. The route
passes `dryRun`/`runAutoTag` through. Default operator flow: dry-run →
review counts → real run.

## Data flow

```
admin → Tools page (already ADMIN_EMAILS-gated)
      → "Recover empty extractions" (dryRun=true) → POST /api/admin/recover-extractions
route : assert admin → trigger recover-empty-extractions { dryRun:true }
parent: enumerate courses with empty rows
      → batchTriggerAndWait recover-course per course
child : per empty row → parse external_id → re-list folder
      → match submission → check real extension
      → supported? leGetBuffer → fixed extractText
      → dryRun: COUNT only, no write
      → real:   .update() student_work.content + clear extractionError
parent: aggregate → return summary (scanned / recovered / still-empty by reason)
admin : reviews dry-run report → re-runs with dryRun=false → reviews final summary
```

**Re-runnable by construction:** a filled row is no longer empty, so a
re-run naturally resumes and shrinks the set. Because it `.update()`s
existing rows (never goes through `processSubmission`'s insert/dedup), it
sidesteps the resume-from-dedup skip problem entirely. No cursor needed.

## Error handling

- Per-row failure (file gone, folder relisted but submission missing,
  download 404, still-unsupported, empty text) → logged, row left empty,
  **non-fatal** to the course child.
- D2L rate limit → existing `ValenceRateLimitError` →
  `catchError` `{ retryAt: +60s }` (reused from the fan-out refactor).
- A whole-course child failure is isolated: the run still completes;
  that course's rows are reported as still-empty (partial success ⇒
  `completed`, mirroring the fan-out aggregation contract).
- Non-admin / unauthenticated at the route → `403`. No
  `TRIGGER_SECRET_KEY` → `503`.

## Write discipline (load-bearing invariant)

The recovery write path performs **only** `.update()` on `student_work`,
keyed by the row's own primary id, setting `content` and clearing
`extractionError`. **No `.insert` / `.upsert` / `.delete` anywhere**, no
other table, no other student's rows, no LLM tagging while
`runAutoTag` is false. Enforced by a structural string-scan test (same
technique as the parked conversation validator's zero-write test).

## Testing

`scripts/test-recover-extractions.ts` (established tsx + mock-valence
convention — copy scaffold from existing `scripts/test-sync-*.ts`):

1. **Regression (the gap that shipped this broken):** a committed sample
   PDF fixture → `extractText(fixtureBuffer, 'sample.pdf')` returns
   non-empty text.
2. **Structural invariant:** string-scan the recovery write module —
   zero `.insert(` / `.upsert(` / `.delete(`; the only `.update(` is the
   scoped `content`/`extractionError` fill.
3. **Behavioral (mock-valence, in-process):** seed an empty
   `student_work` row whose `external_id` points at a mock folder
   containing a PDF; snapshot row counts for the student/course; invoke
   `recover-course` in-process (imported and called directly, no running
   Trigger worker, mirroring how `scripts/test-sync-*.ts` call sync code
   directly); assert the row's `content` is now populated,
   `extractionError` cleared, **no other row or table touched**, and the
   LLM tagging function was **not** called (seam off).
4. **Dry-run:** same setup with `dryRun:true` → report shows
   `1 would-recover`, the row's `content` is still empty (no write).
5. **Auth:** non-admin identity at the route → `403`; admin → enqueues.

LLM extraction/output *quality* is not asserted (the fix is mechanical;
correctness is "non-empty text from a real PDF"). The decomposition's
exact PDF-bug count is intentionally **measured by the dry run against
ground truth**, not asserted in tests.

## Rollout

Two-step deploy (the recurring gotcha): git push → Vercel for the
route/UI; `npx trigger.dev@latest deploy` for the task (separate env
store). The `extract-text.ts` fix helps **all future syncs** the moment
it deploys. Recovery is run **once, manually**, by the admin: dry-run
first → review counts (this is also when the true PDF-bug number is
finally known by ground truth) → real run → review final summary. No DB
schema change. New dependency: `unpdf` (removes `pdf-parse`).

## Out of scope / non-goals (YAGNI)

- No LLM auto-tagging now (the `runAutoTag` seam exists, default off).
- No recovery of legitimately-empty rows (unsupported media / no-file /
  comment-only submissions) — they are correctly empty.
- No `sync_run` row; no sync-history coupling.
- No schedule/recurrence — one-time, manually triggered, re-runnable.
- No recovery of rows whose D2L file is gone (logged, left empty).
- No changes to the live `sync-course` write path beyond the shared
  `extract-text.ts` fix; no changes to `api/conversation/*` or the
  conversation engine.
- Not a perf/load tool; single admin-initiated walkthrough.
