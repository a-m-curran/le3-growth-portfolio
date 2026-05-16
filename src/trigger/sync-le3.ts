/**
 * LE3 data sync — Trigger.dev v4 task.
 *
 * Enumerates all LE3 courses once, then fans out one `sync-course`
 * child task per course via batchTriggerAndWait (checkpointed; bounded
 * by the child's queue.concurrencyLimit so we never hammer D2L beyond
 * SYNC_COURSE_CONCURRENCY parallel fetches). Aggregates per-course
 * results into a single sync_run row.
 *
 * Triggering modes:
 *   - Scheduled: runs on a cron (configured below) for hands-off sync
 *   - Manual: triggered via POST /api/admin/sync-le3 when a coach hits
 *     the "Sync Now" button
 *   - Backfill: full historical sync on first pilot setup
 *
 * Scheduling: configured via Trigger.dev's schedules in the dashboard
 * or via tasks.trigger() from a separate schedule definition. For the
 * pilot we're using a cron-based schedule registered in Trigger.dev's
 * UI pointing at this task — set it to "0 * * * *" for hourly.
 */

import { schemaTask, metadata, logger } from '@trigger.dev/sdk'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  createSyncRun, finalizeSyncRun, enumerateCourses,
  pickDefaultCoachId, aggregateCourseResults,
} from '@/lib/sync/sync-run'
import { syncCourseTask } from '@/trigger/sync-course'
import type { CourseSyncResult } from '@/lib/sync/sync-course'

// ── Gap A: parent maxDuration vs fan-out wall-clock ──────────────────
// The parent blocks in syncCourseTask.batchTriggerAndWait() until every
// child resolves. Worst-case wall-clock for the one-time ~56-course
// backfill is ceil(courseCount / childConcurrency) waves, each up to the
// child's maxDuration — ≈ ceil(56/4) × 1200s ≈ 4.7h, far past a flat
// 3600s; exceeding it kills the PARENT mid-wait. That kill is bounded and
// non-destructive (children commit idempotently; resume-from-dedup
// finishes the tail on re-run) and only matters for the one-time
// backfill. So rather than restructure into fire-and-forget batchTrigger
// + a separate completion-triggered finalizer task (more robust as an
// end-state, but a larger change with live-fan-out surface that is
// untestable here, for a non-urgent / non-destructive gap), we
// deliberately size the parent ceiling to the fan-out worst case with
// margin. Reads the SAME child env vars so parent and child stay in
// lockstep, env-tunable so the one-time backfill can be widened without a
// redeploy, and never drops below the prior hand-tuned 3600s floor.
const CHILD_CONCURRENCY = Number(process.env.SYNC_COURSE_CONCURRENCY ?? '4')
const CHILD_MAX_DURATION = Number(process.env.SYNC_COURSE_MAX_DURATION ?? '1200')
// Expected upper bound on courses enumerated in one run (LE3 pilot ≈ 56).
const SYNC_LE3_MAX_COURSES = Number(process.env.SYNC_LE3_MAX_COURSES ?? '64')
// Multiplicative headroom over the ideal wave count: child retries
// (maxAttempts 3 + 429 back-off), queue scheduling latency, uneven
// per-course sizes.
const SYNC_LE3_DURATION_MARGIN = Number(process.env.SYNC_LE3_DURATION_MARGIN ?? '1.5')
const PARENT_MAX_DURATION = Math.max(
  3600,
  Math.ceil(
    Math.ceil(SYNC_LE3_MAX_COURSES / CHILD_CONCURRENCY) *
      CHILD_MAX_DURATION *
      SYNC_LE3_DURATION_MARGIN
  )
)

export const syncLe3Task = schemaTask({
  id: 'sync-le3',
  schema: z.object({
    mode: z.enum(['full', 'incremental']).default('incremental'),
    source: z
      .enum(['d2l_valence_scheduled', 'd2l_valence_manual', 'd2l_valence_backfill'])
      .default('d2l_valence_manual'),
    triggeredBy: z.string().optional(),
    le3OrgUnitId: z.string().optional(),
  }),
  // Bumped medium-1x (2 GB) → large-2x (16 GB) after the first real
  // 56-course LE3 sync OOM-killed at ~251s / ~15 courses. The sync
  // accumulates memory across courses (downloaded file buffers +
  // mammoth/pdf-parse working set), so peak RAM scales with cohort
  // size. 16 GB is deliberate over-provisioning to guarantee the
  // pilot ingest completes in a single pass; once the sync-engine
  // memory pattern is bounded per-submission (fast-follow) this can
  // come back down to medium/large-1x.
  machine: { preset: 'large-2x' },
  // Sized to the fan-out worst case (see PARENT_MAX_DURATION above) so the
  // parent is not killed mid-batchTriggerAndWait during the one-time
  // backfill. Steady-state incremental syncs finish in minutes and exit
  // well before this ceiling; it only matters for the one-time backfill.
  maxDuration: PARENT_MAX_DURATION,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60_000,
    randomize: true,
  },
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
      // handle.runs is index-aligned with the input `courses` batch, so a
      // failed child's course identity is recoverable via courses[i] —
      // surface it (not 'unknown') so sync_run.error_details is triageable
      // at 56-course scale. Indexed loop (not handle.runs.entries()) on
      // purpose: this repo's tsconfig sets no target/downlevelIteration,
      // so iterating an iterator trips TS2802 — array for-of/indexing is
      // the only form that compiles here.
      for (let i = 0; i < handle.runs.length; i++) {
        const run = handle.runs[i]
        if (run.ok) {
          results.push(run.output as CourseSyncResult)
        } else {
          const course = courses[i]
          results.push({
            courseOuId: course.orgUnitId, courseName: course.name, studentIds: [],
            counts: { coursesSynced: 0, studentsSynced: 0, assignmentsSynced: 0,
              submissionsSynced: 0, submissionsSkipped: 0, errorsCount: 1 },
            errors: [{ stage: 'course_process',
              context: `course=${course.name} ou=${course.orgUnitId}`,
              message: `child run failed (sync-course) for course=${course.name} ou=${course.orgUnitId}: ${String(run.error)}` }],
          })
        }
      }

      const agg = aggregateCourseResults(results)
      metadata.set('stage', 'completed').set('counts', agg.counts as unknown as Record<string, number>)
      await finalizeSyncRun(admin, syncRunId, agg, startedAt, 'completed')
      logger.info('sync-le3 completed', { syncRunId, counts: agg.counts })
      return { syncRunId, counts: agg.counts, errorCount: agg.errors.length }
    } catch (err) {
      await finalizeSyncRun(admin, syncRunId,
        { counts: { coursesSynced: 0, studentsSynced: 0, assignmentsSynced: 0,
          submissionsSynced: 0, submissionsSkipped: 0, errorsCount: 1 },
          errors: [{ stage: 'fatal', context: 'top-level', message: String(err) }] },
        startedAt, 'failed')
      throw err
    }
  },
})
