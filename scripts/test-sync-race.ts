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
// to call SignJWT.sign(). We generate a fresh test key pair at test-script
// write-time; the values are safe to commit because they are test-only and
// have no access to any real system.
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

// Identifiers baked into the mock dataset.
const MOCK_COURSE_ORG_UNIT_IDS = ['2001', '2002']
const MOCK_ASSIGNMENT_FOLDER_IDS = ['3001', '3002', '3003', '3004', '3005']
const MOCK_EMAIL_DOMAIN_PATTERN = '%@mock.test'

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
    const { data: jordan } = await admin
      .from('student').select('id').eq('d2l_user_id', '5004')
    assertEqual(jordan?.length ?? 0, 1, 'shared student 5004 has exactly one row')
  } finally {
    await cleanupMockData(admin)
    uninstallMockValence()
  }
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
main()
