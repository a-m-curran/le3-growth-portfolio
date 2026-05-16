/**
 * Unit + integration tests for src/lib/sync/sync-run.ts
 *
 * Tests:
 *   1. aggregateCourseResults — pure function, no DB needed:
 *      verifies studentsSynced is the UNION size (not sum) and that
 *      other counts are summed correctly.
 *   2. createSyncRun + finalizeSyncRun — writes a real sync_run row,
 *      verifies persisted values, then deletes the test row.
 *
 * USAGE:
 *   npx tsx scripts/test-sync-run.ts
 */

import { bootstrapTestEnv, assertEqual, section, finish } from './_sync-test-harness'

bootstrapTestEnv()

import { createAdminClient } from '@/lib/supabase-admin'
import {
  createSyncRun, finalizeSyncRun, aggregateCourseResults,
} from '@/lib/sync/sync-run'
import type { CourseSyncResult } from '@/lib/sync/sync-course'

// ─── Helpers ────────────────────────────────────────

function fakeResult(
  ou: string,
  over: Partial<CourseSyncResult['counts']>,
  studentIds: string[],
  errs = 0
): CourseSyncResult {
  return {
    courseOuId: ou, courseName: `c${ou}`, studentIds,
    counts: { coursesSynced: 1, studentsSynced: studentIds.length,
      assignmentsSynced: 0, submissionsSynced: 0, submissionsSkipped: 0,
      errorsCount: errs, ...over },
    errors: errs ? [{ stage: 'submission_extract', context: ou, message: 'boom' }] : [],
  }
}

// ─── Main ──────────────────────────────────────────

async function main(): Promise<void> {
  const admin = createAdminClient()

  section('aggregateCourseResults: sums disjoint counts, UNIONS studentIds')
  // Course A students s1,s2,s3 ; Course B students s1,s4 (s1 shared).
  // Union = {s1,s2,s3,s4} = 4  (NOT 3+2=5).
  const agg = aggregateCourseResults([
    fakeResult('A', { submissionsSynced: 5 }, ['s1', 's2', 's3']),
    fakeResult('B', { submissionsSynced: 4 }, ['s1', 's4'], 1),
  ])
  assertEqual(agg.counts.coursesSynced, 2, 'coursesSynced summed (1+1)')
  assertEqual(agg.counts.studentsSynced, 4, 'studentsSynced is UNION size, not sum (s1 shared)')
  assertEqual(agg.counts.submissionsSynced, 9, 'submissionsSynced summed (5+4)')
  assertEqual(agg.counts.errorsCount, 1, 'errorsCount summed (0+1)')
  assertEqual(agg.errors.length, 1, 'errors collected')

  section('partial success finalizes as completed; aggregated values persisted')
  const runId = await createSyncRun(admin, { source: 'd2l_valence_manual', mode: 'full', triggeredBy: 'test' })
  await finalizeSyncRun(admin, runId, agg, Date.now() - 1000, 'completed')
  const { data: row } = await admin
    .from('sync_run')
    .select('status, errors_count, students_synced')
    .eq('id', runId).single()
  assertEqual(row!.status, 'completed', 'status completed despite 1 course error')
  assertEqual(row!.errors_count, 1, 'errors_count persisted')
  assertEqual(row!.students_synced, 4, 'persisted students_synced = deduped union (4)')
  await admin.from('sync_run').delete().eq('id', runId)

  finish()
}
main()
