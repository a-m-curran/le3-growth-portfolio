import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { conversations as staticConversations } from '@/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/journal
 *
 * Powers /v2/journal — open standalone reflections (conversation_type =
 * 'open_reflection'). Distinct from /api/student/reflect which handles
 * work-tied conversations.
 *
 * Returns:
 *   inProgress  — in_progress journal entries (resume cards)
 *   completed   — completed journal entries with description + synthesis
 */
export async function GET() {
  const cookieStore = cookies()

  // ─── Demo mode ──────────────────────────────
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const demoStudentId = 'stu_aja'
    const journal = staticConversations.filter(
      c => c.studentId === demoStudentId && c.conversationType === 'open_reflection'
    )
    const inProgress = journal.filter(c => c.status === 'in_progress')
    const completed = journal.filter(c => c.status === 'completed')
    return NextResponse.json({
      inProgress: inProgress.map(c => ({
        id: c.id,
        startedAt: c.startedAt,
        description: c.workContext ?? null,
        currentPhase: derivePhase(c),
      })),
      completed: completed.map(c => ({
        id: c.id,
        startedAt: c.startedAt,
        completedAt: c.completedAt ?? null,
        description: c.workContext ?? null,
        synthesisExcerpt: c.synthesisText
          ? c.synthesisText.slice(0, 160) + (c.synthesisText.length > 160 ? '…' : '')
          : null,
      })),
    })
  }

  // ─── DB-backed ───────────────────────────────
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
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data: student } = await admin
    .from('student')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!student) {
    return NextResponse.json({ error: 'Student record not found' }, { status: 404 })
  }

  const { data: convoRows } = await admin
    .from('growth_conversation')
    .select(
      'id, status, started_at, completed_at, work_context, ' +
        'response_phase_1, response_phase_2, prompt_phase_2, prompt_phase_3, ' +
        'synthesis_text'
    )
    .eq('student_id', student.id)
    .eq('conversation_type', 'open_reflection')
    .order('started_at', { ascending: false })
    .limit(50)

  interface ConvoRow {
    id: string
    status: string
    started_at: string
    completed_at: string | null
    work_context: string | null
    response_phase_1: string | null
    response_phase_2: string | null
    prompt_phase_2: string | null
    prompt_phase_3: string | null
    synthesis_text: string | null
  }
  const convos = (convoRows ?? []) as unknown as ConvoRow[]

  const inProgress = convos
    .filter(c => c.status === 'in_progress')
    .map(c => ({
      id: c.id,
      startedAt: c.started_at,
      description: c.work_context,
      currentPhase: deriveDbPhase(c),
    }))

  const completed = convos
    .filter(c => c.status === 'completed')
    .map(c => ({
      id: c.id,
      startedAt: c.started_at,
      completedAt: c.completed_at,
      description: c.work_context,
      synthesisExcerpt: c.synthesis_text
        ? c.synthesis_text.slice(0, 160) + (c.synthesis_text.length > 160 ? '…' : '')
        : null,
    }))

  return NextResponse.json({ inProgress, completed })
}

interface PhaseSource {
  responsePhase1?: string | null
  responsePhase2?: string | null
  promptPhase2?: string | null
  promptPhase3?: string | null
}

function derivePhase(c: PhaseSource): 1 | 2 | 3 {
  if (c.responsePhase2 && c.promptPhase3) return 3
  if (c.responsePhase1 && c.promptPhase2) return 2
  return 1
}

function deriveDbPhase(c: {
  response_phase_1: string | null
  response_phase_2: string | null
  prompt_phase_2: string | null
  prompt_phase_3: string | null
}): 1 | 2 | 3 {
  if (c.response_phase_2 && c.prompt_phase_3) return 3
  if (c.response_phase_1 && c.prompt_phase_2) return 2
  return 1
}
