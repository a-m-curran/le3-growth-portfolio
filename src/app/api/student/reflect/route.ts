import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'
import type {
  ActiveInProgress,
  SubmissionItem,
  SubmissionStatus,
} from '@/components/v2/student/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/reflect
 *
 * Returns the data needed to render the redesigned /v2/reflect:
 *   - activeInProgress: the single in-progress conversation for this
 *     student (single-active model), or null. Drives the pinned banner.
 *   - submissions: every student_work row for this student, with its
 *     per-row status derived from growth_conversation. The tree is
 *     built client-side from this flat list (Quarter -> Course -> Week
 *     -> Submissions). No .limit() — see PR #12 (max ~239 rows / small
 *     payload is safe at pilot scale).
 *
 * Demo personas are real DB rows (is_demo=true). The student id is
 * resolved through `getV2StudentId` which honors the demo persona
 * cookie OR real Supabase auth — same query path for both.
 *
 * Open-reflection (conversation_type='open_reflection') conversations
 * are excluded from the per-row status computation — those live under
 * /api/student/journal. An open-reflection that is currently in_progress
 * IS surfaced in activeInProgress (so the banner appears on Reflect),
 * with workId=null and workTitle=null falling back to work_context in
 * the InProgressBanner component.
 */
export async function GET() {
  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Pull all work + all non-abandoned conversations in parallel.
  const [{ data: workRows }, { data: convoRows }] = await Promise.all([
    admin
      .from('student_work')
      .select('id, title, course_name, course_code, quarter, week_number, submitted_at, work_type')
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false, nullsFirst: false }),
    admin
      .from('growth_conversation')
      .select(
        'id, work_id, status, conversation_type, started_at, work_context, ' +
          'response_phase_1, response_phase_2, response_phase_3, ' +
          'prompt_phase_2, prompt_phase_3, ' +
          'student_work(title), ' +
          'conversation_skill_tag(skill_id, confidence, durable_skill(pillar:pillar_id(name)))'
      )
      .eq('student_id', studentId)
      .in('status', ['in_progress', 'completed'])
      .order('started_at', { ascending: false }),
  ])

  interface WorkRow {
    id: string
    title: string
    course_name: string | null
    course_code: string | null
    quarter: string
    week_number: number | null
    submitted_at: string | null
    work_type: string | null
  }
  interface ConvoTag {
    skill_id: string
    confidence: number
    durable_skill: { pillar: { name: string } | null } | null
  }
  interface ConvoRow {
    id: string
    work_id: string | null
    status: 'in_progress' | 'completed'
    conversation_type: 'work_based' | 'open_reflection' | null
    started_at: string
    work_context: string | null
    response_phase_1: string | null
    response_phase_2: string | null
    response_phase_3: string | null
    prompt_phase_2: string | null
    prompt_phase_3: string | null
    student_work: { title: string } | null
    conversation_skill_tag: ConvoTag[] | null
  }

  const work = (workRows ?? []) as unknown as WorkRow[]
  const convos = (convoRows ?? []) as unknown as ConvoRow[]

  // Index conversations by work_id (work_based only). Prefer in_progress
  // over completed; among completed, the most recent (convos are already
  // sorted newest-first by started_at).
  const convoByWorkId = new Map<string, ConvoRow>()
  for (const c of convos) {
    if (c.conversation_type === 'open_reflection') continue
    if (!c.work_id) continue
    const existing = convoByWorkId.get(c.work_id)
    if (!existing) {
      convoByWorkId.set(c.work_id, c)
    } else if (existing.status === 'completed' && c.status === 'in_progress') {
      convoByWorkId.set(c.work_id, c)
    }
  }

  function dominantPillar(c: ConvoRow): string | null {
    const tags = c.conversation_skill_tag ?? []
    if (tags.length === 0) return null
    const top = [...tags].sort((a, b) => b.confidence - a.confidence)[0]
    return top.durable_skill?.pillar?.name ?? null
  }

  const submissions: SubmissionItem[] = work.map(w => {
    const c = convoByWorkId.get(w.id) ?? null
    let status: SubmissionStatus = 'unreflected'
    if (c) status = c.status === 'in_progress' ? 'in_progress' : 'completed'
    return {
      id: w.id,
      title: w.title,
      courseName: w.course_name,
      courseCode: w.course_code,
      quarter: w.quarter,
      weekNumber: w.week_number,
      submittedAt: w.submitted_at,
      workType: w.work_type,
      status,
      conversationId: c?.id ?? null,
      primaryPillar: c && status === 'completed' ? dominantPillar(c) : null,
    }
  })

  // Active in-progress (single-active). Includes open_reflection.
  // If multiple in_progress exist (data anomaly), prefer the most-recent.
  const inProgress = convos.filter(c => c.status === 'in_progress')
  const activeRow = inProgress[0] ?? null

  function derivePhase(c: ConvoRow): 1 | 2 | 3 {
    if (c.response_phase_2 && c.prompt_phase_3) return 3
    if (c.response_phase_1 && c.prompt_phase_2) return 2
    return 1
  }

  const activeInProgress: ActiveInProgress | null = activeRow
    ? {
        id: activeRow.id,
        workId: activeRow.work_id,
        workTitle: activeRow.student_work?.title ?? null,
        conversationType: (activeRow.conversation_type ?? 'work_based') as
          | 'work_based'
          | 'open_reflection',
        currentPhase: derivePhase(activeRow),
        startedAt: activeRow.started_at,
      }
    : null

  return NextResponse.json({ activeInProgress, submissions })
}
