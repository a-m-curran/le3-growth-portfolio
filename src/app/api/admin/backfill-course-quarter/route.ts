import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { deriveQuarter } from '@/lib/d2l/mappers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Pure DB-side derivation now (no D2L calls). 70 courses × 3-4 Supabase
// round-trips per course = a few seconds total. 60s is ample.
export const maxDuration = 60

interface CourseRow {
  id: string
  name: string
  brightspace_org_unit_id: string | null
  code: string | null
  quarter: string | null
}

interface Transition {
  courseName: string
  orgUnitId: string
  code: string | null
  oldQuarter: string | null
  newQuarter: string
  assignmentCount: number
  studentWorkCount: number
}

interface FailedCourse {
  courseName: string
  orgUnitId: string
  message: string
}

/**
 * POST /api/admin/backfill-course-quarter
 *
 * ADMIN-gated. Recomputes the canonical "Season YYYY" for every course
 * from data already in the database (no D2L calls), then UPDATEs
 * course.quarter + assignment.quarter + student_work.quarter per course
 * where the stored value differs from the derived value.
 *
 * Why no D2L: deriveQuarter() now parses NLU's Banner term code
 * (course.code = "<sectionId>.<YYYY><TT>") as its primary signal —
 * that data is already in the lightweight org-structure payload we
 * sync into course.code on every run. The D2L /courses/{id} call
 * was the previous primary signal but required the orgunits:course:read
 * scope we don't have granted; bypassing it removes that dependency
 * AND removes a per-course network round-trip.
 *
 * Idempotent: courses whose stored quarter already matches the derived
 * value are skipped.
 *
 * Retry-safe ordering: child rows first (assignment, student_work),
 * course.quarter LAST as the canary. A mid-course crash leaves the
 * parent stale so the next run sees the mismatch and re-tries the
 * full sequence; child UPDATEs are idempotent no-ops on re-run.
 */
export async function POST() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.res

    const admin = createAdminClient()

    const { data: courses, error: loadErr } = await admin
      .from('course')
      .select('id, name, brightspace_org_unit_id, code, quarter')
      .not('brightspace_org_unit_id', 'is', null)
      .order('name')

    if (loadErr || !courses) {
      return NextResponse.json(
        { ok: false, error: `Failed to load courses: ${loadErr?.message ?? 'unknown'}` },
        { status: 500 }
      )
    }

    const rows = courses as CourseRow[]
    const transitions: Transition[] = []
    const failures: FailedCourse[] = []
    let updated = 0
    let skipped = 0
    let errored = 0

    for (const row of rows) {
      const orgUnitId = row.brightspace_org_unit_id!
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
          skipped++
          continue
        }

        // 1) Fetch assignment IDs (needed for student_work .in() filter)
        const { data: asgnIds, error: asgnIdsErr } = await admin
          .from('assignment')
          .select('id')
          .eq('course_id', row.id)
        if (asgnIdsErr) throw new Error(`assignment id fetch failed: ${asgnIdsErr.message}`)
        const ids = (asgnIds || []).map(a => a.id as string)

        // 2) Update assignment.quarter for all assignments under this course
        const { error: asgnErr, count: asgnCount } = await admin
          .from('assignment')
          .update({ quarter: derived }, { count: 'exact' })
          .eq('course_id', row.id)
        if (asgnErr) throw new Error(`assignment update failed: ${asgnErr.message}`)

        // 3) Update student_work.quarter for rows under those assignments
        let workCount = 0
        if (ids.length > 0) {
          const { error: workErr, count: wc } = await admin
            .from('student_work')
            .update({ quarter: derived }, { count: 'exact' })
            .in('assignment_id', ids)
          if (workErr) throw new Error(`student_work update failed: ${workErr.message}`)
          workCount = wc ?? 0
        }

        // 4) LAST: update course.quarter (the canary)
        const { error: courseErr } = await admin
          .from('course')
          .update({ quarter: derived })
          .eq('id', row.id)
        if (courseErr) throw new Error(`course update failed: ${courseErr.message}`)

        transitions.push({
          courseName: row.name,
          orgUnitId,
          code: row.code,
          oldQuarter: row.quarter,
          newQuarter: derived,
          assignmentCount: asgnCount ?? 0,
          studentWorkCount: workCount,
        })
        updated++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        failures.push({ courseName: row.name, orgUnitId, message })
        errored++
        console.error(`backfill-course-quarter: ${row.name}: ${message}`)
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        totalCourses: rows.length,
        updated,
        skipped,
        errored,
      },
      transitions,
      failures,
    })
  } catch (error) {
    console.error('backfill-course-quarter error:', error)
    return NextResponse.json(
      { ok: false, error: 'Backfill failed: ' + String(error) },
      { status: 500 }
    )
  }
}
