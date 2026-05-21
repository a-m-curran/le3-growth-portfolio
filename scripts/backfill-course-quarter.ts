/**
 * Owner-runnable backfill: re-derive every course's canonical quarter
 * from data already in the database (no D2L calls), and UPDATE
 * course.quarter + assignment.quarter + student_work.quarter for any
 * course whose stored value differs from the derived value.
 *
 * Idempotent: skips any course whose stored quarter already matches
 * the derived value (no UPDATE, just a log line).
 *
 * Why no D2L: deriveQuarter() now parses NLU's Banner term code
 * (course.code = "<sectionId>.<YYYY><TT>") as its primary signal —
 * that data is in the lightweight org-structure payload we sync into
 * course.code on every run. No D2L credentials needed to run this
 * script; only Supabase service-role.
 *
 * Per-course error handling: a derivation/write failure for one
 * course logs the error and proceeds to the next; does not abort the
 * whole backfill. Final exit code is 1 if any course errored (so an
 * automation can detect partial failures); 0 otherwise.
 *
 * Retry safety: course.quarter is UPDATEd LAST. Supabase/PostgREST
 * has no per-script transaction primitive, so the three UPDATEs run
 * sequentially. If the script crashes mid-course, course.quarter
 * stays on the OLD value; the next run's idempotency check sees the
 * mismatch and re-tries the whole sequence. Child UPDATEs are
 * idempotent (writing the same value is a no-op). If we updated
 * course.quarter FIRST, a mid-course crash would orphan stale
 * child rows that re-runs would skip.
 *
 * Requires env (.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY. (No D2L env — the derivation reads
 * course.code from the DB and parses it locally.)
 *
 * Run: npx tsx scripts/backfill-course-quarter.ts
 */

// Load .env.local BEFORE importing any module that reads env at import time.
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { deriveQuarter } from '../src/lib/d2l/mappers'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

interface CourseRow {
  id: string
  name: string
  brightspace_org_unit_id: string | null
  code: string | null
  quarter: string | null
}

async function main(): Promise<void> {
  const { data: courses, error: loadErr } = await supabase
    .from('course')
    .select('id, name, brightspace_org_unit_id, code, quarter')
    .not('brightspace_org_unit_id', 'is', null)
    .order('name')

  if (loadErr || !courses) {
    console.error('Failed to load courses:', loadErr?.message)
    process.exit(1)
  }

  const rows = courses as CourseRow[]
  console.log(`Backfilling ${rows.length} courses…\n`)

  let updated = 0
  let skipped = 0
  let errored = 0

  for (const row of rows) {
    try {
      // Pure derivation from data already in the DB (no D2L call).
      // The Banner term-code path needs only row.code; semesterName
      // and startDate are unavailable without /courses/{id}, which
      // we don't have scope for — pass null. If row.code doesn't
      // match the Banner pattern (e.g., sandbox courses), the chain
      // falls through to currentQuarter().
      const derived = deriveQuarter({
        semesterName: null,
        startDate: null,
        code: row.code,
      })

      if (row.quarter === derived) {
        console.log(`  ✓ ${row.name}: already "${derived}" (skip)`)
        skipped++
        continue
      }

      // Order matters: child rows first, course (the idempotency canary) last.
      // If we crash mid-course, course.quarter stays on the OLD value so the
      // next run re-tries the whole sequence; child UPDATEs are idempotent.

      // 1. Fetch assignment IDs (needed for the student_work .in() filter).
      const { data: asgnIds, error: asgnIdsErr } = await supabase
        .from('assignment')
        .select('id')
        .eq('course_id', row.id)
      if (asgnIdsErr) throw new Error(`assignment id fetch failed: ${asgnIdsErr.message}`)
      const ids = (asgnIds || []).map(a => a.id as string)

      // 2. Update assignment.quarter for all assignments under this course.
      const { error: asgnErr, count: asgnCount } = await supabase
        .from('assignment')
        .update({ quarter: derived }, { count: 'exact' })
        .eq('course_id', row.id)
      if (asgnErr) throw new Error(`assignment update failed: ${asgnErr.message}`)

      // 3. Update student_work.quarter for all student_work rows under those
      // assignments. Two-step because PostgREST doesn't support nested
      // UPDATE…WHERE…IN(SELECT) directly.
      let workCount = 0
      if (ids.length > 0) {
        const { error: workErr, count: wc } = await supabase
          .from('student_work')
          .update({ quarter: derived }, { count: 'exact' })
          .in('assignment_id', ids)
        if (workErr) throw new Error(`student_work update failed: ${workErr.message}`)
        workCount = wc ?? 0
      }

      // 4. LAST: update course.quarter. If everything above succeeded,
      // this commits the new quarter as the canonical value for this course.
      const { error: courseErr } = await supabase
        .from('course')
        .update({ quarter: derived })
        .eq('id', row.id)
      if (courseErr) throw new Error(`course update failed: ${courseErr.message}`)

      console.log(`  → ${row.name}: "${row.quarter ?? '(null)'}" → "${derived}" (assignments: ${asgnCount ?? 0}, student_work: ${workCount})`)
      updated++
    } catch (err) {
      console.error(`  ✗ ${row.name}: ${String(err)}`)
      errored++
    }
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped} errored=${errored}`)
  process.exit(errored > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
