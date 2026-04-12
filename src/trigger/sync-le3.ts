/**
 * LE3 data sync — Trigger.dev v4 task.
 *
 * Thin wrapper around src/lib/sync/sync-engine.ts. The sync engine is
 * framework-agnostic; this task adapts it to Trigger.dev's lifecycle,
 * metadata, and retry semantics.
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
import { runLe3Sync } from '@/lib/sync/sync-engine'

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
  machine: { preset: 'medium-1x' },
  maxDuration: 1800, // 30 minutes — most pilot syncs should finish in under 5
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60_000,
    randomize: true,
  },
  run: async (payload, { ctx }) => {
    logger.info('LE3 sync starting', {
      mode: payload.mode,
      source: payload.source,
      triggeredBy: payload.triggeredBy,
      runId: ctx.run.id,
    })

    metadata
      .set('stage', 'starting')
      .set('mode', payload.mode)
      .set('source', payload.source)
      .set('coursesSynced', 0)
      .set('studentsSynced', 0)
      .set('assignmentsSynced', 0)
      .set('submissionsSynced', 0)
      .set('errorsCount', 0)

    const result = await runLe3Sync({
      source: payload.source,
      mode: payload.mode,
      triggeredBy: payload.triggeredBy,
      le3OrgUnitId: payload.le3OrgUnitId,
      onProgress: async progress => {
        metadata
          .set('stage', progress.stage)
          .set('coursesSynced', progress.counts.coursesSynced)
          .set('studentsSynced', progress.counts.studentsSynced)
          .set('assignmentsSynced', progress.counts.assignmentsSynced)
          .set('submissionsSynced', progress.counts.submissionsSynced)
          .set('errorsCount', progress.counts.errorsCount)

        if (progress.currentCourse) {
          metadata.set('currentCourse', progress.currentCourse)
        }
        if (progress.totalCourses && progress.currentCourseIndex !== undefined) {
          const pct = (progress.currentCourseIndex / progress.totalCourses) * 100
          metadata.set('progressPct', Math.round(pct))
        }
      },
    })

    logger.info('LE3 sync completed', {
      syncRunId: result.syncRunId,
      counts: result.counts,
      durationMs: result.durationMs,
      errorCount: result.errors.length,
    })

    if (result.errors.length > 0) {
      logger.warn('LE3 sync completed with errors', {
        errors: result.errors.slice(0, 10),
        totalErrors: result.errors.length,
      })
    }

    return {
      syncRunId: result.syncRunId,
      counts: result.counts,
      errorCount: result.errors.length,
      durationMs: result.durationMs,
    }
  },
})
