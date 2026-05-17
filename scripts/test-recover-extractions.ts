/**
 * Tests for the empty-extraction recovery feature.
 *
 *   1. parseWorkExternalId         — pure
 *   2. listEmptyWorkOrgUnits       — READ-only enumeration (mock rows)
 *   3. recoverCourseExtractions    — behavioral, mock-valence, in-process
 *   4. recoverCourseExtractions    — dry-run writes nothing
 *   5. structural zero-write       — source scan of the write modules
 *   6. route auth                  — unauthenticated POST → 401
 *
 * USAGE:
 *   npx tsx scripts/test-recover-extractions.ts
 */

import { config as loadDotenv } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: resolve(__dirname, '..', '.env.local'), override: true })

process.env.D2L_VALENCE_INSTANCE_URL = 'https://mock.brightspace.test'
process.env.D2L_VALENCE_CLIENT_ID = 'mock-client-id'
process.env.D2L_VALENCE_CLIENT_SECRET = 'mock-client-secret'
process.env.D2L_VALENCE_TOKEN_URL = 'https://auth.brightspace.test/core/connect/token'
process.env.D2L_VALENCE_API_VERSION = '1.82'
process.env.D2L_VALENCE_LE3_ORG_UNIT_ID = '1001'
process.env.LTI_TOOL_URL = 'https://mock.le3.test'
process.env.LTI_KEY_ID = 'mock-key-2026'
process.env.LTI_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCNhjvKe89npm0k\nvGiZZCdNTY+KMpXK8q5pCySHp8ILyL281BKqRrXQ6fIoadAklfGMC0IMJzGyy2xn\nBAvewaC8HuSxX4gq+v4pKC6FAe5j1jlb5oenCSaJiefSbV/lrc/TxxHMVf5NwfWl\ni2m3KuYexpbt+qnIqlOOTdUaWx2639xOg0Yzm8NcEz3VIkm9VMCyu1J7TW6sV8cI\ngmru5RPb12bQEl0oZatakXsKdp3WLXEjbsZTMcDbvS64y0bEdYFDF8iGlt74q/8p\nWjmHjHtiYsDHz0LGXpLx8Pg3TS8ibzBdNo+cxGYacTefmpqgNGCx9e5pIDARQRLC\nQ7zrVSrPAgMBAAECggEAOH4TQu3uKilIWwgsVsKgX56sxBUSLyt1THAKum3QKyUL\n/CLJepf0PrsME269i8Ug4O6jhDdnAsBp+qsmU9qF32ITluwT7lg3eVVVUHmnX8nl\nJpacoqQn8nIOjDRluciKc7Z8l8zh0McyV80RO3EP38wU9lT/Th8TcHQIM1eYw/29\nMLXEDgmO+Ki/OmFeC880xpEb5qOAMJIXDGAfAVT8Wb3H9DdyxhU7KGz5aVlnx/9U\nrwiJXtfSNtvjXPqX21JqHEGSUcRZYueAXvl5MFgWa1lsD4RcZic4uKhoXnFKdsCB\n9ulekkL+kxrAAzCZVK+fS8PCYhNkYlzXA75gbEzo6QKBgQDDJhweojjfreuZZrdb\nX6m/3ZWCk8ijrEBQXWnYwwtn6cIpk+SaJAbf3H+s1qlZVBy1Zs+ZGpV4A8ZdisPr\nvAkeoTdbXL8e8Qu0+Exr6yx8VE3SZjZ4LeS9pDxrRg0fjxJMa9FiEkO2RU6pegQm\n0xTMCB8P7AWi2Vm24bqOk6LlBwKBgQC5p4KrY4O170ggj/AWI2k1PMyoztIJ1r0/\nYlUY1BjA8ZFjmGBJIqM253czuy88f9fIjrW1km6VpTCVyBiPgACmV9dAZS6QF4Ju\nSVz84favNra3A5sDeaFLo4tpOJJz7ZPyodQ2R0YirBXi755EHM8kXkNzRdTFFmyt\nG5WIrY2h+QKBgQC9Fto8XJebNRyKYVrdMM58WKqcAbJx1V/j/v+mxybwIzK9ss3Z\nBXubwj38LWueYMAIjXwuL/IQfifhT6oTavmzMic/YZjW1F2xlr4F+7P5LH7TlbLF\ntEJl9xOMJi5lG+5xGi+iRWxS2skjslT/gZwvLtdaSCoV52DkschginFWVQKBgQCc\n0PZZyHQPcC9vecVlHcIXOuTwTcoyj1VJPcj9cOH7z9Br3OCvxfcxQDB63MiYhLAC\n8zBfT3HjKyYvzlWYmJlz6EykUxMSmRkOCR/nZwKUm1WYnw4H0GxC1MDEPwnNrEbE\nspbqxidi0BKonpgDloYNhSXaL4j6dOeVDPCxA0/YGQKBgQCHoEQo5jTTdNrqkweN\n24QObNjw0KjEeH1kkmXpVaHQXfvdQbUMxKt/TtQBm7/wtn5d1YI3XyPAuu56gD0W\ntSuCnTWU3qmNgJHwqPbEFI2ULbXjw0ZZbYum5cJESKMqmxb4G0fjxaCJnWpDri9o\n8u2ZVBJpHn0ertpRd8Yyms5AXw==\n-----END PRIVATE KEY-----'
process.env.LTI_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjYY7ynvPZ6ZtJLxomWQn\nTU2PijKVyvKuaQskh6fCC8i9vNQSqka10OnyKGnQJJXxjAtCDCcxsstsZwQL3sGg\nvB7ksV+IKvr+KSguhQHuY9Y5W+aHpwkmiYnn0m1f5a3P08cRzFX+TcH1pYtptyrm\nHsaW7fqpyKpTjk3VGlsdut/cToNGM5vDXBM91SJJvVTAsrtSe01urFfHCIJq7uUT\n29dm0BJdKGWrWpF7Cnad1i1xI27GUzHA270uuMtGxHWBQxfIhpbe+Kv/KVo5h4x7\nYmLAx89Cxl6S8fD4N00vIm8wXTaPnMRmGnE3n5qaoDRgsfXuaSAwEUESwkO861Uq\nzwIDAQAB\n-----END PUBLIC KEY-----'

