import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getV2StudentId } from '@/lib/v2-auth'
import { generatePhase1Question } from '@/lib/conversation-engine-live'
import { determineTargetSkill, buildSkillLevelMap, type ConversationContext } from '@/lib/llm-prompts'
import { log } from '@/lib/observability/logger'
import type { StudentWork, SkillAssessment, GrowthConversation, Student } from '@/lib/types'

export async function POST(request: Request) {
  // One request_id at the edge so every event correlates.
  const reqLog = log.withRequest()
  let studentId: string | undefined

  try {
    const resolvedStudentId = await getV2StudentId()
    if (!resolvedStudentId) {
      await reqLog.warn('conversation.start_failed', {
        actorType: 'anonymous',
        message: 'Unauthenticated attempt to start conversation',
      })
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { workId } = await request.json()
    if (!workId) {
      await reqLog.warn('conversation.start_failed', {
        message: 'workId missing from request body',
      })
      return NextResponse.json({ error: 'workId is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: student, error: studentError } = await admin
      .from('student')
      .select('*')
      .eq('id', resolvedStudentId)
      .single()

    if (studentError || !student) {
      await reqLog.error('conversation.start_failed', {
        studentId: resolvedStudentId,
        message: 'Resolved identity has no student record',
        context: { workId, error: studentError?.message },
      })
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 })
    }

    studentId = student.id as string

    // Existing in-progress conversation handling. A conversation with
    // no phase-1 response yet was never actually started (the student
    // opened a reflection and backed out); it is auto-abandoned below
    // so it can't trap every later assignment click in a stale shell.
    // Only a conversation with real progress (a phase-1 response) is
    // resumed. Full resume-or-discard UX is the planned reflect redesign.
    const { data: existing } = await admin
      .from('growth_conversation')
      .select('*')
      .eq('student_id', student.id)
      .eq('status', 'in_progress')
      .limit(1)

    if (existing && existing.length > 0 && existing[0].response_phase_1) {
      const conv = existing[0]
      let currentPhase = 1
      if (conv.response_phase_1 && conv.prompt_phase_2) currentPhase = 2
      if (conv.response_phase_2 && conv.prompt_phase_3) currentPhase = 3

      await reqLog.info('conversation.resumed', {
        studentId,
        actorType: 'student',
        actorId: studentId,
        message: `Resumed in-progress conversation at phase ${currentPhase}`,
        context: {
          conversation_id: conv.id,
          work_id: conv.work_id,
          current_phase: currentPhase,
        },
      })

      return NextResponse.json({
        conversationId: conv.id,
        resuming: true,
        currentPhase,
        workContext: conv.work_context,
        conversationType: conv.conversation_type || 'work_based',
        prompts: {
          phase1: conv.prompt_phase_1,
          phase2: conv.prompt_phase_2,
          phase3: conv.prompt_phase_3,
        },
        responses: {
          phase1: conv.response_phase_1,
          phase2: conv.response_phase_2,
          phase3: conv.response_phase_3,
        },
      })
    }

    // Unstarted in-progress shell (no phase-1 response): abandon it so
    // it stops hijacking navigation, then fall through to create a fresh
    // conversation for the work the student actually clicked.
    if (existing && existing.length > 0) {
      await admin
        .from('growth_conversation')
        .update({ status: 'abandoned' })
        .eq('id', existing[0].id)
      await reqLog.info('conversation.abandoned_empty', {
        studentId,
        actorType: 'student',
        actorId: studentId,
        message: 'Auto-abandoned an unstarted in-progress conversation (no phase-1 response)',
        context: {
          conversation_id: existing[0].id,
          work_id: existing[0].work_id,
        },
      })
    }

    const { data: work, error: workError } = await admin
      .from('student_work')
      .select('*')
      .eq('id', workId)
      .single()

    if (workError || !work) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }
    if (work.student_id !== student.id) {
      return NextResponse.json({ error: 'Not your work item' }, { status: 403 })
    }

    const [prevConvosResult, definitionsResult, assessmentsResult] = await Promise.all([
      admin
        .from('growth_conversation')
        .select('*, student_work(*)')
        .eq('student_id', student.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(10),
      admin
        .from('student_skill_definition')
        .select('*')
        .eq('student_id', student.id)
        .eq('is_current', true),
      admin
        .from('skill_assessment')
        .select('*')
        .eq('student_id', student.id)
        .eq('assessor_type', 'coach')
        .order('assessed_at', { ascending: false }),
    ])

    const previousConversations = (prevConvosResult.data || []).map((c: Record<string, unknown>) => ({
      ...snakeToCamel(c) as unknown as GrowthConversation,
      work: c.student_work ? snakeToCamel(c.student_work as Record<string, unknown>) as unknown as StudentWork : null,
    }))

    const assessments = (assessmentsResult.data || []).map(
      (a: Record<string, unknown>) => snakeToCamel(a) as unknown as SkillAssessment
    )

    const targetSkillId = determineTargetSkill(
      snakeToCamel(work) as unknown as StudentWork,
      assessments
    )
    const skillLevels = buildSkillLevelMap(assessments)

    const context = {
      student: snakeToCamel(student) as unknown as Student,
      work: snakeToCamel(work) as unknown as StudentWork,
      conversation: {},
      previousConversations,
      currentDefinitions: (definitionsResult.data || []).map(
        (d: Record<string, unknown>) => snakeToCamel(d)
      ) as unknown as ConversationContext['currentDefinitions'],
      skillLevels,
      targetSkillId,
      targetSkillLevel: skillLevels.get(targetSkillId) || 'external' as const,
      quarter: getCurrentQuarter(),
    }

    const phase1Question = await generatePhase1Question(context)

    const { data: conversation, error: createError } = await admin
      .from('growth_conversation')
      .insert({
        student_id: student.id,
        work_id: workId,
        quarter: getCurrentQuarter(),
        week_number: getCurrentWeek(),
        status: 'in_progress',
        work_context: `${work.title} - ${work.description || work.work_type}`,
        prompt_phase_1: phase1Question,
      })
      .select()
      .single()

    if (createError || !conversation) {
      await reqLog.error('conversation.start_failed', {
        studentId,
        message: 'growth_conversation insert failed',
        context: { work_id: workId, db_error: createError?.message },
      })
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    await reqLog.info('conversation.started', {
      studentId,
      actorType: 'student',
      actorId: studentId,
      message: `New conversation started for work ${work.title}`,
      context: {
        conversation_id: conversation.id,
        work_id: workId,
        work_title: work.title,
        target_skill_id: targetSkillId,
        target_skill_level: skillLevels.get(targetSkillId) || 'external',
      },
    })

    return NextResponse.json({
      conversationId: conversation.id,
      firstPrompt: phase1Question,
      workContext: conversation.work_context,
    })
  } catch (error) {
    await reqLog.error('conversation.start_failed', {
      studentId,
      message: 'Unexpected exception in conversation start',
      context: {
        error_message: String(error),
        error_stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
      },
    })
    return NextResponse.json(
      { error: 'Failed to start conversation. Please try again.' },
      { status: 500 }
    )
  }
}

function getCurrentQuarter(): string {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  if (month < 3) return `Winter ${year}`
  if (month < 6) return `Spring ${year}`
  if (month < 9) return `Summer ${year}`
  return `Fall ${year}`
}

function getCurrentWeek(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - start.getTime()
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
}

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = value
  }
  return result
}
