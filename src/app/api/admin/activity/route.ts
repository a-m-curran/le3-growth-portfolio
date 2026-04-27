import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/activity
 *
 * Coach-only "what's happening right now" feed. Returns recent
 * `event_log` rows + counts by level + a per-student error rollup
 * suitable for surfacing red badges in the caseload list.
 *
 * Query params:
 *   ?level=error        only error+fatal events
 *   ?event_type=llm.    prefix-match on event_type
 *   ?student_id=UUID    filter to one student
 *   ?since=ISO          events occurred_at >= since
 *
 * Returns up to 200 rows; the dashboard typically requests 50.
 */
export async function GET(req: Request) {
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

  const admin = createAdminClient()
  const { data: coach } = await admin
    .from('coach')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!coach) {
    return NextResponse.json({ error: 'Coach access required' }, { status: 403 })
  }

  const url = new URL(req.url)
  const levelFilter = url.searchParams.get('level')
  const eventTypePrefix = url.searchParams.get('event_type')
  const studentFilter = url.searchParams.get('student_id')
  const sinceParam = url.searchParams.get('since')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)

  let query = admin
    .from('event_log')
    .select(
      'id, occurred_at, actor_type, actor_id, student_id, event_type, ' +
        'level, message, context, request_id, duration_ms'
    )
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (levelFilter) {
    if (levelFilter === 'error_or_fatal') {
      query = query.in('level', ['error', 'fatal'])
    } else {
      query = query.eq('level', levelFilter)
    }
  }
  if (eventTypePrefix) {
    query = query.like('event_type', `${eventTypePrefix}%`)
  }
  if (studentFilter) {
    query = query.eq('student_id', studentFilter)
  }
  if (sinceParam) {
    query = query.gte('occurred_at', sinceParam)
  }

  const { data: events, error: eventsErr } = await query
  if (eventsErr) {
    return NextResponse.json(
      { error: `event_log query failed: ${eventsErr.message}` },
      { status: 500 }
    )
  }

  // ─── Counts strip: last 24h activity by level ──
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: countsRaw } = await admin
    .from('event_log')
    .select('level, event_type', { count: 'exact', head: false })
    .gte('occurred_at', since24h)

  const countsAll = (countsRaw ?? []) as Array<{ level: string; event_type: string }>
  const counts = {
    last24h_total: countsAll.length,
    last24h_errors: countsAll.filter(e => e.level === 'error' || e.level === 'fatal')
      .length,
    last24h_warnings: countsAll.filter(e => e.level === 'warn').length,
    last24h_llm_calls: countsAll.filter(e => e.event_type.startsWith('llm.')).length,
    last24h_conversations: countsAll.filter(e =>
      e.event_type.startsWith('conversation.')
    ).length,
    last24h_work_uploads: countsAll.filter(e => e.event_type === 'work.uploaded')
      .length,
  }

  // ─── Per-student error rollup ─────────────────
  // For each student that had any error in the last 24h, count and
  // include the most recent error message for at-a-glance triage.
  const errorEvents = countsAll.filter(
    e => e.level === 'error' || e.level === 'fatal'
  )
  const { data: studentErrorsRaw } = await admin
    .from('event_log')
    .select('student_id, event_type, message, occurred_at')
    .in('level', ['error', 'fatal'])
    .gte('occurred_at', since24h)
    .not('student_id', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(500)

  interface StudentErrorRow {
    student_id: string
    event_type: string
    message: string | null
    occurred_at: string
  }
  const studentErrors = (studentErrorsRaw ?? []) as StudentErrorRow[]

  // Group by student_id
  const perStudent = new Map<
    string,
    {
      student_id: string
      error_count: number
      latest_event_type: string
      latest_message: string | null
      latest_at: string
    }
  >()
  for (const ev of studentErrors) {
    const existing = perStudent.get(ev.student_id)
    if (existing) {
      existing.error_count++
    } else {
      perStudent.set(ev.student_id, {
        student_id: ev.student_id,
        error_count: 1,
        latest_event_type: ev.event_type,
        latest_message: ev.message,
        latest_at: ev.occurred_at,
      })
    }
  }
  const perStudentRollup = Array.from(perStudent.values())

  return NextResponse.json({
    counts,
    perStudentErrors: perStudentRollup,
    events: events ?? [],
    // Echo errorEvents length so dashboard can show "X errors total"
    // without needing to filter the events array on its own.
    totalErrorsLast24h: errorEvents.length,
  })
}
