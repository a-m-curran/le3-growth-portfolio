/**
 * sync-course — Trigger.dev child task. Syncs exactly ONE LE3 course.
 * Fanned out by the sync-le3 parent. Bounded queue concurrency keeps
 * us under D2L rate limits; one-course working set keeps memory flat.
 */
import { schemaTask, metadata, logger } from '@trigger.dev/sdk'
import { z } from 'zod'
import { syncOneCourse } from '@/lib/sync/sync-course'
import type { NormalizedCourse } from '@/lib/d2l'

const CONCURRENCY = Number(process.env.SYNC_COURSE_CONCURRENCY ?? '4')
const MAX_DURATION = Number(process.env.SYNC_COURSE_MAX_DURATION ?? '1200')

export const syncCourseTask = schemaTask({
  id: 'sync-course',
  schema: z.object({
    syncRunId: z.string(),
    course: z.object({
      orgUnitId: z.string(),
      name: z.string(),
      code: z.string().nullable().optional(),
    }).passthrough(),
    mode: z.enum(['full', 'incremental']),
    defaultCoachId: z.string().nullable(),
  }),
  queue: { name: 'sync-course', concurrencyLimit: CONCURRENCY },
  machine: { preset: 'large-1x' },
  maxDuration: MAX_DURATION,
  retry: {
    maxAttempts: 3, factor: 2,
    minTimeoutInMs: 5_000, maxTimeoutInMs: 60_000, randomize: true,
  },
  run: async (payload) => {
    const course = payload.course as unknown as NormalizedCourse
    metadata.parent.set(`course:${course.orgUnitId}`, 'running')
    logger.info('sync-course start', { ou: course.orgUnitId, name: course.name })

    const result = await syncOneCourse({
      syncRunId: payload.syncRunId,
      course,
      mode: payload.mode,
      defaultCoachId: payload.defaultCoachId,
    })

    metadata.parent.set(
      `course:${course.orgUnitId}`,
      result.counts.errorsCount > 0 ? 'completed_with_errors' : 'completed'
    )
    logger.info('sync-course done', { ou: course.orgUnitId, counts: result.counts })
    return result
  },
})
