import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2Identity } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/conversations/[id]
 *
 * Returns a single growth_conversation hydrated for display:
 *   - All three phases (prompts + responses)
 *   - Synthesis + suggested insight
 *   - Skill tags with embedded durable_skill names (so the UI doesn't
 *     need a second round-trip to /api/skills)
 *   - Work title + course (joined from student_work) so the panel
 *     header reads correctly without a separate fetch
 *
 * Demo personas are real DB rows (is_demo=true) — they exercise the
 * same query path as real students.
 *
 * Authorization: a student can read their own conversations; a coach
 * can read their assigned students' conversations. Demo coaches can
 * read any is_demo student's conversations (so the demo coach view
 * has access to the full demo cohort).
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  // Auth: persona cookie OR real Supabase auth. Demo personas hit
  // the same DB query path as real students — no static seed.
  const identity = await getV2Identity()
  if (!identity) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Fetch the conversation with its work + skill tag joins.
  // Supabase's typed client doesn't infer the join shape well here, so
  // we cast through unknown to a hand-written shape that matches the
  // selected columns + relations.
  interface ConvRow {
    id: string
    student_id: string
    work_id: string | null
    status: string
    conversation_type: string | null
    started_at: string
    completed_at: string | null
    duration_seconds: number | null
    quarter: string | null
    week_number: number | null
    work_context: string | null
    prompt_phase_1: string | null
    response_phase_1: string | null
    prompt_phase_2: string | null
    response_phase_2: string | null
    prompt_phase_3: string | null
    response_phase_3: string | null
    synthesis_text: string | null
    suggested_insight: string | null
    student_work: {
      title: string
      course_name: string | null
      course_code: string | null
    } | null
    conversation_skill_tag: Array<{
      skill_id: string
      confidence: number
      student_confirmed: boolean
      rationale: string | null
    }> | null
  }

  const { data: convRowRaw, error: convErr } = await admin
    .from('growth_conversation')
    .select(
      'id, student_id, work_id, status, conversation_type, started_at, completed_at, ' +
        'duration_seconds, quarter, week_number, work_context, ' +
        'prompt_phase_1, response_phase_1, prompt_phase_2, response_phase_2, ' +
        'prompt_phase_3, response_phase_3, synthesis_text, suggested_insight, ' +
        'student_work(title, course_name, course_code), ' +
        'conversation_skill_tag(skill_id, confidence, student_confirmed, rationale)'
    )
    .eq('id', params.id)
    .maybeSingle()

  if (convErr) {
    return NextResponse.json(
      { error: `Lookup failed: ${convErr.message}` },
      { status: 500 }
    )
  }
  if (!convRowRaw) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const convRow = convRowRaw as unknown as ConvRow

  // Authorization:
  //   - Student persona/auth: must own the conversation.
  //   - Coach persona/auth: must be assigned to the conversation's
  //     student (real coaches) or the student must be a demo persona
  //     (demo coaches see the whole demo cohort).
  let authorized = false
  if (identity.role === 'student') {
    authorized = identity.id === convRow.student_id
  } else {
    if (identity.isDemo) {
      // Demo coach: any demo student is fair game
      const { data: s } = await admin
        .from('student')
        .select('is_demo')
        .eq('id', convRow.student_id)
        .maybeSingle()
      authorized = !!s?.is_demo
    } else {
      // Real coach: assigned to that student
      const { data: s } = await admin
        .from('student')
        .select('coach_id')
        .eq('id', convRow.student_id)
        .maybeSingle()
      authorized = s?.coach_id === identity.id
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Expose is_demo on the response so ConversationView can route
  // completed conversations to ConversationFullView for real students
  // and to ConversationReplay (typewriter) for demo personas. Mirrors
  // the small lookup already used in the demo-coach auth branch above.
  let studentIsDemo = false
  {
    const { data: s } = await admin
      .from('student')
      .select('is_demo')
      .eq('id', convRow.student_id)
      .maybeSingle()
    studentIsDemo = !!s?.is_demo
  }

  const tagRows = convRow.conversation_skill_tag ?? []

  const skillIds = Array.from(new Set(tagRows.map(t => t.skill_id)))
  let skillNameById = new Map<string, string>()
  if (skillIds.length > 0) {
    const { data: skillRowsRaw } = await admin
      .from('durable_skill')
      .select('id, name')
      .in('id', skillIds)
    const skillRows = (skillRowsRaw ?? []) as unknown as Array<{
      id: string
      name: string
    }>
    skillNameById = new Map(skillRows.map(s => [s.id, s.name]))
  }

  const work = convRow.student_work

  return NextResponse.json({
    id: convRow.id,
    studentId: convRow.student_id,
    workId: convRow.work_id,
    status: convRow.status,
    conversationType: convRow.conversation_type,
    isDemo: studentIsDemo,
    startedAt: convRow.started_at,
    completedAt: convRow.completed_at,
    durationSeconds: convRow.duration_seconds,
    quarter: convRow.quarter,
    weekNumber: convRow.week_number,
    workContext: convRow.work_context,
    workTitle: work?.title ?? null,
    courseName: work?.course_name ?? null,
    courseCode: work?.course_code ?? null,
    promptPhase1: convRow.prompt_phase_1,
    responsePhase1: convRow.response_phase_1,
    promptPhase2: convRow.prompt_phase_2,
    responsePhase2: convRow.response_phase_2,
    promptPhase3: convRow.prompt_phase_3,
    responsePhase3: convRow.response_phase_3,
    synthesisText: convRow.synthesis_text,
    suggestedInsight: convRow.suggested_insight,
    skillTags: tagRows.map(t => ({
      skillId: t.skill_id,
      skillName: skillNameById.get(t.skill_id) ?? null,
      confidence: t.confidence,
      studentConfirmed: t.student_confirmed,
      rationale: t.rationale,
    })),
  })
}

// Authorization is now inline above using getV2Identity (which already
// gives us the resolved student/coach id and isDemo flag) — the old
// auth_user_id-keyed helpers are unnecessary.