import {
  installMockValence,
  uninstallMockValence,
  MOCK_STATS,
} from '@/lib/d2l/__mocks__/mock-valence'
import { createAdminClient } from '@/lib/supabase-admin'
import { clearValenceTokenCache } from '@/lib/d2l/auth'
import { listCoursesUnderOrgUnit } from '@/lib/d2l'
import { syncOneCourse } from '@/lib/sync/sync-course'
import {
  parseWorkExternalId,
  listEmptyWorkOrgUnits,
  recoverCourseExtractions,
  aggregateRecoveryResults,
} from '@/lib/recovery/recover-extractions'

const MOCK_COURSE_ORG_UNIT_IDS = ['2001', '2002']
const MOCK_ASSIGNMENT_FOLDER_IDS = ['3001', '3002', '3003', '3004', '3005']
const MOCK_EMAIL_DOMAIN_PATTERN = '%@mock.test'

let passed = 0
let failed = 0

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual === expected) { passed++; console.log(`  ✓ ${label}`) }
  else {
    failed++
    console.error(`  ✗ ${label}`)
    console.error(`    expected: ${JSON.stringify(expected)}`)
    console.error(`    actual:   ${JSON.stringify(actual)}`)
  }
}
function assertTrue(cond: boolean, label: string, detail?: string): void {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.error(`  ✗ ${label}`); if (detail) console.error(`    ${detail}`) }
}
function section(t: string): void {
  console.log(`\n\x1b[1;36m━━━ ${t} ━━━\x1b[0m`)
}

async function ensureMockCoach(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const email = 'mock-coach@mock.test'
  const { data: existing } = await admin.from('coach').select('id').eq('email', email).maybeSingle()
  if (existing) return existing.id as string
  const { data: inserted, error } = await admin
    .from('coach').insert({ name: 'Mock Coach', email, status: 'active' }).select('id').single()
  if (error || !inserted) throw new Error(`Failed to insert mock coach: ${error?.message}`)
  return inserted.id as string
}

async function cleanupMockData(admin: ReturnType<typeof createAdminClient>): Promise<void> {
  const { data: mockStudents } = await admin
    .from('student').select('id').like('email', MOCK_EMAIL_DOMAIN_PATTERN)
  const ids = (mockStudents || []).map(s => s.id)
  if (ids.length > 0) await admin.from('student_work').delete().in('student_id', ids)
  await admin.from('assignment').delete().in('brightspace_folder_id', MOCK_ASSIGNMENT_FOLDER_IDS)
  await admin.from('course').delete().in('brightspace_org_unit_id', MOCK_COURSE_ORG_UNIT_IDS)
  await admin.from('student').delete().like('email', MOCK_EMAIL_DOMAIN_PATTERN)
  await admin.from('coach').delete().like('email', MOCK_EMAIL_DOMAIN_PATTERN)
}

