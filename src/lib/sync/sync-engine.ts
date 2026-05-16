/**
 * LE3 sync engine — framework-agnostic core logic for pulling all LE3
 * data from D2L Valence into our Supabase database.
 *
 * This module is deliberately NOT coupled to Trigger.dev, Vercel Cron,
 * or any specific HTTP framework. It exposes pure async functions that
 * can be called from a Trigger.dev task, a Next.js API route, or a
 * local CLI script.
 *
 * High-level flow:
 *   1. Discover all course offerings under the configured LE3 org unit
 *   2. For each course:
 *      a. Upsert the course row
 *      b. Pull instructor and upsert as coach
 *      c. Pull student classlist and upsert each student row (with default coach)
 *      d. Upsert student_course enrollment rows
 *      e. Pull assignments (dropbox folders) and upsert assignment rows
 *      f. For each assignment, pull submissions
 *         - For each submission, download file → extract text → upsert student_work
 *           (deduped by brightspace_submission_id)
 *         - Run auto-tagger on newly-created work, insert work_skill_tag rows
 *   3. Write a sync_run row summarizing the outcome
 *
 * Error handling philosophy: per-course and per-submission errors are
 * caught, logged, counted, and the sync continues. Only a top-level
 * infrastructure failure (e.g. can't get a Valence token at all) should
 * abort the whole run.
 */

import { createAdminClient } from '@/lib/supabase-admin'
import {
  listCoursesUnderOrgUnit,
  getValenceConfig,
} from '@/lib/d2l'
import type {
  SyncRunSource,
  SyncRunMode,
} from '@/lib/types'
import { syncOneCourse } from '@/lib/sync/sync-course'
import { pickDefaultCoachId } from '@/lib/sync/sync-run'

// ─── PUBLIC API ─────────────────────────────────────

export interface SyncOptions {
  source: SyncRunSource
  mode: SyncRunMode
  triggeredBy?: string
  /** Optional override for the LE3 org unit (defaults to env config) */
  le3OrgUnitId?: string
  /** Optional progress callback for UI/metadata updates */
  onProgress?: (progress: SyncProgress) => void | Promise<void>
}

export interface SyncProgress {
  stage: 'starting' | 'courses' | 'enrollments' | 'assignments' | 'submissions' | 'completed'
  currentCourse?: string
  currentCourseIndex?: number
  totalCourses?: number
  counts: SyncCounts
}

export interface SyncCounts {
  coursesSynced: number
  studentsSynced: number
  assignmentsSynced: number
  submissionsSynced: number
  submissionsSkipped: number
  errorsCount: number
}

export interface SyncResult {
  syncRunId: string
  counts: SyncCounts
  errors: SyncError[]
  durationMs: number
}

export interface SyncError {
  stage: string
  context: string
  message: string
}

/**
 * Run a full LE3 sync. Creates a sync_run row FIRST so that every
 * attempted sync is visible in the observability table — even failures
 * due to missing env vars or upstream Brightspace outages. Then walks
 * the Valence API, upserts everything, and finalizes the sync_run row
 * with counts and timing.
 *
 * Throws only on catastrophic failure; per-item errors are collected
 * and returned in the result.
 */
