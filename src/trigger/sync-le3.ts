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
  // Raised 1800 → 3600 (60 min). The first real backfill walks ~15
  // months of program history across 56 courses serially; 30 min was
  // not enough headroom for a single-pass backfill. Resume-from-dedup
  // means a time-kill is non-destructive, but a wider window lets the
  // backfill finish in one run. Steady-state incremental syncs finish
  // in minutes — this ceiling only matters for the one-time backfill.
  maxDuration: 3600,
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
      for (const run of handle.runs) {
        if (run.ok) {
          results.push(run.output as CourseSyncResult)
        } else {
          results.push({
            courseOuId: 'unknown', courseName: 'unknown', studentIds: [],
            counts: { coursesSynced: 0, studentsSynced: 0, assignmentsSynced: 0,
              submissionsSynced: 0, submissionsSkipped: 0, errorsCount: 1 },
            errors: [{ stage: 'course_process', context: 'child-run',
              message: `child run failed: ${String(run.error)}` }],
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
