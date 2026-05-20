import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'
import { primaryPillarFromTags } from '@/lib/pillar-resolution'
import type {
  ActiveInProgress,
  SubmissionItem,
  SubmissionStatus,
} from '@/components/v2/student/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/today
 *
 * Returns the data behind /v2/today after the redesign:
 *   - activeInProgress: same shape as /api/student/reflect; drives the
 *     pinned in-progress banner (the banner appears on both surfaces).
 *   - submissions: every student_work row with per-row status. The
 *     Today/This week/Earlier buckets are computed client-side from
 *     submitted_at in the user's local timezone.
 *   - recentJournal: unchanged (last 3 open_reflection completed). The
 *     .limit(3) here is intentional and doc-stated — separate concern
 *     from the work-list caps removed in PR #12 and PR #13.
 *   - weekStats: unchanged (counts for the last 7 days).
 *   - ltiPinned: unchanged (parsed from the lti_context cookie).
 *
 * Demo personas are real DB rows (is_demo=true). The student id is
 * resolved through `getV2StudentId` which honors the demo persona
 * cookie OR real Supabase auth — same query path for both.
 */
export async function GET() {
  const cookieStore = cookies()
  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  // ─── Work + per-work conversations (status discriminator) ───
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

  const convoByWorkId = new Map<string, ConvoRow>()
  for (const c of convos) {
    if (c.conversation_type === 'open_reflection') continue
    if (!c.work_id) continue
    const existing = convoByWorkId.get(c.work_id)
    if (!existing) convoByWorkId.set(c.work_id, c)
    else if (existing.status === 'completed' && c.status === 'in_progress') {
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

  // Active in-progress.
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

  // ─── Recent journal (open_reflection completed). Cap of 3 is
  //     intentional / doc-stated — separate from the work-list caps
  //     removed in PR #12 and PR #13.
  const { data: journalRows } = await admin
    .from('growth_conversation')
    .select(`
      id, started_at, work_context, synthesis_text,
      conversation_skill_tag (
        skill_id, confidence, student_confirmed,
        durable_skill ( name, pillar:pillar_id ( name ) )
      )
    `)
    .eq('student_id', studentId)
    .eq('conversation_type', 'open_reflection')
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(3)

  interface JournalRow {
    id: string
    started_at: string
    work_context: string | null
    synthesis_text: string | null
    conversation_skill_tag: Array<{
      skill_id: string
      confidence: number
      student_confirmed: boolean
      durable_skill: { name: string; pillar: { name: string } | null } | null
    }> | null
  }
  const recentJournal = ((journalRows ?? []) as unknown as JournalRow[]).map(j => {
    const tags = (j.conversation_skill_tag ?? []).map(t => ({
      skillId: t.skill_id,
      confidence: t.confidence,
      studentConfirmed: t.student_confirmed,
    }))
    const topTag = tags.length
      ? [...tags].sort((a, b) => b.confidence - a.confidence)[0]
      : null
    const pillarName = topTag
      ? j.conversation_skill_tag?.find(t => t.skill_id === topTag.skillId)
          ?.durable_skill?.pillar?.name ?? null
      : null
    return {
      id: j.id,
      startedAt: j.started_at,
      description: j.work_context,
      synthesisExcerpt: j.synthesis_text
        ? j.synthesis_text.slice(0, 140) + (j.synthesis_text.length > 140 ? '…' : '')
        : null,
      primaryPillar: pillarName,
    }
  })

  // ─── Week stats (unchanged from prior shape) ─────────
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [{ count: convoCount }, { count: workCount }] = await Promise.all([
    admin
      .from('growth_conversation')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .gte('started_at', weekAgo),
    admin
      .from('student_work')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .gte('submitted_at', weekAgo),
  ])

  // ─── LTI pinned (unchanged) ─────────────────────────
  const ltiPinned = parseLtiContext(cookieStore.get('lti_context')?.value)

  // Retained for legacy callers; not used here (pillar resolution joins
  // through SQL directly).
  void primaryPillarFromTags

  return NextResponse.json({
    activeInProgress,
    submissions,
    recentJournal,
    weekStats: {
      conversationsCompleted: convoCount ?? 0,
      workSubmitted: workCount ?? 0,
    },
    ltiPinned,
  })
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
