import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2CoachId, getV2Identity } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/coach/students
 *
 * Returns the authenticated coach's caseload as a compact list. Used
 * by the v2 StudentPicker dropdown and the /v2/coach/caseload page.
 *
 * Each row carries enough for at-a-glance triage on the caseload list:
 *   - id, firstName, lastName, email
 *   - cohort
 *   - conversationCount (this quarter)
 *   - lastActivityAt (most recent completed conversation start)
 *   - needsAttention (boolean — derived from error_count or stale activity)
 *
 * Demo coaches (acted via persona cookie) see all is_demo=true
 * students — demo personas form their own "caseload" so the demo
 * experience shows a populated coach view. Real coaches only see
 * their assigned, non-demo students.
 */
export async function GET() {
  const identity = await getV2Identity()
  if (!identity || identity.role !== 'coach') {
    return NextResponse.json({ error: 'Coach access required' }, { status: 401 })
  }
  const coachId = await getV2CoachId()
  if (!coachId) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 })
  }

  const admin = createAdminClient()

  // Real coach: only their assigned non-demo students.
  // Demo coach (acting via persona): all demo students they're assigned to
  // PLUS demo students from other demo coaches, so the demo caseload
  // always shows the full set of personas.
  let query = admin
    .from('student')
    .select('id, first_name, last_name, email, cohort, status')
    .eq('status', 'active')
    .order('last_name', { ascending: true })

  if (identity.isDemo) {
    query = query.eq('is_demo', true)
  } else {
    query = query.eq('coach_id', coachId).eq('is_demo', false)
  }

  const { data: studentsRaw } = await query

  interface StudentRow {
    id: string
    first_name: string
    last_name: string
    email: string
    cohort: string | null
    status: string
  }
  const students = (studentsRaw ?? []) as unknown as StudentRow[]

  if (students.length === 0) {
    return NextResponse.json({ students: [] })
  }

  // Bulk-compute conversation counts + last activity per student.
  // Two queries, one round-trip-per-student would be N+1 — and even at
  // 50 students that's fine, but the bulk pattern scales better.
  const ids = students.map(s => s.id)

  const { data: convoSummariesRaw } = await admin
    .from('growth_conversation')
    .select('student_id, started_at, status')
    .in('student_id', ids)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })

  interface ConvoSummaryRow {
    student_id: string
    started_at: string
    status: string
  }
  const convoSummaries = (convoSummariesRaw ?? []) as unknown as ConvoSummaryRow[]

  // Build per-student rollups: count completed conversations and find
  // the most recent started_at.
  const perStudent = new Map<string, { count: number; lastAt: string | null }>()
  for (const c of convoSummaries) {
    const existing = perStudent.get(c.student_id)
    if (existing) {
      existing.count++
      if (!existing.lastAt || c.started_at > existing.lastAt) {
        existing.lastAt = c.started_at
      }
    } else {
      perStudent.set(c.student_id, { count: 1, lastAt: c.started_at })
    }
  }

  // "Needs attention" heuristic: no completed conversation in the last
  // 21 days. Threshold is arbitrary — refine once we see real cohort
  // behavior. We don't currently surface coach-side error rollups here
  // (those live in event_log); the Today view does that aggregation
  // separately.
  const staleThreshold = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)

  const result = students.map(s => {
    const rollup = perStudent.get(s.id)
    const lastAt = rollup?.lastAt ?? null
    const stale = !lastAt || new Date(lastAt) < staleThreshold
    return {
      id: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      email: s.email,
      cohort: s.cohort,
      conversationCount: rollup?.count ?? 0,
      lastActivityAt: lastAt,
      needsAttention: stale,
    }
  })

  return NextResponse.json({ students: result })
}