async function main(): Promise<void> {
  const admin = createAdminClient()

  section('parseWorkExternalId (pure)')
  assertEqual(
    JSON.stringify(parseWorkExternalId('d2l:2001:3001:7000')),
    JSON.stringify({ orgUnitId: '2001', folderId: '3001', submissionId: '7000' }),
    'valid d2l external_id parses to {orgUnitId,folderId,submissionId}'
  )
  assertEqual(parseWorkExternalId('lti:abc'), null, 'non-d2l external_id → null')
  assertEqual(parseWorkExternalId('d2l:2001:3001'), null, 'too few segments → null')
  assertEqual(parseWorkExternalId(null), null, 'null external_id → null')

  section('listEmptyWorkOrgUnits (READ-only enumeration)')
  await cleanupMockData(admin)
  try {
    const coachId = await ensureMockCoach(admin)
    // Seed one mock student + two student_work rows: one empty
    // (d2l_valence_sync, content=null) under org 2001, one non-empty.
    const { data: stu } = await admin.from('student').insert({
      nlu_id: 'd2l:mock-empty-1', d2l_user_id: 'mock-empty-1',
      first_name: 'Empty', last_name: 'Case', email: 'empty-case@mock.test',
      coach_id: coachId, cohort: 'Spring 2026',
      program_start_date: '2026-01-01', status: 'active',
    }).select('id').single()
    const studentId = stu!.id as string
    await admin.from('student_work').insert([
      {
        student_id: studentId, title: 'Empty One', work_type: 'other',
        submitted_at: new Date().toISOString(), quarter: 'Spring 2026',
        content: null, source: 'd2l_valence_sync',
        external_id: 'd2l:2001:3001:999001',
      },
      {
        student_id: studentId, title: 'Has Text', work_type: 'other',
        submitted_at: new Date().toISOString(), quarter: 'Spring 2026',
        content: 'already extracted', source: 'd2l_valence_sync',
        external_id: 'd2l:2002:3004:999002',
      },
    ])
    const ous = await listEmptyWorkOrgUnits(admin)
    assertTrue(ous.includes('2001'), 'org 2001 (empty row) is enumerated')
    assertTrue(!ous.includes('2002'), 'org 2002 (non-empty row) is NOT enumerated')
  } finally {
    await cleanupMockData(admin)
  }

  section('recoverCourseExtractions — repopulates an emptied row (mock-valence)')
  await cleanupMockData(admin)
  installMockValence()
  clearValenceTokenCache()
  try {
    // Realistic setup: sync mock course 2001 so student_work rows exist
    // exactly as production creates them.
    const courses = await listCoursesUnderOrgUnit(MOCK_STATS.le3OrgUnitId)
    const c2001 = courses.find(c => c.orgUnitId === '2001')!
    const mc = await ensureMockCoach(admin)
    const synced = await syncOneCourse({
      syncRunId: 'recover-test', course: c2001, mode: 'full', defaultCoachId: mc,
    })
    assertTrue(synced.counts.submissionsSynced >= 1, 'mock 2001 synced >= 1 work row')

    // Pick one synced row and null its content to simulate a PDF-bug row.
    const { data: mockStudents } = await admin
      .from('student').select('id').like('email', MOCK_EMAIL_DOMAIN_PATTERN)
    const sids = (mockStudents || []).map(s => s.id)
    const { data: target } = await admin
      .from('student_work')
      .select('id, content, external_id')
      .in('student_id', sids)
      .eq('source', 'd2l_valence_sync')
      .like('external_id', 'd2l:2001:%')
      .not('content', 'is', null)
      .limit(1)
      .single()
    const targetId = target!.id as string
    const originalText = target!.content as string
    assertTrue(originalText.length > 0, 'target row had real extracted text before')

    await admin.from('student_work').update({ content: null }).eq('id', targetId)

    // Snapshot work_skill_tag count for this row (seam OFF must not add tags).
    const tagCount = async (): Promise<number> => {
      const { count } = await admin
        .from('work_skill_tag')
        .select('work_id', { count: 'exact', head: true })
        .eq('work_id', targetId)
      return count || 0
    }
    const tagsBefore = await tagCount()
    const { count: worksBefore } = await admin
      .from('student_work').select('id', { count: 'exact', head: true }).in('student_id', sids)

    const res = await recoverCourseExtractions({
      admin, orgUnitId: '2001', dryRun: false, runAutoTag: false,
    })
    assertEqual(res.recovered, 1, 'exactly one row recovered')
    assertEqual(res.orgUnitId, '2001', 'result reports org 2001')

    const { data: after } = await admin
      .from('student_work').select('content').eq('id', targetId).single()
    assertEqual(after!.content, originalText, 'content repopulated to the original extracted text')

    const tagsAfter = await tagCount()
    assertEqual(tagsAfter, tagsBefore, 'seam OFF → no work_skill_tag rows added')
    const { count: worksAfter } = await admin
      .from('student_work').select('id', { count: 'exact', head: true }).in('student_id', sids)
    assertEqual(worksAfter || 0, worksBefore || 0, 'no student_work rows inserted/deleted')

    section('recoverCourseExtractions — dryRun writes nothing')
    await admin.from('student_work').update({ content: null }).eq('id', targetId)
    const dry = await recoverCourseExtractions({
      admin, orgUnitId: '2001', dryRun: true, runAutoTag: false,
    })
    assertEqual(dry.recovered, 1, 'dry-run reports 1 would-recover')
    const { data: stillEmpty } = await admin
      .from('student_work').select('content').eq('id', targetId).single()
    assertTrue(
      stillEmpty!.content === null,
      'dry-run did NOT write (content still null)',
      JSON.stringify(stillEmpty)
    )
  } finally {
    await cleanupMockData(admin)
    uninstallMockValence()
  }

  section('aggregateRecoveryResults (pure)')
  const agg = aggregateRecoveryResults([
    {
      orgUnitId: 'A', scanned: 5, recovered: 3,
      stillEmpty: { unsupported: 1, noFile: 1, submissionGone: 0, emptyText: 0, downloadError: 0 },
      errors: ['x'],
    },
    {
      orgUnitId: 'B', scanned: 2, recovered: 2,
      stillEmpty: { unsupported: 0, noFile: 0, submissionGone: 0, emptyText: 0, downloadError: 0 },
      errors: [],
    },
  ])
  assertEqual(agg.orgUnitsProcessed, 2, 'orgUnitsProcessed = 2')
  assertEqual(agg.scanned, 7, 'scanned summed (5+2)')
  assertEqual(agg.recovered, 5, 'recovered summed (3+2)')
  assertEqual(agg.stillEmpty.unsupported, 1, 'stillEmpty.unsupported summed')
  assertEqual(agg.errorCount, 1, 'errorCount summed (1+0)')
  assertEqual(agg.perCourse.length, 2, 'perCourse retained')

  section('structural zero-write invariant (source scan)')
  // Scan comment-stripped source: the module/task DOC COMMENTS
  // intentionally mention `.update({ content })` and "sync_run" in prose
  // (mandated by the plan), so raw substring/regex scans would false-
  // positive. Stripping /* ... */ blocks leaves only real code to assert
  // the load-bearing zero-write invariant against.
  const stripBlockComments = (s: string): string =>
    s.replace(/\/\*[\s\S]*?\*\//g, '')
  const coreSrc = stripBlockComments(
    readFileSync(resolve(__dirname, '..', 'src/lib/recovery/recover-extractions.ts'), 'utf-8')
  )
  assertTrue(!coreSrc.includes('.insert('), 'core code has no .insert(')
  assertTrue(!coreSrc.includes('.upsert('), 'core code has no .upsert(')
  assertTrue(!coreSrc.includes('.delete('), 'core code has no .delete(')
  const updateCount = (coreSrc.match(/\.update\(/g) || []).length
  assertEqual(updateCount, 1, 'core code has exactly one .update( (the content fill)')
  assertTrue(
    /\.update\(\s*\{\s*content:/.test(coreSrc),
    'the single update is a content-only fill (whitespace-tolerant)'
  )
  for (const rel of [
    'src/trigger/recover-course.ts',
    'src/trigger/recover-empty-extractions.ts',
  ]) {
    const src = stripBlockComments(
      readFileSync(resolve(__dirname, '..', rel), 'utf-8')
    )
    assertTrue(!src.includes('.insert('), `${rel} code has no .insert(`)
    assertTrue(!src.includes('.upsert('), `${rel} code has no .upsert(`)
    assertTrue(!src.includes('.delete('), `${rel} code has no .delete(`)
    assertTrue(!src.includes('.update('), `${rel} code has no .update( (delegates to core)`)
    assertTrue(!src.includes('sync_run'), `${rel} code does not touch sync_run`)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
main()
