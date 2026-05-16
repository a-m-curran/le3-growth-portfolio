/**
 * Integration test for the per-course sync pipeline (syncOneCourse).
 *
 * Runs syncOneCourse() against a mocked Valence API and asserts that
 * the expected rows land in Supabase for a single course, that dedup
 * works on a second run, and that counts are correct.
 *
 * USAGE:
 *   npx tsx scripts/test-sync-course.ts
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
    section('syncOneCourse — single course (2001)')
    const courses = await listCoursesUnderOrgUnit(MOCK_STATS.le3OrgUnitId)
    const hum = courses.find(c => c.orgUnitId === '2001')!
    const res = await syncOneCourse({
      syncRunId: 'test-run',
      course: hum,
      mode: 'full',
      defaultCoachId: await ensureMockCoach(admin),
    })
    assertEqual(res.courseOuId, '2001', 'result.courseOuId is 2001')
    assertGte(res.counts.submissionsSynced, 1, 'HUM submissions synced >= 1')
    assertEqual(res.counts.errorsCount, 0, 'no errors for HUM')

    section('syncOneCourse — resume (re-run 2001 dedupes)')
    const res2 = await syncOneCourse({
      syncRunId: 'test-run-2', course: hum, mode: 'incremental',
      defaultCoachId: await ensureMockCoach(admin),
    })
    assertEqual(res2.counts.submissionsSynced, 0, 're-run inserts 0 new submissions')
    assertGte(res2.counts.submissionsSkipped, 1, 're-run skips >= 1 (dedup before download)')
  } finally {
    await cleanupMockData(admin)
    uninstallMockValence()
  }
  finish()
}
main()
