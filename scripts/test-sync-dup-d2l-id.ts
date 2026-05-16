/**
 * Regression test: processSubmission must tolerate >1 student rows that
 * share a single d2l_user_id.
 *
 * d2l_user_id is intentionally NON-unique (migration 012 indexes it
 * non-uniquely). The codebase back-fills d2l_user_id onto pre-existing
 * rows that arrived under a different identity (LTI launch, CSV import),
 * so one person can legitimately have two `student` rows carrying the
 * same d2l_user_id but distinct email/nlu_id (the UNIQUE keys).
 *
 * processSubmission resolves the student via
 * `.or(d2l_user_id.eq.X, nlu_id.eq.d2l:X, nlu_id.eq.X)`. With the bug,
 * that lookup used `.maybeSingle()`, which fails on >1 rows — and the
 * caller's per-submission try/catch swallowed it, silently dropping a
 * real student's work. This test seeds the duplicate-id fixture and
 * asserts the submission is NOT dropped.
 *
 * USAGE:
 *   npx tsx scripts/test-sync-dup-d2l-id.ts
 *   DISABLE_AUTOTAG=1 npx tsx scripts/test-sync-dup-d2l-id.ts   (cheap)
 */

import { config as loadDotenv } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load env vars from .env.local BEFORE importing anything that reads them.
const __dirname = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: resolve(__dirname, '..', '.env.local'), override: true })

// Stub the Valence-specific env vars with harmless dummies. The mock
// fetch intercepts all HTTP calls, so these values are never actually
// sent anywhere — they just need to exist so getValenceConfig() doesn't
// throw before the mock can take over.
process.env.D2L_VALENCE_INSTANCE_URL = 'https://mock.brightspace.test'
process.env.D2L_VALENCE_CLIENT_ID = 'mock-client-id'
process.env.D2L_VALENCE_CLIENT_SECRET = 'mock-client-secret'
process.env.D2L_VALENCE_TOKEN_URL = 'https://auth.brightspace.test/core/connect/token'
process.env.D2L_VALENCE_API_VERSION = '1.82'
process.env.D2L_VALENCE_LE3_ORG_UNIT_ID = '1001'

