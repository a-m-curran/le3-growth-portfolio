/**
 * recover-course — Trigger.dev child task. Recovers empty-content
 * student_work rows for exactly ONE course (org unit). Fanned out by
 * the recover-empty-extractions parent. Bounded queue concurrency keeps
 * us under D2L rate limits; one-course working set keeps memory flat.
 * Mirrors src/trigger/sync-course.ts.
 */
import { schemaTask, metadata, logger } from '@trigger.dev/sdk'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase-admin'
import { recoverCourseExtractions } from '@/lib/recovery/recover-extractions'
import { ValenceRateLimitError } from '@/lib/d2l'

const CONCURRENCY = Number(process.env.RECOVER_COURSE_CONCURRENCY ?? '4')
const MAX_DURATION = Number(process.env.RECOVER_COURSE_MAX_DURATION ?? '1200')

export const recoverCourseTask = schemaTask({
  id: 'recover-course',
  schema: z.object({
    orgUnitId: z.string(),
    dryRun: z.boolean(),
    runAutoTag: z.boolean().default(false),
  }),
  queue: { name: 'recover-course', concurrencyLimit: CONCURRENCY },
  machine: { preset: 'large-1x' },
  maxDuration: MAX_DURATION,
  retry: {
    maxAttempts: 3, factor: 2,
    minTimeoutInMs: 5_000, maxTimeoutInMs: 60_000, randomize: true,
  },
  catchError: async ({ error }) => {
    // Sustained D2L rate-limiting: back the whole task off ~60s instead
    // of immediately re-triggering (mirrors sync-course).
    if (error instanceof ValenceRateLimitError) {
      return { retryAt: new Date(Date.now() + 60_000) }
    }
    return undefined
  },
  run: async (payload) => {
    metadata.parent.set(`course:${payload.orgUnitId}`, 'running')
    logger.info('recover-course start', { ou: payload.orgUnitId, dryRun: payload.dryRun })

    const admin = createAdminClient()
    const result = await recoverCourseExtractions({
      admin,
      orgUnitId: payload.orgUnitId,
      dryRun: payload.dryRun,
      runAutoTag: payload.runAutoTag,
    })

    metadata.parent.set(
      `course:${payload.orgUnitId}`,
      result.errors.length > 0 ? 'completed_with_errors' : 'completed'
    )
    logger.info('recover-course done', {
      ou: payload.orgUnitId, scanned: result.scanned, recovered: result.recovered,
    })
    return result
  },
})
