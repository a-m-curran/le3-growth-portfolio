/**
 * recover-empty-extractions — Trigger.dev parent task.
 *
 * One-time recovery of the student_work rows the PDF-extraction bug
 * left empty. Enumerates the org units that still have empty
 * d2l_valence_sync rows, fans out one recover-course child per org via
 * batchTriggerAndWait (checkpointed; bounded by the child's queue
 * concurrency), aggregates into one summary, and RETURNS it.
 *
 * Deliberately writes NO sync_run row — this is not a sync; observability
 * is the Trigger dashboard + the returned summary. Mirrors the
 * src/trigger/sync-le3.ts fan-out shape.
 *
 * dryRun defaults TRUE: the safe default re-lists + classifies by real
 * file type and reports counts without writing. Run again with
 * dryRun:false to perform the content updates.
 */
import { schemaTask, metadata, logger } from '@trigger.dev/sdk'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  listEmptyWorkOrgUnits,
  aggregateRecoveryResults,
  type CourseRecoveryResult,
} from '@/lib/recovery/recover-extractions'
import { recoverCourseTask } from '@/trigger/recover-course'

export const recoverEmptyExtractionsTask = schemaTask({
  id: 'recover-empty-extractions',
  schema: z.object({
    dryRun: z.boolean().default(true),
    runAutoTag: z.boolean().default(false),
    triggeredBy: z.string().optional(),
  }),
  machine: { preset: 'medium-1x' },
  // Flat 3600s is deliberate — NOT the env-derived PARENT_MAX_DURATION
  // formula sync-le3.ts uses. The parent's own active compute is light
  // (enumerate empty-row org units, map the batch, aggregate, set
  // metadata); the bulk of its life is the batchTriggerAndWait wait,
  // which Trigger.dev v4 CHECKPOINTS — waits >5s do not accrue against
  // maxDuration (see CLAUDE.md), empirically confirmed in this project's
  // fan-out backfill where a 3600s-maxDuration parent finalized
  // `completed` at ~67min wall-clock. Recovery per-course work is also
  // strictly lighter than a full sync-course. If the ceiling is ever
  // hit anyway, the kill is non-destructive: the only write is the
  // content-only UPDATE and recovery is re-runnable by construction
  // (filled rows drop out of the empty set), so the operator re-runs
  // and it converges — only the final run's aggregate summary is
  // complete. A flat ceiling is therefore correct here, not an oversight.
  maxDuration: 3600,
  retry: {
    maxAttempts: 3, factor: 2,
    minTimeoutInMs: 5000, maxTimeoutInMs: 60_000, randomize: true,
  },
  run: async (payload) => {
    const admin = createAdminClient()
    metadata.set('stage', 'enumerating').set('dryRun', payload.dryRun)

    const orgUnits = await listEmptyWorkOrgUnits(admin)
    metadata.set('stage', 'fanning-out').set('totalOrgUnits', orgUnits.length)
    logger.info('recover fan-out', { orgUnits: orgUnits.length, dryRun: payload.dryRun })

    if (orgUnits.length === 0) {
      const empty = aggregateRecoveryResults([])
      metadata.set('stage', 'completed')
      return { dryRun: payload.dryRun, summary: empty }
    }

    const handle = await recoverCourseTask.batchTriggerAndWait(
      orgUnits.map(orgUnitId => ({
        payload: { orgUnitId, dryRun: payload.dryRun, runAutoTag: payload.runAutoTag },
      }))
    )

    const results: CourseRecoveryResult[] = []
    // Index-aligned with the batch input (orgUnits.map(...)), so a failed
    // child's org unit is recoverable for triage — mirrors sync-le3.ts's
    // failed-course identity recovery rather than an opaque 'unknown'.
    for (let i = 0; i < handle.runs.length; i++) {
      const run = handle.runs[i]
      if (run.ok) {
        results.push(run.output as CourseRecoveryResult)
      } else {
        results.push({
          orgUnitId: orgUnits[i],
          scanned: 0, recovered: 0,
          stillEmpty: { unsupported: 0, noFile: 0, submissionGone: 0, emptyText: 0, downloadError: 0 },
          errors: [`child run failed (ou=${orgUnits[i]}): ${String(run.error)}`],
        })
      }
    }

    const summary = aggregateRecoveryResults(results)
    metadata.set('stage', 'completed')
      .set('scanned', summary.scanned)
      .set('recovered', summary.recovered)
    logger.info('recover completed', {
      dryRun: payload.dryRun, scanned: summary.scanned, recovered: summary.recovered,
    })
    return { dryRun: payload.dryRun, summary }
  },
})