// Stub LTI env vars. getValenceToken() signs a JWT with the LTI private
// key before hitting the token endpoint — the signature is sent to the
// mocked token server which ignores it, but jose requires a real RSA key
// to call SignJWT.sign(). Test-only key pair; no access to any real system.
process.env.LTI_TOOL_URL = 'https://mock.le3.test'
process.env.LTI_KEY_ID = 'mock-key-2026'
process.env.LTI_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCNhjvKe89npm0k\nvGiZZCdNTY+KMpXK8q5pCySHp8ILyL281BKqRrXQ6fIoadAklfGMC0IMJzGyy2xn\nBAvewaC8HuSxX4gq+v4pKC6FAe5j1jlb5oenCSaJiefSbV/lrc/TxxHMVf5NwfWl\ni2m3KuYexpbt+qnIqlOOTdUaWx2639xOg0Yzm8NcEz3VIkm9VMCyu1J7TW6sV8cI\ngmru5RPb12bQEl0oZatakXsKdp3WLXEjbsZTMcDbvS64y0bEdYFDF8iGlt74q/8p\nWjmHjHtiYsDHz0LGXpLx8Pg3TS8ibzBdNo+cxGYacTefmpqgNGCx9e5pIDARQRLC\nQ7zrVSrPAgMBAAECggEAOH4TQu3uKilIWwgsVsKgX56sxBUSLyt1THAKum3QKyUL\n/CLJepf0PrsME269i8Ug4O6jhDdnAsBp+qsmU9qF32ITluwT7lg3eVVVUHmnX8nl\nJpacoqQn8nIOjDRluciKc7Z8l8zh0McyV80RO3EP38wU9lT/Th8TcHQIM1eYw/29\nMLXEDgmO+Ki/OmFeC880xpEb5qOAMJIXDGAfAVT8Wb3H9DdyxhU7KGz5aVlnx/9U\nrwiJXtfSNtvjXPqX21JqHEGSUcRZYueAXvl5MFgWa1lsD4RcZic4uKhoXnFKdsCB\n9ulekkL+kxrAAzCZVK+fS8PCYhNkYlzXA75gbEzo6QKBgQDDJhweojjfreuZZrdb\nX6m/3ZWCk8ijrEBQXWnYwwtn6cIpk+SaJAbf3H+s1qlZVBy1Zs+ZGpV4A8ZdisPr\nvAkeoTdbXL8e8Qu0+Exr6yx8VE3SZjZ4LeS9pDxrRg0fjxJMa9FiEkO2RU6pegQm\n0xTMCB8P7AWi2Vm24bqOk6LlBwKBgQC5p4KrY4O170ggj/AWI2k1PMyoztIJ1r0/\nYlUY1BjA8ZFjmGBJIqM253czuy88f9fIjrW1km6VpTCVyBiPgACmV9dAZS6QF4Ju\nSVz84favNra3A5sDeaFLo4tpOJJz7ZPyodQ2R0YirBXi755EHM8kXkNzRdTFFmyt\nG5WIrY2h+QKBgQC9Fto8XJebNRyKYVrdMM58WKqcAbJx1V/j/v+mxybwIzK9ss3Z\nBXubwj38LWueYMAIjXwuL/IQfifhT6oTavmzMic/YZjW1F2xlr4F+7P5LH7TlbLF\ntEJl9xOMJi5lG+5xGi+iRWxS2skjslT/gZwvLtdaSCoV52DkschginFWVQKBgQCc\n0PZZyHQPcC9vecVlHcIXOuTwTcoyj1VJPcj9cOH7z9Br3OCvxfcxQDB63MiYhLAC\n8zBfT3HjKyYvzlWYmJlz6EykUxMSmRkOCR/nZwKUm1WYnw4H0GxC1MDEPwnNrEbE\nspbqxidi0BKonpgDloYNhSXaL4j6dOeVDPCxA0/YGQKBgQCHoEQo5jTTdNrqkweN\n24QObNjw0KjEeH1kkmXpVaHQXfvdQbUMxKt/TtQBm7/wtn5d1YI3XyPAuu56gD0W\ntSuCnTWU3qmNgJHwqPbEFI2ULbXjw0ZZbYum5cJESKMqmxb4G0fjxaCJnWpDri9o\n8u2ZVBJpHn0ertpRd8Yyms5AXw==\n-----END PRIVATE KEY-----'
process.env.LTI_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjYY7ynvPZ6ZtJLxomWQn\nTU2PijKVyvKuaQskh6fCC8i9vNQSqka10OnyKGnQJJXxjAtCDCcxsstsZwQL3sGg\nvB7ksV+IKvr+KSguhQHuY9Y5W+aHpwkmiYnn0m1f5a3P08cRzFX+TcH1pYtptyrm\nHsaW7fqpyKpTjk3VGlsdut/cToNGM5vDXBM91SJJvVTAsrtSe01urFfHCIJq7uUT\n29dm0BJdKGWrWpF7Cnad1i1xI27GUzHA270uuMtGxHWBQxfIhpbe+Kv/KVo5h4x7\nYmLAx89Cxl6S8fD4N00vIm8wXTaPnMRmGnE3n5qaoDRgsfXuaSAwEUESwkO861Uq\nzwIDAQAB\n-----END PUBLIC KEY-----'

// Optional: let users skip LLM auto-tagging for cheap test runs.
const SKIP_AUTOTAG = process.env.DISABLE_AUTOTAG === '1'
if (SKIP_AUTOTAG) {
  process.env.ANTHROPIC_API_KEY = 'mock-disabled'
}

import {
  installMockValence,
  uninstallMockValence,
  MOCK_STATS,
} from '@/lib/d2l/__mocks__/mock-valence'
import { syncOneCourse } from '@/lib/sync/sync-course'
import { listCoursesUnderOrgUnit } from '@/lib/d2l'
import { clearValenceTokenCache } from '@/lib/d2l/auth'
import { createAdminClient } from '@/lib/supabase-admin'

// Identifiers baked into the mock dataset. Keep these in sync with
// src/lib/d2l/__mocks__/mock-valence.ts so assertions and cleanup can
// target only mock-inserted rows without risking touching real data.
const MOCK_COURSE_ORG_UNIT_IDS = ['2001', '2002']
const MOCK_ASSIGNMENT_FOLDER_IDS = ['3001', '3002', '3003', '3004', '3005']
const MOCK_EMAIL_DOMAIN_PATTERN = '%@mock.test'

