/**
 * Integration test for the LE3 sync engine.
 *
 * Drives the fan-out sync composition (`runFanoutLikeSync()`, defined
 * below) twice against a mocked Valence API (see
 * src/lib/d2l/__mocks__/mock-valence.ts) and asserts that every expected
 * row lands in Supabase, that dedup works on the second run, and that
 * the sync_run observability table records the attempt correctly.
 *
 * This is the closest thing we have to "what happens when NLU sends us
 * real credentials" without actually having those credentials. If this
 * passes, we have strong evidence that the sync engine will work against
 * a real Brightspace instance — the only thing the mock doesn't exercise
 * is the HTTP layer itself (Brightspace quirks, rate limiting, etc.)
 *
 * USAGE:
 *   npx tsx scripts/test-sync-engine.ts
 *
 * WHAT IT DOES:
 *   1. Loads Supabase credentials from .env.local
 *   2. Stubs the Valence env vars with harmless dummy values
 *   3. Installs the mock fetch dispatcher
 *   4. Runs runFanoutLikeSync() (first run — full sync)
 *   5. Asserts: courses, assignments, students, submissions all written
 *   6. Runs runFanoutLikeSync() again (second run — incremental)
 *   7. Asserts: no duplicate work rows, submissions_skipped reflects dedup
 *   8. Cleans up: deletes all rows it inserted (matched by external_id
 *      prefix 'd2l:mock:', brightspace_submission_id numeric mock range,
 *      or email ending with '@mock.test')
 *
 * NOTES:
 *   - This test writes to the real Supabase database. Cleanup runs in a
 *     finally block so data doesn't pile up if assertions fail. Every
 *     mock row uses a prefix/marker that makes cleanup targetable.
 *   - The auto-tagger runs for real and will hit Anthropic. That's about
 *     15 LLM calls per run, roughly $0.05-0.15 per test invocation at
 *     current Sonnet pricing. Set DISABLE_AUTOTAG=1 to skip if you want
 *     to run the test cheap.
 */

import {
  bootstrapTestEnv,
  assertEqual,
  assertGte,
  section,
  finish,
  skipAutotag,
  cleanupMockData,
  MOCK_COURSE_ORG_UNIT_IDS,
  MOCK_ASSIGNMENT_FOLDER_IDS,
  MOCK_EMAIL_DOMAIN_PATTERN,
} from './_sync-test-harness'

bootstrapTestEnv()

import {
  installMockValence,
  uninstallMockValence,
  getMockRequestLog,
  MOCK_STATS,
} from '@/lib/d2l/__mocks__/mock-valence'
import {
  enumerateCourses, pickDefaultCoachId, createSyncRun,
  finalizeSyncRun, aggregateCourseResults,
} from '@/lib/sync/sync-run'
import { syncOneCourse, type CourseSyncResult } from '@/lib/sync/sync-course'
import { clearValenceTokenCache } from '@/lib/d2l/auth'
import { createAdminClient } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'

async function runFanoutLikeSync(admin: SupabaseClient, mode: 'full' | 'incremental') {
  const courses = await enumerateCourses()            // mock OU 1001 via env
  const coachId = await pickDefaultCoachId(admin)
  const runId = await createSyncRun(admin, { source: 'd2l_valence_manual', mode, triggeredBy: 'mock-harness' })
  const started = Date.now()
  const results: CourseSyncResult[] = []
  for (const course of courses) {
    results.push(await syncOneCourse({ syncRunId: runId, course, mode, defaultCoachId: coachId }))
  }
  const agg = aggregateCourseResults(results)
  await finalizeSyncRun(admin, runId, agg, started, 'completed')
  return { syncRunId: runId, counts: agg.counts, errors: agg.errors, durationMs: Date.now() - started }
}

// Mock student d2l_user_ids — engine-only assertion data. The course /
// folder / email-domain markers live in the shared harness.
const MOCK_STUDENT_D2L_USER_IDS = ['5001', '5002', '5003', '5004']

// ─── Main ──────────────────────────────────────────

