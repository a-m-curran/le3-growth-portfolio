/**
 * Owner-runnable backfill: refetch every course from D2L, derive the
 * canonical quarter via the new mapper, and UPDATE course.quarter +
 * assignment.quarter + student_work.quarter for that course.
 *
 * Idempotent: skips any course whose stored quarter already matches the
 * derived value (no UPDATE, just a log line).
 *
 * Per-course error handling: a D2L fetch failure for one course logs
 * the error and proceeds to the next course; does not abort the whole
 * backfill. Final exit code is 1 if any course errored (so an
 * automation can detect partial failures); 0 otherwise.
 *
 * Requires env (.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, plus the D2L Valence env the existing
 * sync code reads (D2L_VALENCE_INSTANCE_URL / CLIENT_ID / etc.).
 *
 * Run: npx tsx scripts/backfill-course-quarter.ts
 */

// Load .env.local BEFORE importing any module that reads env at import time.
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { getCourse } from '../src/lib/d2l/courses'

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
  quarter: string | null
}

async function main(): Promise<void> {
  const { data: courses, error: loadErr } = await supabase
    .from('course')
    .select('id, name, brightspace_org_unit_id, quarter')
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
    const orgUnitId = row.brightspace_org_unit_id!
    try {
      const enriched = await getCourse(orgUnitId)
      const derived = enriched.quarter

      if (row.quarter === derived) {
        console.log(`  ✓ ${row.name}: already "${derived}" (skip)`)
        skipped++
        continue
      }

      // Update course.quarter.
      const { error: courseErr } = await supabase
        .from('course')
        .update({ quarter: derived })
        .eq('id', row.id)
      if (courseErr) throw new Error(`course update failed: ${courseErr.message}`)

      // Update assignment.quarter for all assignments under this course.
      const { error: asgnErr, count: asgnCount } = await supabase
        .from('assignment')
        .update({ quarter: derived }, { count: 'exact' })
        .eq('course_id', row.id)
      if (asgnErr) throw new Error(`assignment update failed: ${asgnErr.message}`)

      // Update student_work.quarter for all student_work rows under those
      // assignments. Two-step because PostgREST doesn't support nested
      // UPDATE…WHERE…IN(SELECT) directly: fetch assignment IDs first.
      const { data: asgnIds, error: asgnIdsErr } = await supabase
        .from('assignment')
        .select('id')
        .eq('course_id', row.id)
      if (asgnIdsErr) throw new Error(`assignment id fetch failed: ${asgnIdsErr.message}`)
      const ids = (asgnIds || []).map(a => a.id as string)

      let workCount = 0
      if (ids.length > 0) {
        const { error: workErr, count: wc } = await supabase
          .from('student_work')
          .update({ quarter: derived }, { count: 'exact' })
          .in('assignment_id', ids)
        if (workErr) throw new Error(`student_work update failed: ${workErr.message}`)
        workCount = wc ?? 0
      }

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
