import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { students as staticStudents } from '@/data'

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
 * Demo mode (NEXT_PUBLIC_DEMO_MODE=true) returns all demo students
 * regardless of coach assignment, so the exploration shell shows
 * meaningful data even when the real DB caseload is empty.
 */
export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // ─── Demo mode short-circuit ─────────────────
  // Give demo students fake activity profiles so the Today view shows
  // a realistic mix of "needs attention" and "active recently" rather
  // than every student showing as never-active.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const now = Date.now()
    const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString()
    // Hardcoded variation profile keyed by index. Deterministic so the
    // demo always looks the same regardless of when it's loaded.
    const profiles: Array<{ daysSinceActivity: number | null; count: number }> = [
      { daysSinceActivity: 2, count: 10 },   // active, no attention
      { daysSinceActivity: 25, count: 3 },   // needs attention (stale)
      { daysSinceActivity: 5, count: 7 },    // active
      { daysSinceActivity: null, count: 0 }, // needs attention (never active)
    ]
    return NextResponse.json({
      students: staticStudents.map((s, i) => {
        const profile = profiles[i % profiles.length]
        const lastActivityAt = profile.daysSinceActivity == null
          ? null
          : daysAgo(profile.daysSinceActivity)
        const needsAttention =
          profile.daysSinceActivity == null || profile.daysSinceActivity >= 21
        return {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          email: s.email,
          cohort: s.cohort,
          conversationCount: profile.count,
          lastActivityAt,
          needsAttention,
        }
      }),
    })
  }

  // ─── DB-backed (production) ──────────────────
  const admin = createAdminClient()

  const { data: coach } = await admin
    .from('coach')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!coach) {
    return NextResponse.json({ error: 'Coach access required' }, { status: 403 })
  }

  // Fetch all students assigned to this coach
  const { data: studentsRaw } = await admin
    .from('student')
    .select('id, first_name, last_name, email, cohort, status')
    .eq('coach_id', coach.id)
    .eq('status', 'active')
    .order('last_name', { ascending: true })

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