export async function runLe3Sync(options: SyncOptions): Promise<SyncResult> {
  const startedAt = Date.now()
  const admin = createAdminClient()

  // Create sync_run row FIRST so failed config validation still shows up
  // as a recorded attempt in the database.
  const { data: syncRun, error: syncRunErr } = await admin
    .from('sync_run')
    .insert({
      source: options.source,
      mode: options.mode,
      status: 'running',
      triggered_by: options.triggeredBy || null,
    })
    .select('id')
    .single()

  if (syncRunErr || !syncRun) {
    throw new Error(`Failed to create sync_run: ${syncRunErr?.message}`)
  }

  const syncRunId = syncRun.id as string
  const counts: SyncCounts = {
    coursesSynced: 0,
    studentsSynced: 0,
    assignmentsSynced: 0,
    submissionsSynced: 0,
    submissionsSkipped: 0,
    errorsCount: 0,
  }
  const errors: SyncError[] = []
  const studentIdsTouched = new Set<string>()

  try {
    await options.onProgress?.({ stage: 'starting', counts })

    // Validate Valence config now that the sync_run row exists, so a
    // config error is recorded as a failed run rather than an untracked
    // throw. getValenceConfig() throws with a descriptive message listing
    // every missing env var.
    const config = getValenceConfig()
    const le3OrgUnitId = options.le3OrgUnitId || config.le3OrgUnitId

    // 1. Discover courses
    await options.onProgress?.({ stage: 'courses', counts })
    const courses = await listCoursesUnderOrgUnit(le3OrgUnitId)

    // Pick a default coach for *new student* records — must be a
    // real LE3 coach with a login. Instructors are NOT eligible.
    // Without a real coach, we can't provision new students.
    const defaultCoachId = await pickDefaultCoachId(admin)

    // 2. Process each course
    for (let i = 0; i < courses.length; i++) {
      const course = courses[i]

      await options.onProgress?.({
        stage: 'enrollments',
        currentCourse: course.name,
        currentCourseIndex: i,
        totalCourses: courses.length,
        counts,
      })

      const courseResult = await syncOneCourse({
        syncRunId,
        course,
        mode: options.mode,
        defaultCoachId,
      })

      // Merge per-course counts into run-level counts. Student IDs are
      // deduplicated via a global Set so students enrolled in multiple
      // courses count as one, matching the pre-refactor behaviour.
      counts.coursesSynced += courseResult.counts.coursesSynced
      for (const id of courseResult.studentIds) studentIdsTouched.add(id)
      counts.studentsSynced = studentIdsTouched.size
      counts.assignmentsSynced += courseResult.counts.assignmentsSynced
      counts.submissionsSynced += courseResult.counts.submissionsSynced
      counts.submissionsSkipped += courseResult.counts.submissionsSkipped
      counts.errorsCount += courseResult.counts.errorsCount
      errors.push(...courseResult.errors)

      await options.onProgress?.({
        stage: 'assignments',
        currentCourse: course.name,
        currentCourseIndex: i,
        totalCourses: courses.length,
        counts,
      })
    }

    await options.onProgress?.({ stage: 'completed', counts })

    // Finalize sync_run
    const durationMs = Date.now() - startedAt
    await admin
      .from('sync_run')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round(durationMs / 1000),
        courses_synced: counts.coursesSynced,
        students_synced: counts.studentsSynced,
        assignments_synced: counts.assignmentsSynced,
        submissions_synced: counts.submissionsSynced,
        submissions_skipped: counts.submissionsSkipped,
        errors_count: counts.errorsCount,
        error_details: errors.length > 0 ? errors : null,
      })
      .eq('id', syncRunId)

    return { syncRunId, counts, errors, durationMs }
  } catch (err) {
    // Catastrophic failure — mark run as failed and re-throw
    const durationMs = Date.now() - startedAt
    await admin
      .from('sync_run')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round(durationMs / 1000),
        courses_synced: counts.coursesSynced,
        students_synced: counts.studentsSynced,
        assignments_synced: counts.assignmentsSynced,
        submissions_synced: counts.submissionsSynced,
        submissions_skipped: counts.submissionsSkipped,
        errors_count: counts.errorsCount + 1,
        error_details: [
          ...errors,
          { stage: 'fatal', context: 'top-level', message: String(err) },
        ],
      })
      .eq('id', syncRunId)
    throw err
  }
}

// ─── RE-EXPORTS ──────────────────────────────────────

export { syncOneCourse } from '@/lib/sync/sync-course'
export type { CourseSyncResult, SyncOneCourseParams } from '@/lib/sync/sync-course'
export { pickDefaultCoachId, createSyncRun, finalizeSyncRun, enumerateCourses, aggregateCourseResults } from '@/lib/sync/sync-run'
