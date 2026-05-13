import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'
import { primaryPillarFromTags } from '@/lib/pillar-resolution'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/today
 *
 * Aggregates the dynamic data behind /v2/today into a single response
 * so the page doesn't have to chain three fetches.
 *
 * Returns:
 *   featuredWork    — most recent submitted work, each enriched with
 *                     its dominant conversation (if any) so the card
 *                     can deep-link into the conversation replay
 *                     (`conversationId`) or, when no conversation
 *                     exists, route to `/v2/reflect/start?work=X` to
 *                     start one.
 *   recentJournal   — recent completed conversations of type
 *                     'open_reflection'. Capped at 3.
 *   weekStats       — conversations completed + work submitted in the
 *                     last 7 days.
 *   ltiPinned       — the LTI resource the student most recently
 *                     launched from Brightspace, parsed from the
 *                     lti_context cookie set by /api/lti/launch.
 *                     Null when the student didn't arrive via LTI.
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

  // ─── Recent work + linked conversations ───
  // Pull the most recent submissions, then look up any completed
  // conversation per work_id so the card can either route to
  // /v2/conversation/[id] (existing reflection) or /v2/reflect/start
  // (start a new one).
  const { data: workRows } = await admin
    .from('student_work')
    .select('id, title, course_name, submitted_at, work_type')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(5)

  interface WorkRow {
    id: string
    title: string
    course_name: string | null
    submitted_at: string | null
    work_type: string | null
  }
  const allWork = (workRows ?? []) as unknown as WorkRow[]

  // For the work items we just pulled, find the most recent completed
  // conversation per work_id. Returning this enables the demo's "see
  // it in action" flow on cards that already have a reflection.
  const conversationByWorkId = new Map<string, string>()
  const pillarByWorkId = new Map<string, string | null>()
  if (allWork.length > 0) {
    const { data: convoRows } = await admin
      .from('growth_conversation')
      .select(
        'id, work_id, started_at, conversation_skill_tag(skill_id, confidence, student_confirmed, durable_skill(name, pillar:pillar_id(name)))'
      )
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .in('work_id', allWork.map(w => w.id))
      .order('started_at', { ascending: false })

    interface ConvoRow {
      id: string
      work_id: string | null
      conversation_skill_tag: Array<{
        skill_id: string
        confidence: number
        student_confirmed: boolean
        durable_skill: {
          name: string
          pillar: { name: string } | null
        } | null
      }> | null
    }
    for (const c of (convoRows ?? []) as unknown as ConvoRow[]) {
      if (!c.work_id || conversationByWorkId.has(c.work_id)) continue
      conversationByWorkId.set(c.work_id, c.id)
      // Dominant pillar — derived from skill tags joined through
      // durable_skill → pillar. Single query, no second round-trip.
      const tags = (c.conversation_skill_tag ?? []).map(t => ({
        skillId: t.skill_id,
        confidence: t.confidence,
        studentConfirmed: t.student_confirmed,
      }))
      const topTag = tags.length
        ? [...tags].sort((a, b) => b.confidence - a.confidence)[0]
        : null
      const topPillar = topTag
        ? c.conversation_skill_tag?.find(t => t.skill_id === topTag.skillId)
            ?.durable_skill?.pillar?.name ?? null
        : null
      pillarByWorkId.set(c.work_id, topPillar)
    }
  }

  const featuredWork = allWork.map(w => ({
    id: w.id,
    title: w.title,
    courseName: w.course_name,
    submittedAt: w.submitted_at,
    workType: w.work_type,
    conversationId: conversationByWorkId.get(w.id) ?? null,
    primaryPillar: pillarByWorkId.get(w.id) ?? null,
  }))

  // ─── Recent journal (open_reflection) ─────────────
  // Pull skill-tag rows + their joined skill→pillar so we can resolve
  // each entry's dominant pillar without a second round-trip.
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
      durable_skill: {
        name: string
        pillar: { name: string } | null
      } | null
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

  // ─── Week stats ─────────────────────────────
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

  // ─── LTI pinned resource ────────────────────
  const ltiPinned = parseLtiContext(cookieStore.get('lti_context')?.value)

  // Note: `primaryPillarFromTags` import retained for legacy callers
  // but unused here — pillar resolution now joins through the SQL
  // query directly.
  void primaryPillarFromTags

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
