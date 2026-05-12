import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  getConversation as getStaticConversation,
  getStudentWork as getStaticWork,
  getSkill as getStaticSkill,
} from '@/data'

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
 * In demo mode (NEXT_PUBLIC_DEMO_MODE=true) returns the static seed
 * from src/data/conversations.ts so demo flows work without a DB.
 * In normal mode queries growth_conversation via Supabase admin client.
 *
 * Authorization (DB mode only): only the student who owns the
 * conversation, or a coach who is assigned to that student, can read.
 * Demo mode is unauthenticated since the seed data is non-sensitive.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  // ─── Demo mode short-circuit ─────────────────
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const conv = getStaticConversation(params.id)
    if (!conv) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }
    const work = conv.workId ? getStaticWork(conv.workId) : null
    return NextResponse.json({
      id: conv.id,
      studentId: conv.studentId,
      workId: conv.workId,
      status: conv.status,
      startedAt: conv.startedAt,
      completedAt: conv.completedAt ?? null,
      durationSeconds: conv.durationSeconds ?? null,
      quarter: conv.quarter,
      weekNumber: conv.weekNumber ?? null,
      workContext: conv.workContext,
      workTitle: work?.title ?? null,
      courseName: work?.courseName ?? null,
      courseCode: work?.courseCode ?? null,
      promptPhase1: conv.promptPhase1 ?? null,
      responsePhase1: conv.responsePhase1 ?? null,
      promptPhase2: conv.promptPhase2 ?? null,
      responsePhase2: conv.responsePhase2 ?? null,
      promptPhase3: conv.promptPhase3 ?? null,
      responsePhase3: conv.responsePhase3 ?? null,
      synthesisText: conv.synthesisText ?? null,
      suggestedInsight: conv.suggestedInsight ?? null,
      skillTags: (conv.skillTags ?? []).map(t => {
        const skill = getStaticSkill(t.skillId)
        return {
          skillId: t.skillId,
          skillName: skill?.name ?? null,
          confidence: t.confidence,
          studentConfirmed: t.studentConfirmed,
          rationale: t.rationale ?? null,
        }
      }),
    })
  }

  // ─── DB-backed flow (production) ─────────────
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

  // Fetch the conversation with its work + skill tag joins.
  // Supabase's typed client doesn't infer the join shape well here, so
  // we cast through unknown to a hand-written shape that matches the
  // selected columns + relations.
  interface ConvRow {
    id: string
    student_id: string
    work_id: string | null
    status: string
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
      'id, student_id, work_id, status, started_at, completed_at, ' +
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

  // Authorization: student owns it, OR coach is assigned to that student
  const isOwner = await isStudentOwner(admin, user.id, convRow.student_id)
  const isAssignedCoach = isOwner
    ? false
    : await isCoachAssigned(admin, user.id, convRow.student_id)

  if (!isOwner && !isAssignedCoach) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

// ─── Authorization helpers ──────────────────────────

async function isStudentOwner(
  admin: ReturnType<typeof createAdminClient>,
  authUserId: string,
  studentId: string
): Promise<boolean> {
  const { data } = await admin
    .from('student')
    .select('id')
    .eq('auth_user_id', authUserId)
    .eq('id', studentId)
    .maybeSingle()
  return !!data
}

async function isCoachAssigned(
  admin: ReturnType<typeof createAdminClient>,
  authUserId: string,
  studentId: string
): Promise<boolean> {
  // Find the coach record for the authenticated user (if any).
  const { data: coach } = await admin
    .from('coach')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (!coach) return false

  // Is the student assigned to this coach?
  const { data: student } = await admin
    .from('student')
    .select('id')
    .eq('id', studentId)
    .eq('coach_id', coach.id)
    .maybeSingle()
  return !!student
}
