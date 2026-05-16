/**
 * Integration test for src/lib/sync/sync-inspect.ts
 *
 * Guards the two properties the admin Sync Inspector exists to keep
 * honest — and which it historically violated:
 *
 *   1. TRUTHFUL COUNTS: every headline number equals a real
 *      `count(*)` (head:true,count:'exact'), NOT the length of a
 *      capped fetched array. Verified by issuing the same count query
 *      independently and asserting equality, and by inserting
 *      LIST_LIMIT+delta rows and asserting the reported total grows by
 *      exactly that many (the old array-length code would have frozen
 *      at the slice size).
 *
 *   2. BOUNDED LISTS: each row list is capped at exactly LIST_LIMIT
 *      even when the true total is far larger, so the response can
 *      never stream thousands of student_work rows (the Vercel
 *      timeout / OOM mode).
 *
 * Writes a handful of clearly-marked rows to the real DB and deletes
 * them in a finally block — same convention as scripts/test-sync-run.ts.
 *
 * USAGE:
 *   npx tsx scripts/test-sync-inspect.ts
 */

import { config as loadDotenv } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: resolve(__dirname, '..', '.env.local'), override: true })

import { createAdminClient } from '@/lib/supabase-admin'
import { gatherSyncInspection, LIST_LIMIT } from '@/lib/sync/sync-inspect'

// ─── Assertions ─────────────────────────────────────

let failed = 0
let passed = 0

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual === expected) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
    console.error(`    expected: ${JSON.stringify(expected)}`)
    console.error(`    actual:   ${JSON.stringify(actual)}`)
  }
}

function assertTrue(cond: boolean, label: string): void {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label} (condition was false)`)
  }
}

function section(title: string): void {
  console.log(`\n\x1b[1;36m━━━ ${title} ━━━\x1b[0m`)
}

const MARKER = `__test_sync_inspect__${Date.now()}`

// ─── Main ──────────────────────────────────────────

async function main(): Promise<void> {
  const admin = createAdminClient()

  // FK target for the seeded student_work rows. is_demo=true so it
  // never perturbs the is_demo=false student count we assert on.
  let tempCoachId: string | null = null
  let createdCoach = false
  let tempStudentId: string | null = null

  try {
    section('Reported counts equal real count(*) (not array length)')

    const snap = await gatherSyncInspection(admin)

    const [
      { count: realCourses },
      { count: realStudents },
      { count: realWork },
      { count: realWorkWith },
    ] = await Promise.all([
      admin.from('course').select('*', { count: 'exact', head: true }),
      admin
        .from('student')
        .select('*', { count: 'exact', head: true })
        .eq('is_demo', false),
      admin
        .from('student_work')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'd2l_valence_sync'),
      admin
        .from('student_work')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'd2l_valence_sync')
        .not('content', 'is', null)
        .neq('content', ''),
    ])

    assertEqual(snap.counts.courses, realCourses ?? 0, 'courses == count(*)')
    assertEqual(
      snap.counts.students,
      realStudents ?? 0,
      'students == count(*) where is_demo=false'
    )
    assertEqual(
      snap.counts.work,
      realWork ?? 0,
      'work == count(*) where source=d2l_valence_sync'
    )
    assertEqual(
      snap.counts.work_with_content,
      realWorkWith ?? 0,
      'work_with_content == count(*) of non-empty content'
    )
    assertEqual(
      snap.counts.work_with_content + snap.counts.work_empty,
      snap.counts.work,
      'work_with_content + work_empty == work (exact partition invariant)'
    )
    assertEqual(snap.listLimit, LIST_LIMIT, 'listLimit reported as LIST_LIMIT')

    section('Counts are uncapped while lists stay bounded to LIST_LIMIT')

    // Need a coach for student.coach_id (NOT NULL FK). Reuse one if
    // present; otherwise create a throwaway.
    const { data: anyCoach } = await admin
      .from('coach')
      .select('id')
      .limit(1)
      .maybeSingle()
    if (anyCoach?.id) {
      tempCoachId = anyCoach.id as string
    } else {
      const { data: c, error: ce } = await admin
        .from('coach')
        .insert({
          name: `${MARKER} coach`,
          email: `${MARKER}@example.test`,
          is_demo: true,
        })
        .select('id')
        .single()
      if (ce || !c) throw new Error(`temp coach insert failed: ${ce?.message}`)
      tempCoachId = c.id as string
      createdCoach = true
    }

    const { data: stu, error: se } = await admin
      .from('student')
      .insert({
        nlu_id: `${MARKER}_nlu`,
        first_name: 'Test',
        last_name: 'Inspector',
        email: `${MARKER}_student@example.test`,
        coach_id: tempCoachId,
        cohort: 'TEST',
        program_start_date: '2020-01-01',
        is_demo: true,
      })
      .select('id')
      .single()
    if (se || !stu) throw new Error(`temp student insert failed: ${se?.message}`)
    tempStudentId = stu.id as string

    const before = await gatherSyncInspection(admin)

    // Seed strictly more than one full slice so a bounded list cannot
    // accidentally still contain "all" rows.
    const K = LIST_LIMIT + 5
    const seedRows = Array.from({ length: K }, (_, i) => ({
      student_id: tempStudentId,
      title: `${MARKER}_work_${i}`,
      work_type: 'essay',
      submitted_at: new Date().toISOString(),
      quarter: 'TEST',
      source: 'd2l_valence_sync',
      content: `seeded body ${i}`,
    }))
    const { error: ie } = await admin.from('student_work').insert(seedRows)
    if (ie) throw new Error(`seed student_work insert failed: ${ie.message}`)

    const after = await gatherSyncInspection(admin)

    assertEqual(
      after.counts.work,
      before.counts.work + K,
      `work count grew by exactly ${K} (uncapped real count(*), not frozen at slice size)`
    )
    assertEqual(
      after.counts.work_with_content,
      before.counts.work_with_content + K,
      `work_with_content grew by exactly ${K}`
    )
    assertEqual(
      after.work.length,
      LIST_LIMIT,
      `work list bounded to exactly LIST_LIMIT (${LIST_LIMIT}) despite ${K} new rows`
    )
    assertTrue(
      after.counts.work > after.work.length,
      'true work total exceeds the rendered slice (count != list length)'
    )
    assertTrue(
      after.courses.length <= LIST_LIMIT &&
        after.students.length <= LIST_LIMIT &&
        after.coaches.length <= LIST_LIMIT &&
        after.instructors.length <= LIST_LIMIT &&
        after.assignments.length <= LIST_LIMIT,
      'every row list is bounded to <= LIST_LIMIT'
    )
  } finally {
    // ─── Cleanup ──────────────────────────────────
    section('Cleanup')
    if (tempStudentId) {
      await admin.from('student_work').delete().eq('student_id', tempStudentId)
      await admin.from('student').delete().eq('id', tempStudentId)
      const { count: leftover } = await admin
        .from('student_work')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', tempStudentId)
      assertEqual(leftover ?? 0, 0, 'seeded student_work rows deleted')
    }
    if (createdCoach && tempCoachId) {
      await admin.from('coach').delete().eq('id', tempCoachId)
      console.log('  ✓ temp coach deleted')
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
