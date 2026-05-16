/**
 * Race-condition integration test for concurrent syncOneCourse calls.
 *
 * Exercises the shared-student fan-out race: students 5001 (Aja) and 5004
 * (Jordan) are enrolled in BOTH mock courses 2001 and 2002. Running both
 * syncOneCourse calls concurrently with Promise.all triggers the
 * check-then-insert race on student_email_key / student_nlu_id_key.
 *
 * USAGE:
 *   npx tsx scripts/test-sync-race.ts
 */

import {
  bootstrapTestEnv,
  assertEqual,
  assertGte,
  section,
  finish,
  cleanupMockData,
  ensureMockCoach,
} from './_sync-test-harness'

bootstrapTestEnv()

import {
  installMockValence,
  uninstallMockValence,
  MOCK_STATS,
} from '@/lib/d2l/__mocks__/mock-valence'
import { syncOneCourse } from '@/lib/sync/sync-course'
import { listCoursesUnderOrgUnit } from '@/lib/d2l'
import { clearValenceTokenCache } from '@/lib/d2l/auth'
import { createAdminClient } from '@/lib/supabase-admin'

// ─── Main ──────────────────────────────────────────

async function main(): Promise<void> {
  const admin = createAdminClient()
  await cleanupMockData(admin)
  installMockValence()
  clearValenceTokenCache()
  try {
    section('Concurrent syncOneCourse on both courses (shared students 5001,5004)')
    const courses = await listCoursesUnderOrgUnit(MOCK_STATS.le3OrgUnitId)
    const c1 = courses.find(c => c.orgUnitId === '2001')!
    const c2 = courses.find(c => c.orgUnitId === '2002')!
    const coachId = await ensureMockCoach(admin)

    // Run both courses CONCURRENTLY — this is the fan-out race.
    const [r1, r2] = await Promise.all([
      syncOneCourse({ syncRunId: 't', course: c1, mode: 'full', defaultCoachId: coachId }),
      syncOneCourse({ syncRunId: 't', course: c2, mode: 'full', defaultCoachId: coachId }),
    ])

    assertEqual(r1.counts.errorsCount, 0, 'course 2001 no errors under concurrency')
    assertEqual(r2.counts.errorsCount, 0, 'course 2002 no errors under concurrency')

    const { data: aja } = await admin
      .from('student').select('id').eq('d2l_user_id', '5001')
    assertEqual(aja?.length ?? 0, 1, 'shared student 5001 has exactly one row (no dup, no 23505 throw)')

    const ajaId = aja?.[0]?.id
    assertEqual(typeof ajaId === 'string', true, '5001 resolved to a single student id')
    const { data: ajaWork } = await admin
      .from('student_work')
      .select('id, course_name')
      .eq('student_id', ajaId as string)
    const ajaCourseNames = new Set((ajaWork ?? []).map(w => w.course_name))
    assertGte(
      ajaCourseNames.size,
      2,
      '5001 has work from both courses under one student_id (children converged, not just dedup-hidden)'
    )

    const { data: jordan } = await admin
      .from('student').select('id').eq('d2l_user_id', '5004')
    assertEqual(jordan?.length ?? 0, 1, 'shared student 5004 has exactly one row')
  } finally {
    await cleanupMockData(admin)
    uninstallMockValence()
  }
  finish()
}
main()