// Aja's Brightspace user id in the mock dataset (MOCK_STUDENTS 5001).
// Aja is enrolled in course 2001, so syncOneCourse(2001) processes her
// submissions and exercises processSubmission's student lookup.
const SHARED_D2L_USER_ID = '5001'
// Aja's classlist email. One seeded row uses it so upsertStudent matches
// that row by email and does NOT insert a third student row — keeping the
// fixture to exactly two rows that share the d2l_user_id.
const AJA_CLASSLIST_EMAIL = 'awilliams-mock@mock.test'
// Bespoke identifiers (NOT part of the standard mock dataset) so the
// fixture never collides on the UNIQUE keys with other regression runs.
const ROW_A_NLU_ID = 'dup-d2l-test-aja-canonical'
const ROW_B_EMAIL = 'dup-d2l-test-legacy@mock.test'
const ROW_B_NLU_ID = 'dup-d2l-test-aja-legacy'

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

function assertGte(actual: number, expected: number, label: string): void {
  if (actual >= expected) {
    passed++
    console.log(`  ✓ ${label} (${actual} >= ${expected})`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
    console.error(`    expected >= ${expected}, got ${actual}`)
  }
}

function section(title: string): void {
  console.log(`\n\x1b[1;36m━━━ ${title} ━━━\x1b[0m`)
}

// ─── Coach seeding ───────────────────────────────────

async function ensureMockCoach(
  admin: ReturnType<typeof createAdminClient>
): Promise<string> {
  const email = 'mock-coach@mock.test'

  const { data: existing } = await admin
    .from('coach')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) return existing.id as string

  const { data: inserted, error } = await admin
    .from('coach')
    .insert({
      name: 'Mock Coach',
      email,
      status: 'active',
    })
    .select('id')
    .single()

  if (error || !inserted) {
    throw new Error(`Failed to insert mock coach: ${error?.message}`)
  }
  return inserted.id as string
}

// ─── Cleanup helper ──────────────────────────────────

async function cleanupMockData(
  admin: ReturnType<typeof createAdminClient>
): Promise<void> {
  // Delete mock rows by stable columns the engine actually writes.
  // Dependency order:
  //   1. student_work
  //   2. assignment
  //   3. student_course (cascades from both student and course)
  //   4. student
  //   5. course
  //   6. coach

  const { data: mockStudents } = await admin
    .from('student')
    .select('id')
    .like('email', MOCK_EMAIL_DOMAIN_PATTERN)
  const mockStudentIds = (mockStudents || []).map(s => s.id)

  if (mockStudentIds.length > 0) {
    await admin
      .from('student_work')
      .delete()
      .in('student_id', mockStudentIds)
  }

  await admin
    .from('assignment')
    .delete()
    .in('brightspace_folder_id', MOCK_ASSIGNMENT_FOLDER_IDS)

  await admin
    .from('course')
    .delete()
    .in('brightspace_org_unit_id', MOCK_COURSE_ORG_UNIT_IDS)

  await admin
    .from('student')
    .delete()
    .like('email', MOCK_EMAIL_DOMAIN_PATTERN)

  await admin
    .from('coach')
    .delete()
    .like('email', MOCK_EMAIL_DOMAIN_PATTERN)
}

// ─── Fixture ─────────────────────────────────────────

/**
 * Hard-reset the d2l_user_id 5001 mock namespace, then seed exactly two
 * `student` rows that BOTH carry d2l_user_id 5001 but have distinct
 * email + nlu_id (the UNIQUE keys). Row A uses Aja's classlist email so
 * upsertStudent matches it by email and does NOT insert a third row.
 * Returns both row ids.
 */