async function main(): Promise<void> {
  const admin = createAdminClient()

  section('Setup')
  console.log(`  Mock stats:`)
  console.log(`    LE3 org unit: ${MOCK_STATS.le3OrgUnitId}`)
  console.log(`    Courses: ${MOCK_STATS.courseCount}`)
  console.log(`    Instructors: ${MOCK_STATS.instructorCount}`)
  console.log(`    Students: ${MOCK_STATS.studentCount}`)
  console.log(`    Assignments: ${MOCK_STATS.assignmentCount}`)
  console.log(`    Submissions: ${MOCK_STATS.submissionCount}`)

  // Pre-test cleanup: wipe any stale mock data from a prior failed run
  await cleanupMockData(admin)
  console.log(`  Pre-test cleanup complete`)

  installMockValence()
  clearValenceTokenCache()

  let firstRunId: string | null = null
  let secondRunId: string | null = null

  try {
    // ═══ FIRST RUN (full sync) ═══════════════════
    section('First run — full sync')
    const firstRun = await runFanoutLikeSync(admin, 'full')
    firstRunId = firstRun.syncRunId

    console.log(`  Completed in ${firstRun.durationMs}ms`)
    console.log(`  Counts:`, firstRun.counts)
    if (firstRun.errors.length > 0) {
      console.log(`  Errors:`)
      firstRun.errors.slice(0, 5).forEach(e => {
        console.log(`    - [${e.stage}] ${e.context}: ${e.message}`)
      })
      if (firstRun.errors.length > 5) {
        console.log(`    ... and ${firstRun.errors.length - 5} more`)
      }
    }

    section('First run — assertions')
    assertEqual(
      firstRun.counts.coursesSynced,
      MOCK_STATS.courseCount,
      `counts.coursesSynced matches mock`
    )
    assertEqual(
      firstRun.counts.assignmentsSynced,
      MOCK_STATS.assignmentCount,
      `counts.assignmentsSynced matches mock`
    )
    assertEqual(
      firstRun.counts.submissionsSynced,
      MOCK_STATS.submissionCount,
      `counts.submissionsSynced matches mock`
    )
    assertEqual(
      firstRun.counts.studentsSynced,
      MOCK_STATS.studentCount,
      `counts.studentsSynced matches mock`
    )
    assertEqual(firstRun.counts.errorsCount, 0, `counts.errorsCount is zero`)

    // Verify the sync_run row itself
    const { data: runRow } = await admin
      .from('sync_run')
      .select('*')
      .eq('id', firstRun.syncRunId)
      .single()
    assertEqual(runRow?.status, 'completed', `sync_run.status = completed`)
    assertEqual(
      runRow?.source,
      'd2l_valence_manual',
      `sync_run.source recorded`
    )
    assertEqual(
      runRow?.triggered_by,
      'mock-harness',
      `sync_run.triggered_by recorded`
    )

    // Verify row counts in the database. Match by stable columns the
    // engine actually writes (brightspace_org_unit_id, brightspace_folder_id,
    // email, d2l_user_id) rather than guessing external_id prefixes.
    const { count: courseCount } = await admin
      .from('course')
      .select('*', { count: 'exact', head: true })
      .in('brightspace_org_unit_id', MOCK_COURSE_ORG_UNIT_IDS)
    assertEqual(courseCount, MOCK_STATS.courseCount, `course rows in db`)

    const { count: assignmentCount } = await admin
      .from('assignment')
      .select('*', { count: 'exact', head: true })
      .in('brightspace_folder_id', MOCK_ASSIGNMENT_FOLDER_IDS)
    assertEqual(
      assignmentCount,
      MOCK_STATS.assignmentCount,
      `assignment rows in db`
    )

    const { count: studentCount } = await admin
      .from('student')
      .select('*', { count: 'exact', head: true })
      .like('email', MOCK_EMAIL_DOMAIN_PATTERN)
    assertEqual(
      studentCount,
      MOCK_STATS.studentCount,
      `student rows in db`
    )

    // Verify students got d2l_user_id populated (fix for the bug we
    // just found — this is a regression guard)
    const { count: studentsWithD2lId } = await admin
      .from('student')
      .select('*', { count: 'exact', head: true })
      .like('email', MOCK_EMAIL_DOMAIN_PATTERN)
      .in('d2l_user_id', MOCK_STUDENT_D2L_USER_IDS)
    assertEqual(
      studentsWithD2lId,
      MOCK_STATS.studentCount,
      `all mock students have d2l_user_id populated`
    )

    // Look up mock student IDs so we can query their work
    const { data: mockStudents } = await admin
      .from('student')
      .select('id')
      .like('email', MOCK_EMAIL_DOMAIN_PATTERN)
    const mockStudentIds = (mockStudents || []).map(s => s.id)

    const { count: workCount } = await admin
      .from('student_work')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'd2l_valence_sync')
      .in('student_id', mockStudentIds)
    assertEqual(
      workCount,
      MOCK_STATS.submissionCount,
      `student_work rows in db`
    )

    // Verify all student_work rows have content extracted
    const { data: workWithContent } = await admin
      .from('student_work')
      .select('id, content, brightspace_submission_id, assignment_id')
      .eq('source', 'd2l_valence_sync')
      .in('student_id', mockStudentIds)

    const withContent = (workWithContent || []).filter(w => w.content && w.content.length > 50)
    assertGte(
      withContent.length,
      MOCK_STATS.submissionCount,
      `all student_work rows have extracted content`
    )

    // Verify all rows have brightspace_submission_id for dedup
    const withBsId = (workWithContent || []).filter(w => w.brightspace_submission_id)
    assertEqual(
      withBsId.length,
      MOCK_STATS.submissionCount,
      `all student_work rows have brightspace_submission_id`
    )

    // Verify assignment_id is populated (linking work to first-class assignment)
    const withAssignment = (workWithContent || []).filter(w => w.assignment_id)
    assertEqual(
      withAssignment.length,
      MOCK_STATS.submissionCount,
      `all student_work rows have assignment_id populated`
    )

    // Verify auto-tagging ran (unless disabled)
    if (!skipAutotag()) {
      const { count: tagCount } = await admin
        .from('work_skill_tag')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'llm_auto')
        .in(
          'work_id',
          (workWithContent || []).map(w => w.id)
        )
      assertGte(tagCount || 0, 1, `auto-tagger created at least some skill tags`)
    }

    // ═══ SECOND RUN (incremental, should dedup) ═
    section('Second run — incremental (should dedup)')
    const secondRun = await runFanoutLikeSync(admin, 'incremental')
    secondRunId = secondRun.syncRunId

    console.log(`  Completed in ${secondRun.durationMs}ms`)
    console.log(`  Counts:`, secondRun.counts)

    section('Second run — assertions')
    assertEqual(
      secondRun.counts.submissionsSynced,
      0,
      `second run synced zero new submissions (all dedup'd)`
    )
    assertEqual(
      secondRun.counts.submissionsSkipped,
      MOCK_STATS.submissionCount,
      `second run skipped ${MOCK_STATS.submissionCount} already-synced submissions`
    )
    assertEqual(
      secondRun.counts.errorsCount,
      0,
      `second run had zero errors`
    )

    // Verify no duplicate student_work rows
    const { count: workCountAfter } = await admin
      .from('student_work')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'd2l_valence_sync')
      .in('student_id', mockStudentIds)
    assertEqual(
      workCountAfter,
      MOCK_STATS.submissionCount,
      `student_work count unchanged after second run`
    )

    // ═══ Coverage — verify every endpoint was hit ══
    section('Request coverage')
    const log = getMockRequestLog()
    const uniqueUrls = new Set(log.map(r => r.url))
    console.log(`  Mock served ${log.length} requests (${uniqueUrls.size} unique URLs)`)
    const tokenCalls = log.filter(r => r.url.includes('/core/connect/token')).length
    assertGte(tokenCalls, 1, `at least one token exchange happened`)
    const descendantCalls = log.filter(r => r.url.includes('/descendants/')).length
    assertGte(descendantCalls, 1, `course discovery via descendants happened`)
    const classlistCalls = log.filter(r => r.url.includes('/classlist/')).length
    assertGte(classlistCalls, MOCK_STATS.courseCount, `classlist fetched for every course`)
    const folderCalls = log.filter(r => r.url.match(/dropbox\/folders\/?$/)).length
    assertGte(folderCalls, MOCK_STATS.courseCount, `dropbox folders listed for every course`)
    const submissionCalls = log.filter(r => r.url.match(/\/folders\/\d+\/submissions\/?$/)).length
    assertGte(submissionCalls, MOCK_STATS.assignmentCount, `submissions fetched for every assignment`)
    const fileCalls = log.filter(r => r.url.includes('/files/')).length
    assertGte(fileCalls, MOCK_STATS.submissionCount, `file downloaded for every submission`)
  } finally {
    // ═══ Cleanup ═══════════════════════════════
    section('Cleanup')
    uninstallMockValence()
    clearValenceTokenCache()
    await cleanupMockData(admin, firstRunId, secondRunId)
    console.log(`  Cleanup complete`)
  }

  finish()
}

main().catch(err => {
  console.error('\n\x1b[1;31m╳ Test harness crashed:\x1b[0m')
  console.error(err)
  process.exit(1)
})
