import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { conversations as staticConversations, studentWork as staticWork } from '@/data'
import { primaryPillarFromTags } from '@/lib/pillar-resolution'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/reflect
 *
 * Powers /v2/reflect. Returns three lists for the work-tied reflection
 * surface:
 *   inProgress    — conversations the student is mid-way through (status
 *                   'in_progress'), with current phase derived from
 *                   which response fields are filled.
 *   completed     — completed conversations with synthesis excerpts.
 *                   Excludes open_reflection (those live under journal).
 *   featuredWork  — submitted student_work rows that have no completed
 *                   conversation yet — i.e. the "what could I reflect on
 *                   next?" candidates.
 *
 * Demo mode returns static seed conversations + work, filtered by the
 * first demo student so the page shows realistic content.
 */
export async function GET() {
  const cookieStore = cookies()

  // ─── Demo mode short-circuit ─────────────────
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    // Use the first demo student as the "current" one (the v2 layout
    // doesn't yet route demo viewers to a specific demo student, so
    // we anchor to one for consistent presentation).
    const demoStudentId = 'stu_aja'
    const studentConvos = staticConversations.filter(c => c.studentId === demoStudentId)
    const completedWorkBased = studentConvos.filter(
      c => c.status === 'completed' && c.conversationType !== 'open_reflection'
    )
    const inProgress = studentConvos.filter(c => c.status === 'in_progress')

    const reflectedWorkIds = new Set(
      completedWorkBased.map(c => c.workId).filter((id): id is string => !!id)
    )
    const studentWorkRows = staticWork.filter(w => w.studentId === demoStudentId)
    const featuredWork = studentWorkRows
      .filter(w => !reflectedWorkIds.has(w.id))
      .slice(0, 5)
      .map(w => ({
        id: w.id,
        title: w.title,
        courseName: w.courseName ?? null,
        submittedAt: w.submittedAt ?? null,
        workType: w.workType ?? null,
      }))

    return NextResponse.json({
      inProgress: inProgress.map(c => ({
        id: c.id,
        workId: c.workId,
        workTitle: c.workId
          ? staticWork.find(w => w.id === c.workId)?.title ?? null
          : null,
        startedAt: c.startedAt,
        currentPhase: derivePhase(c),
        primaryPillar: primaryPillarFromTags(c.skillTags),
      })),
      completed: completedWorkBased.map(c => ({
        id: c.id,
        workId: c.workId,
        workTitle: c.workId
          ? staticWork.find(w => w.id === c.workId)?.title ?? null
          : null,
        completedAt: c.completedAt ?? null,
        synthesisExcerpt: c.synthesisText
          ? c.synthesisText.slice(0, 140) + (c.synthesisText.length > 140 ? '…' : '')
          : null,
        skillTagCount: c.skillTags?.length ?? 0,
        primaryPillar: primaryPillarFromTags(c.skillTags),
      })),
      featuredWork,
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

  // Fetch all conversations + work for this student in two queries.
  // Include skill_id/confidence/student_confirmed on the skill_tag join
  // so we can resolve each conversation's primary pillar without a
  // second round-trip.
  const [{ data: convoRows }, { data: workRows }] = await Promise.all([
    admin
      .from('growth_conversation')
      .select(
        'id, work_id, status, started_at, completed_at, ' +
          'response_phase_1, response_phase_2, response_phase_3, ' +
          'prompt_phase_2, prompt_phase_3, ' +
          'synthesis_text, conversation_type, ' +
          'student_work(title), ' +
          'conversation_skill_tag(skill_id, confidence, student_confirmed)'
      )
      .eq('student_id', student.id)
      .order('started_at', { ascending: false })
      .limit(50),
    admin
      .from('student_work')
      .select('id, title, course_name, submitted_at, work_type')
      .eq('student_id', student.id)
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .limit(20),
  ])

  interface ConvoRow {
    id: string
    work_id: string | null
    status: string
    started_at: string
    completed_at: string | null
    response_phase_1: string | null
    response_phase_2: string | null
    response_phase_3: string | null
    prompt_phase_2: string | null
    prompt_phase_3: string | null
    synthesis_text: string | null
    conversation_type: string | null
    student_work: { title: string } | null
    conversation_skill_tag: Array<{
      skill_id: string
      confidence: number
      student_confirmed: boolean
    }> | null
  }
  interface WorkRow {
    id: string
    title: string
    course_name: string | null
    submitted_at: string | null
    work_type: string | null
  }
  const convos = (convoRows ?? []) as unknown as ConvoRow[]
  const work = (workRows ?? []) as unknown as WorkRow[]

  function tagsForConvo(c: ConvoRow) {
    return (c.conversation_skill_tag ?? []).map(t => ({
      skillId: t.skill_id,
      confidence: t.confidence,
      studentConfirmed: t.student_confirmed,
    }))
  }

  const inProgress = convos
    .filter(c => c.status === 'in_progress')
    .map(c => ({
      id: c.id,
      workId: c.work_id,
      workTitle: c.student_work?.title ?? null,
      startedAt: c.started_at,
      currentPhase: deriveDbPhase(c),
      primaryPillar: primaryPillarFromTags(tagsForConvo(c)),
    }))

  const completed = convos
    .filter(
      c => c.status === 'completed' && c.conversation_type !== 'open_reflection'
    )
    .map(c => ({
      id: c.id,
      workId: c.work_id,
      workTitle: c.student_work?.title ?? null,
      completedAt: c.completed_at,
      synthesisExcerpt: c.synthesis_text
        ? c.synthesis_text.slice(0, 140) + (c.synthesis_text.length > 140 ? '…' : '')
        : null,
      skillTagCount: c.conversation_skill_tag?.length ?? 0,
      primaryPillar: primaryPillarFromTags(tagsForConvo(c)),
    }))

  const reflectedWorkIds = new Set(
    convos
      .filter(c => c.status === 'completed' && c.conversation_type !== 'open_reflection')
      .map(c => c.work_id)
      .filter((id): id is string => !!id)
  )

  const featuredWork = work
    .filter(w => !reflectedWorkIds.has(w.id))
    .slice(0, 5)
    .map(w => ({
      id: w.id,
      title: w.title,
      courseName: w.course_name,
      submittedAt: w.submitted_at,
      workType: w.work_type,
    }))

  return NextResponse.json({ inProgress, completed, featuredWork })
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
