import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/reflect
 *
 * Powers /v2/reflect. Returns three lists for the work-tied reflection
 * surface:
 *   inProgress    — conversations the student is mid-way through
 *   completed     — completed conversations with synthesis excerpts
 *                   (excludes open_reflection — those live under
 *                   /api/student/journal)
 *   featuredWork  — submitted student_work rows that have no completed
 *                   conversation yet — the "what could I reflect on next?"
 *                   candidates
 *
 * Demo personas are real DB rows (is_demo=true). The student id is
 * resolved through `getV2StudentId` which honors the demo persona
 * cookie OR real Supabase auth — same query path for both.
 */
export async function GET() {
  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Pilot: both queries are intentionally unbounded. Real students have
  // up to ~240 submissions / ~18 conversations; a silent .limit() here
  // previously dropped older work from /v2/reflect (compounded by the
  // featuredWork cap below), making submissions unavailable to reflect
  // on. A navigable quarter→course→assignment view is the planned
  // redesign; until then nothing eligible may be hidden.
  const [{ data: convoRows }, { data: workRows }] = await Promise.all([
    admin
      .from('growth_conversation')
      .select(
        'id, work_id, status, started_at, completed_at, ' +
          'response_phase_1, response_phase_2, response_phase_3, ' +
          'prompt_phase_2, prompt_phase_3, ' +
          'synthesis_text, conversation_type, ' +
          'student_work(title), ' +
          'conversation_skill_tag(skill_id, confidence, student_confirmed, ' +
          '  durable_skill(name, pillar:pillar_id(name)))'
      )
      .eq('student_id', studentId)
      .order('started_at', { ascending: false }),
    admin
      .from('student_work')
      .select('id, title, course_name, submitted_at, work_type')
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false, nullsFirst: false }),
  ])

  interface ConvoTag {
    skill_id: string
    confidence: number
    student_confirmed: boolean
    durable_skill: {
      name: string
      pillar: { name: string } | null
    } | null
  }
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
    conversation_skill_tag: ConvoTag[] | null
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

  function dominantPillar(c: ConvoRow): string | null {
    const tags = c.conversation_skill_tag ?? []
    if (tags.length === 0) return null
    const top = [...tags].sort((a, b) => b.confidence - a.confidence)[0]
    return top.durable_skill?.pillar?.name ?? null
  }

  const inProgress = convos
    .filter(c => c.status === 'in_progress')
    .map(c => ({
      id: c.id,
      workId: c.work_id,
      workTitle: c.student_work?.title ?? null,
      startedAt: c.started_at,
      currentPhase: deriveDbPhase(c),
      primaryPillar: dominantPillar(c),
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
      primaryPillar: dominantPillar(c),
    }))

  const reflectedWorkIds = new Set(
    convos
      .filter(c => c.status === 'completed' && c.conversation_type !== 'open_reflection')
      .map(c => c.work_id)
      .filter((id): id is string => !!id)
  )

  // No cap — every un-reflected submission is returned (see note above).
  const featuredWork = work
    .filter(w => !reflectedWorkIds.has(w.id))
    .map(w => ({
      id: w.id,
      title: w.title,
      courseName: w.course_name,
      submittedAt: w.submitted_at,
      workType: w.work_type,
    }))

  return NextResponse.json({ inProgress, completed, featuredWork })
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
