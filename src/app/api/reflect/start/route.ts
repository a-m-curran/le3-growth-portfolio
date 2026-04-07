import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getClient } from '@/lib/llm-client'
import { PHASE_1_SYSTEM_PROMPT } from '@/lib/llm-prompts'
import { buildSkillLevelMap } from '@/lib/llm-prompts'
import type { SkillAssessment, SdtLevel } from '@/lib/types'

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

/**
 * POST /api/reflect/start
 *
 * Open-ended reflection — no skill selection required.
 * The student just describes what happened. The system picks the
 * most relevant skill heuristically, but doesn't tell the student.
 */
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

    const { description } = await request.json()
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
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

    // Get previous conversations for context
    const { data: prevConvos } = await admin
      .from('growth_conversation')
      .select('*')
      .eq('student_id', studentRow.id)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(5)

    // Get assessments for skill level context
    const { data: assessmentRows } = await admin
      .from('skill_assessment')
      .select('*')
      .eq('student_id', studentRow.id)
      .eq('assessor_type', 'coach')
      .order('assessed_at', { ascending: false })

    const assessments = (assessmentRows || []).map(
      (a: Record<string, unknown>) => snakeToCamel(a) as unknown as SkillAssessment
    )
    const skillLevels = buildSkillLevelMap(assessments)

    // Build a minimal context for the Phase 1 question
    // No skill targeting — let the conversation go where it goes
    const lowestLevel = skillLevels.size > 0
      ? Array.from(skillLevels.entries()).sort(([,a], [,b]) => {
          const order: Record<string, number> = { external: 1, introjected: 2, identified: 3, integrated: 4, intrinsic: 5 }
          return (order[a] || 1) - (order[b] || 1)
        })[0]?.[1] || 'external'
      : 'external'

    const prevContext = (prevConvos || []).slice(0, 3).map((c: Record<string, unknown>) => {
      const insight = c.suggested_insight || ''
      const resp = (c.response_phase_1 as string || '').substring(0, 100)
      return `  - ${c.started_at}: "${insight}" Student said: "${resp}..."`
    }).join('\n')

    const userPrompt = [
      `STUDENT: ${studentRow.first_name} ${studentRow.last_name}`,
      `COHORT: ${studentRow.cohort}`,
      `CURRENT QUARTER: ${getCurrentQuarter()}`,
      '',
      'OPEN REFLECTION (student-initiated, not tied to any assignment):',
      `The student wants to reflect on something. Here\u2019s what they wrote:`,
      `"${description}"`,
      '',
      `STUDENT'S GENERAL SDT LEVEL: ${lowestLevel as SdtLevel}`,
      '(Adjust question complexity accordingly. Do NOT mention any skill names.)',
      '',
      prevContext ? `PREVIOUS CONVERSATIONS:\n${prevContext}` : '',
      '',
      'Generate ONE question for Phase 1 (What Happened).',
      'The student has shared something on their mind. Help them tell the story.',
      'Be warm, curious, and specific to what they described.',
      'Do NOT ask them to categorize, label, or connect it to any framework.',
    ].join('\n').trim()

    const llm = getClient()
    const phase1Question = await llm.generate(PHASE_1_SYSTEM_PROMPT, userPrompt)

    // Create conversation
    const { data: conversation, error: createError } = await admin
      .from('growth_conversation')
      .insert({
        student_id: studentRow.id,
        work_id: null,
        quarter: getCurrentQuarter(),
        week_number: getCurrentWeek(),
        status: 'in_progress',
        conversation_type: 'open_reflection',
        reflection_description: description,
        work_context: `Reflection: ${description.substring(0, 80)}`,
        prompt_phase_1: phase1Question,
      })
      .select()
      .single()

    if (createError || !conversation) {
      console.error('Create reflection error:', createError)
      return NextResponse.json({ error: 'Failed to start reflection' }, { status: 500 })
    }

    return NextResponse.json({
      conversationId: conversation.id,
      firstPrompt: phase1Question,
      workContext: conversation.work_context,
    })
  } catch (error) {
    console.error('Reflect start error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
