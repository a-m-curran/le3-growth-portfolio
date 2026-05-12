import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/today
 *
 * Aggregates the dynamic data behind /v2/today (student) into a
 * single response so the page doesn't have to chain three fetches.
 *
 * Returns:
 *   featuredWork    — submitted student_work without a completed
 *                     growth_conversation. "Next thing to reflect on."
 *                     Capped at 5.
 *   recentJournal   — recent completed conversations of type
 *                     'open_reflection'. Capped at 3.
 *   weekStats       — conversations completed + work submitted in the
 *                     last 7 days.
 *   ltiPinned       — the LTI resource the student most recently
 *                     launched from Brightspace, parsed from the
 *                     lti_context cookie set by /api/lti/launch.
 *                     Null when the student didn't arrive via LTI.
 *
 * Demo mode (NEXT_PUBLIC_DEMO_MODE=true) returns hand-built demo data
 * so the exploration shell looks alive when DB is empty.
 */
export async function GET() {
  const cookieStore = cookies()

  // ─── Demo mode short-circuit ─────────────────
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const ltiPinnedCookie = cookieStore.get('lti_context')?.value
    return NextResponse.json({
      featuredWork: [
        {
          id: 'demo_work_1',
          title: 'Reflection on Group Project Conflict',
          courseName: 'HUM 350',
          submittedAt: daysAgo(2),
          workType: 'essay',
        },
        {
          id: 'demo_work_2',
          title: 'Career Discovery Statement',
          courseName: 'LE3 101',
          submittedAt: daysAgo(4),
          workType: 'portfolio_piece',
        },
      ],
      recentJournal: [
        {
          id: 'demo_journal_1',
          startedAt: daysAgo(3),
          description: 'Felt overwhelmed before the presentation',
          synthesisExcerpt:
            'You noticed your old pattern starting up, and you chose to do something different…',
        },
      ],
      weekStats: {
        conversationsCompleted: 2,
        workSubmitted: 1,
      },
      ltiPinned: parseLtiContext(ltiPinnedCookie),
    })
  }

  // ─── DB-backed flow ─────────────────────────
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

  const { data: student } = await admin
    .from('student')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!student) {
    return NextResponse.json(
      { error: 'Student record not found' },
      { status: 404 }
    )
  }

  // ─── Featured work: submitted, not yet reflected on ─
  // Fetch all student_work for this student, then filter out any with
  // a completed conversation. Two queries instead of an EXISTS subquery
  // because Supabase's PostgREST doesn't expose that pattern cleanly.
  const { data: workRows } = await admin
    .from('student_work')
    .select('id, title, course_name, submitted_at, work_type')
    .eq('student_id', student.id)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(20)

  interface WorkRow {
    id: string
    title: string
    course_name: string | null
    submitted_at: string | null
    work_type: string | null
  }
  const allWork = (workRows ?? []) as unknown as WorkRow[]

  let reflectedWorkIds = new Set<string>()
  if (allWork.length > 0) {
    const { data: convoRows } = await admin
      .from('growth_conversation')
      .select('work_id')
      .eq('student_id', student.id)
      .eq('status', 'completed')
      .in('work_id', allWork.map(w => w.id))
    interface ConvoRow {
      work_id: string | null
    }
    const convos = (convoRows ?? []) as unknown as ConvoRow[]
    reflectedWorkIds = new Set(
      convos.map(c => c.work_id).filter((id): id is string => !!id)
    )
  }

  const featuredWork = allWork
    .filter(w => !reflectedWorkIds.has(w.id))
    .slice(0, 5)
    .map(w => ({
      id: w.id,
      title: w.title,
      courseName: w.course_name,
      submittedAt: w.submitted_at,
      workType: w.work_type,
    }))

  // ─── Recent journal (open_reflection) ───────
  const { data: journalRows } = await admin
    .from('growth_conversation')
    .select('id, started_at, work_context, synthesis_text')
    .eq('student_id', student.id)
    .eq('conversation_type', 'open_reflection')
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(3)

  interface JournalRow {
    id: string
    started_at: string
    work_context: string | null
    synthesis_text: string | null
  }
  const journal = (journalRows ?? []) as unknown as JournalRow[]
  const recentJournal = journal.map(j => ({
    id: j.id,
    startedAt: j.started_at,
    description: j.work_context,
    synthesisExcerpt: j.synthesis_text
      ? j.synthesis_text.slice(0, 140) + (j.synthesis_text.length > 140 ? '…' : '')
      : null,
  }))

  // ─── Week stats ─────────────────────────────
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ count: convoCount }, { count: workCount }] = await Promise.all([
    admin
      .from('growth_conversation')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', student.id)
      .eq('status', 'completed')
      .gte('started_at', weekAgo),
    admin
      .from('student_work')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', student.id)
      .gte('submitted_at', weekAgo),
  ])

  // ─── LTI pinned resource ────────────────────
  const ltiPinned = parseLtiContext(cookieStore.get('lti_context')?.value)

  return NextResponse.json({
    featuredWork,
    recentJournal,
    weekStats: {
      conversationsCompleted: convoCount ?? 0,
      workSubmitted: workCount ?? 0,
    },
    ltiPinned,
  })
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

interface LtiContext {
  resourceLinkId?: string
  resourceLinkTitle?: string
  contextTitle?: string
}

function parseLtiContext(
  raw: string | undefined
): { resourceLinkId: string; title: string; courseTitle: string | null } | null {
  if (!raw) return null
  try {
    const ctx = JSON.parse(raw) as LtiContext
    if (!ctx.resourceLinkId) return null
    return {
      resourceLinkId: ctx.resourceLinkId,
      title: ctx.resourceLinkTitle || 'Assignment',
      courseTitle: ctx.contextTitle || null,
    }
  } catch {
    return null
  }
}
