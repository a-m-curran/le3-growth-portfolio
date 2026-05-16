/**
 * sync_run row lifecycle + parent-side orchestration helpers for the
 * fan-out LE3 sync. Framework-agnostic; the Trigger.dev parent task
 * composes these.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  listCoursesUnderOrgUnit, getValenceConfig, type NormalizedCourse,
} from '@/lib/d2l'
import type { SyncRunSource, SyncRunMode } from '@/lib/types'
import type { SyncCounts, SyncError } from '@/lib/sync/sync-engine'
import type { CourseSyncResult } from '@/lib/sync/sync-course'

export async function createSyncRun(
  admin: SupabaseClient,
  opts: { source: SyncRunSource; mode: SyncRunMode; triggeredBy?: string }
): Promise<string> {
  const { data, error } = await admin
    .from('sync_run')
    .insert({
      source: opts.source, mode: opts.mode,
      status: 'running', triggered_by: opts.triggeredBy || null,
    })
    .select('id').single()
  if (error || !data) throw new Error(`Failed to create sync_run: ${error?.message}`)
  return data.id as string
}

export async function enumerateCourses(le3OrgUnitIdOverride?: string): Promise<NormalizedCourse[]> {
  const config = getValenceConfig()
  const ou = le3OrgUnitIdOverride || config.le3OrgUnitId
  return listCoursesUnderOrgUnit(ou)
}

export async function pickDefaultCoachId(admin: SupabaseClient): Promise<string | null> {
  // Prefer a coach who has actually logged in (auth_user_id present).
  const { data: loggedIn } = await admin
    .from('coach')
    .select('id')
    .eq('status', 'active')
    .not('auth_user_id', 'is', null)
    .limit(1)
    .maybeSingle()
  if (loggedIn) return loggedIn.id as string
  // Fall back to any active coach (a seeded record without auth yet).
  const { data: anyActive } = await admin
    .from('coach')
    .select('id')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  return anyActive?.id ?? null
}

/**
 * Aggregate per-course results into run-level counts + errors.
 *
 * IMPORTANT: studentsSynced is the size of the UNION of studentIds
 * across all courses — NOT the sum of per-course counts. A student
 * enrolled in multiple courses appears in multiple CourseSyncResults
 * and must be counted once (this preserves the pre-fan-out monolith's
 * run-level dedup). Every other count is per-course-disjoint and is
 * summed.
 */
export function aggregateCourseResults(
  results: CourseSyncResult[]
): { counts: SyncCounts; errors: SyncError[] } {
  const counts: SyncCounts = {
    coursesSynced: 0, studentsSynced: 0, assignmentsSynced: 0,
    submissionsSynced: 0, submissionsSkipped: 0, errorsCount: 0,
  }
  const errors: SyncError[] = []
  const studentIdUnion = new Set<string>()
  for (const r of results) {
    counts.coursesSynced += r.counts.coursesSynced
    counts.assignmentsSynced += r.counts.assignmentsSynced
    counts.submissionsSynced += r.counts.submissionsSynced
    counts.submissionsSkipped += r.counts.submissionsSkipped
    counts.errorsCount += r.counts.errorsCount
    for (const id of r.studentIds) studentIdUnion.add(id)
    errors.push(...r.errors)
  }
  counts.studentsSynced = studentIdUnion.size
  return { counts, errors }
}

export async function finalizeSyncRun(
  admin: SupabaseClient,
  syncRunId: string,
  agg: { counts: SyncCounts; errors: SyncError[] },
  startedAtMs: number,
  status: 'completed' | 'failed'
): Promise<void> {
  await admin.from('sync_run').update({
    status,
    completed_at: new Date().toISOString(),
    duration_seconds: Math.round((Date.now() - startedAtMs) / 1000),
    courses_synced: agg.counts.coursesSynced,
    students_synced: agg.counts.studentsSynced,
    assignments_synced: agg.counts.assignmentsSynced,
    submissions_synced: agg.counts.submissionsSynced,
    submissions_skipped: agg.counts.submissionsSkipped,
    errors_count: agg.counts.errorsCount,
    error_details: agg.errors.length > 0 ? agg.errors : null,
  }).eq('id', syncRunId)
}
