import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { generatePhase1Question } from '@/lib/conversation-engine-live'
import { determineTargetSkill, buildSkillLevelMap, type ConversationContext } from '@/lib/llm-prompts'
import type { StudentWork, SkillAssessment, GrowthConversation, Student } from '@/lib/types'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const { workId } = await request.json()

    if (!workId) {
      return NextResponse.json({ error: 'workId is required' }, { status: 400 })
    }

    // Get current user's student record
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: student, error: studentError } = await supabase
      .from('student')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 })
    }

    // Check for existing in-progress conversation
    const { data: existing } = await supabase
      .from('growth_conversation')
      .select('id')
      .eq('student_id', student.id)
      .eq('status', 'in_progress')
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'You already have a conversation in progress', conversationId: existing[0].id },
        { status: 409 }
      )
    }

    // Fetch the selected work
    const { data: work, error: workError } = await supabase
      .from('student_work')
      .select('*')
      .eq('id', workId)
      .single()

    if (workError || !work) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }

    // Fetch context for LLM
    const [prevConvosResult, definitionsResult, assessmentsResult] = await Promise.all([
      supabase
        .from('growth_conversation')
        .select('*, student_work(*)')
        .eq('student_id', student.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(10),
      supabase
        .from('student_skill_definition')
        .select('*')
        .eq('student_id', student.id)
        .eq('is_current', true),
      supabase
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
      targetSkillLevel: skillLevels.get(targetSkillId) || 'noticing' as const,
      quarter: getCurrentQuarter(),
    }

    // Generate Phase 1 question
    const phase1Question = await generatePhase1Question(context)

    // Create conversation record
    const { data: conversation, error: createError } = await supabase
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
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    return NextResponse.json({
      conversationId: conversation.id,
      firstPrompt: phase1Question,
      workContext: conversation.work_context,
    })
  } catch (error) {
    console.error('Error starting conversation:', error)
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

// Convert snake_case DB rows to camelCase for TypeScript types
function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = value
  }
  return result
}
