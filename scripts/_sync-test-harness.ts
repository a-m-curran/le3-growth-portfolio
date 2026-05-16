/**
 * Shared scaffolding for the scripts/test-sync-*.ts integration harnesses.
 *
 * The leading underscore marks this as a support module, not a runnable
 * test (the suite is invoked as `tsx scripts/test-sync-*.ts`). It owns the
 * env/LTI bootstrap, the mock-data cleanup/seed helpers, and the assertion
 * accounting that the four sync test scripts previously hand-duplicated.
 *
 * Behavioural contract: every helper here is a byte-for-byte lift of the
 * inline copies it replaces, so refactoring a script to import from this
 * module leaves its pass counts and side effects unchanged.
 */

import { config as loadDotenv } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createAdminClient } from '@/lib/supabase-admin'

// Identifiers baked into the mock dataset. Keep these in sync with
// src/lib/d2l/__mocks__/mock-valence.ts so assertions and cleanup can
// target only mock-inserted rows without risking touching real data.
export const MOCK_COURSE_ORG_UNIT_IDS = ['2001', '2002']
export const MOCK_ASSIGNMENT_FOLDER_IDS = ['3001', '3002', '3003', '3004', '3005']
export const MOCK_EMAIL_DOMAIN_PATTERN = '%@mock.test'

// ─── Env / bootstrap ────────────────────────────────

let skipAutotagValue = false

/**
 * Load .env.local and stub the Valence/LTI env the mock needs. Call this at
 * the top of every test script. The @/lib modules read these vars lazily
 * (at call time, inside main()), not at import time, so invoking this as
 * the first top-level statement — after the hoisted imports — sets them
 * before any consumer runs, exactly as the old inline blocks did.
 */
export function bootstrapTestEnv(): void {
  // Load env vars from .env.local BEFORE importing anything that reads them.
  // Resolve via this module's own directory (it lives in scripts/, like the
  // callers) so it works regardless of where `npx tsx` was invoked from.
  // override:true so we always get the full file, even if tsx's built-in
  // loader already injected some vars from it.
  const here = dirname(fileURLToPath(import.meta.url))
  loadDotenv({ path: resolve(here, '..', '.env.local'), override: true })

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
  skipAutotagValue = process.env.DISABLE_AUTOTAG === '1'
  if (skipAutotagValue) {
    process.env.ANTHROPIC_API_KEY = 'mock-disabled'
  }
}

/**
 * Whether LLM auto-tagging was disabled for this run (DISABLE_AUTOTAG=1).
 * Only meaningful after bootstrapTestEnv() has run.
 */
export function skipAutotag(): boolean {
  return skipAutotagValue
}

// ─── Assertions ─────────────────────────────────────

let failed = 0
let passed = 0

export function assertEqual<T>(actual: T, expected: T, label: string): void {
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

export function assertGte(actual: number, expected: number, label: string): void {
  if (actual >= expected) {
    passed++
    console.log(`  ✓ ${label} (${actual} >= ${expected})`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
    console.error(`    expected >= ${expected}, got ${actual}`)
  }
}

export function section(title: string): void {
  console.log(`\n\x1b[1;36m━━━ ${title} ━━━\x1b[0m`)
}

/** Current assertion tallies (read-only snapshot). */
export function getCounts(): { passed: number; failed: number } {
  return { passed, failed }
}

/** Print the summary line and exit with the appropriate status code. */
export function finish(): never {
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

// ─── Coach seeding ───────────────────────────────────

/**
 * Ensure a mock coach row exists in the database. Uses a mock email so
 * cleanupMockData() can target it precisely. Returns the coach's UUID.
 *
 * Idempotent: if the row already exists, returns the existing ID.
 */
export async function ensureMockCoach(
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

export async function cleanupMockData(
  admin: ReturnType<typeof createAdminClient>,
  ...syncRunIds: (string | null)[]
): Promise<void> {
  // Delete mock rows by stable columns the engine actually writes.
  // Dependency order:
  //   1. student_work (cascades work_skill_tag)
  //   2. assignment (would cascade from course too, explicit for safety)
  //   3. student_course (cascades from both student and course)
  //   4. student
  //   5. course
  //   6. coach
  //   7. sync_run (standalone)

  // Look up mock student IDs so we can clean up their work items by student_id
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

  // sync_run rows for this test
  for (const id of syncRunIds.filter((i): i is string => !!i)) {
    await admin.from('sync_run').delete().eq('id', id)
  }
  // Safety net: nuke any sync_run row triggered by mock-harness
  await admin.from('sync_run').delete().eq('triggered_by', 'mock-harness')
}
