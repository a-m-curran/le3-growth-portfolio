import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { generateReflectionPhase1Question } from '@/lib/conversation-engine-live'
import { buildSkillLevelMap, type ConversationContext } from '@/lib/llm-prompts'
import type { Student, SkillAssessment, GrowthConversation, StudentWork, SdtLevel } from '@/lib/types'

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = value
  }
  return result
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
  return Math.ceil((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
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

    const { description, skillId } = await request.json()

    if (!description || !skillId) {
      return NextResponse.json({ error: 'Description and skill are required' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: studentRow } = await admin
      .from('student')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (!studentRow) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const student = snakeToCamel(studentRow) as unknown as Student

    // Get the skill name for the prompt
    const { data: skillRow } = await admin
      .from('durable_skill')
      .select('name')
      .eq('id', skillId)
      .single()

    const skillName = skillRow?.name || 'this skill'

    // Fetch context
    const [prevConvosResult, definitionsResult, assessmentsResult] = await Promise.all([
      admin.from('growth_conversation')
        .select('*')
        .eq('student_id', student.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(10),
      admin.from('student_skill_definition')
        .select('*')
        .eq('student_id', student.id)
        .eq('is_current', true),
      admin.from('skill_assessment')
        .select('*')
        .eq('student_id', student.id)
        .eq('assessor_type', 'coach')
        .order('assessed_at', { ascending: false }),
    ])

    const assessments = (assessmentsResult.data || []).map(
      (a: Record<string, unknown>) => snakeToCamel(a) as unknown as SkillAssessment
    )
    const skillLevels = buildSkillLevelMap(assessments)

    const context: ConversationContext = {
      student,
      work: { id: '', studentId: student.id, title: 'Open Reflection', workType: 'other', submittedAt: new Date().toISOString(), quarter: getCurrentQuarter() } as StudentWork,
      conversation: {},
      previousConversations: (prevConvosResult.data || []).map(
        (c: Record<string, unknown>) => ({ ...snakeToCamel(c) as unknown as GrowthConversation, work: null })
      ),
      currentDefinitions: (definitionsResult.data || []).map(
        (d: Record<string, unknown>) => snakeToCamel(d)
      ) as unknown as ConversationContext['currentDefinitions'],
      skillLevels,
      targetSkillId: skillId,
      targetSkillLevel: skillLevels.get(skillId) || 'external' as SdtLevel,
      quarter: getCurrentQuarter(),
    }

    // Generate Phase 1 question
    const phase1Question = await generateReflectionPhase1Question(context, description, skillName)

    // Create conversation record
    const { data: conversation, error: createError } = await admin
      .from('growth_conversation')
      .insert({
        student_id: student.id,
        work_id: null,
        quarter: getCurrentQuarter(),
        week_number: getCurrentWeek(),
        status: 'in_progress',
        conversation_type: 'open_reflection',
        reflection_description: description,
        student_tagged_skill_id: skillId,
        work_context: `Open Reflection: ${description.substring(0, 100)}`,
        prompt_phase_1: phase1Question,
      })
      .select()
      .single()

    if (createError || !conversation) {
      console.error('Create reflection error:', createError)
      return NextResponse.json({ error: 'Failed to create reflection' }, { status: 500 })
    }

    return NextResponse.json({
      conversationId: conversation.id,
      firstPrompt: phase1Question,
      workContext: conversation.work_context,
    })
  } catch (error) {
    console.error('Reflection start error:', error)
    return NextResponse.json({ error: 'Failed to start reflection' }, { status: 500 })
  }
}