async function seedDuplicateD2lStudents(
  admin: ReturnType<typeof createAdminClient>,
  coachId: string
): Promise<string[]> {
  // Targeted pre-clean: remove any pre-existing rows in the mock 5001
  // namespace (and their work) so the fixture is exactly two rows
  // regardless of residue left by an interrupted prior run.
  const { data: stale } = await admin
    .from('student')
    .select('id')
    .eq('d2l_user_id', SHARED_D2L_USER_ID)
    .like('email', MOCK_EMAIL_DOMAIN_PATTERN)
  const staleIds = (stale ?? []).map(s => s.id)
  if (staleIds.length > 0) {
    await admin.from('student_work').delete().in('student_id', staleIds)
    await admin.from('student').delete().in('id', staleIds)
  }

  const common = {
    d2l_user_id: SHARED_D2L_USER_ID,
    first_name: 'Aja',
    last_name: 'Williams (Mock)',
    coach_id: coachId,
    cohort: 'Mock Cohort',
    program_start_date: '2026-01-01',
    status: 'active' as const,
  }

  // Row A: Aja's canonical sync identity (email matches the classlist).
  const { data: rowA, error: eA } = await admin
    .from('student')
    .insert({ ...common, nlu_id: ROW_A_NLU_ID, email: AJA_CLASSLIST_EMAIL })
    .select('id')
    .single()
  if (eA || !rowA) throw new Error(`seed row A failed: ${eA?.message}`)

  // Row B: the same person under a pre-existing legacy identity (e.g. an
  // LTI launch row) that later had d2l_user_id back-filled. Distinct
  // UNIQUE keys, SAME d2l_user_id.
  const { data: rowB, error: eB } = await admin
    .from('student')
    .insert({ ...common, nlu_id: ROW_B_NLU_ID, email: ROW_B_EMAIL })
    .select('id')
    .single()
  if (eB || !rowB) throw new Error(`seed row B failed: ${eB?.message}`)

  return [rowA.id as string, rowB.id as string]
}

// ─── Main ──────────────────────────────────────────

async function main(): Promise<void> {
  const admin = createAdminClient()
  await cleanupMockData(admin)
  installMockValence()
  clearValenceTokenCache()
  try {
    section(
      'processSubmission tolerates >1 student rows sharing d2l_user_id'
    )
    const coachId = await ensureMockCoach(admin)
    const seededIds = await seedDuplicateD2lStudents(admin, coachId)

    // Sanity: the .or() lookup in processSubmission really will match >1.
    const { data: dupRows } = await admin
      .from('student')
      .select('id')
      .eq('d2l_user_id', SHARED_D2L_USER_ID)
      .like('email', MOCK_EMAIL_DOMAIN_PATTERN)
    assertEqual(
      dupRows?.length ?? 0,
      2,
      'fixture: exactly two student rows share d2l_user_id 5001'
    )

    // Course 2001 enrolls Aja (5001); syncOneCourse processes her
    // submissions, driving processSubmission's student lookup.
    const courses = await listCoursesUnderOrgUnit(MOCK_STATS.le3OrgUnitId)
    const hum = courses.find(c => c.orgUnitId === '2001')!
    const res = await syncOneCourse({
      syncRunId: 'test-dup-d2l',
      course: hum,
      mode: 'full',
      defaultCoachId: coachId,
    })

    // upsertStudent matched Row A by email, so no third row was created.
    const { data: afterRows } = await admin
      .from('student')
      .select('id')
      .eq('d2l_user_id', SHARED_D2L_USER_ID)
      .like('email', MOCK_EMAIL_DOMAIN_PATTERN)
    assertEqual(
      afterRows?.length ?? 0,
      2,
      'still exactly two rows share d2l_user_id 5001 (no third row created)'
    )

    // With the bug, Aja's submissions hit the >1-row .or() match,
    // maybeSingle() fails, the per-submission catch swallows it, and the
    // work is silently dropped → zero student_work under either seeded
    // row. The fix tolerates the multi-match and resolves deterministically.
    const { data: work } = await admin
      .from('student_work')
      .select('id, student_id')
      .in('student_id', seededIds)
    const workRows = work ?? []

    assertGte(
      workRows.length,
      1,
      "Aja's submissions inserted as student_work despite duplicate " +
        'd2l_user_id (not silently dropped)'
    )
    assertEqual(
      res.counts.errorsCount,
      0,
      'no errors recorded — multi-row d2l_user_id match did not throw'
    )
    const resolvedStudentIds = new Set(workRows.map(w => w.student_id))
    assertEqual(
      resolvedStudentIds.size,
      1,
      'all resolved work converges on a single deterministic student row'
    )
  } finally {
    await cleanupMockData(admin)
    uninstallMockValence()
  }
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
main()
