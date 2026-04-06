import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  generatePhase2Question,
  generatePhase3Question,
  generateSynthesis,
  suggestSkillTags,
} from '@/lib/conversation-engine-live'
import { determineTargetSkill, buildSkillLevelMap } from '@/lib/llm-prompts'
import type { ConversationContext } from '@/lib/llm-prompts'
import type { Student, StudentWork, GrowthConversation, SkillAssessment, SdtLevel } from '@/lib/types'

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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()
    const { studentResponse, currentPhase } = await request.json()

    if (!studentResponse || !currentPhase) {
      return NextResponse.json(
        { error: 'studentResponse and currentPhase are required' },
        { status: 400 }
      )
    }

    // Fetch conversation with related data
    const { data: rawConversation, error: convError } = await supabase
      .from('growth_conversation')
      .select('*, student(*), student_work(*)')
      .eq('id', params.id)
      .single()

    if (convError || !rawConversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    if (rawConversation.status !== 'in_progress') {
      return NextResponse.json({ error: 'Conversation is not in progress' }, { status: 400 })
    }

    const student = snakeToCamel(rawConversation.student) as unknown as Student
    const work = rawConversation.student_work
      ? snakeToCamel(rawConversation.student_work) as unknown as StudentWork
      : null

    // Fetch context for pattern detection
    const [prevConvosResult, definitionsResult, assessmentsResult] = await Promise.all([
      supabase
        .from('growth_conversation')
        .select('*, conversation_skill_tag(*), student_work(*)')
        .eq('student_id', rawConversation.student_id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(10),
      supabase
        .from('student_skill_definition')
        .select('*')
        .eq('student_id', rawConversation.student_id)
        .eq('is_current', true),
      supabase
        .from('skill_assessment')
        .select('*')
        .eq('student_id', rawConversation.student_id)
        .eq('assessor_type', 'coach')
        .order('assessed_at', { ascending: false }),
    ])

    const assessments = (assessmentsResult.data || []).map(
      (a: Record<string, unknown>) => snakeToCamel(a) as unknown as SkillAssessment
    )
    const skillLevels = buildSkillLevelMap(assessments)
    const targetSkillId = work
      ? determineTargetSkill(work, assessments)
      : 'skill_resilience'

    const previousConversations = (prevConvosResult.data || []).map(
      (c: Record<string, unknown>) => ({
        ...snakeToCamel(c) as unknown as GrowthConversation,
        work: c.student_work
          ? snakeToCamel(c.student_work as Record<string, unknown>) as unknown as StudentWork
          : null,
      })
    )

    const conversation = snakeToCamel(rawConversation) as unknown as GrowthConversation

    const context: ConversationContext = {
      student,
      work: work || { id: '', studentId: '', title: 'Unknown', workType: 'other', submittedAt: '', quarter: '' } as StudentWork,
      conversation,
      previousConversations,
      currentDefinitions: (definitionsResult.data || []).map(
        (d: Record<string, unknown>) => snakeToCamel(d) as unknown
      ) as ConversationContext['currentDefinitions'],
      skillLevels,
      targetSkillId,
      targetSkillLevel: (skillLevels.get(targetSkillId) || 'noticing') as SdtLevel,
      quarter: rawConversation.quarter,
    }

    if (currentPhase === 1) {
      const phase2Question = await generatePhase2Question(context, studentResponse)

      await supabase
        .from('growth_conversation')
        .update({
          response_phase_1: studentResponse,
          prompt_phase_2: phase2Question,
        })
        .eq('id', params.id)

      return NextResponse.json({ nextPrompt: phase2Question, nextPhase: 2 })
    }

    if (currentPhase === 2) {
      const phase3Question = await generatePhase3Question(
        context,
        rawConversation.response_phase_1,
        studentResponse
      )

      await supabase
        .from('growth_conversation')
        .update({
          response_phase_2: studentResponse,
          prompt_phase_3: phase3Question,
        })
        .eq('id', params.id)

      return NextResponse.json({ nextPrompt: phase3Question, nextPhase: 3 })
    }

    if (currentPhase === 3) {
      const phases = {
        p1: rawConversation.response_phase_1 || '',
        p2: rawConversation.response_phase_2 || '',
        p3: studentResponse,
      }

      const [synthesis, skillTags] = await Promise.all([
        generateSynthesis(context, phases),
        suggestSkillTags(context, phases, ''),
      ])

      // Update conversation as completed
      const startedAt = new Date(rawConversation.started_at).getTime()
      const durationSeconds = Math.round((Date.now() - startedAt) / 1000)

      await supabase
        .from('growth_conversation')
        .update({
          response_phase_3: studentResponse,
          synthesis_text: synthesis.synthesisText,
          suggested_insight: synthesis.suggestedInsight,
          status: 'completed',
          completed_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq('id', params.id)

      // Insert skill tags
      if (skillTags.length > 0) {
        await supabase
          .from('conversation_skill_tag')
          .insert(
            skillTags.map(tag => ({
              conversation_id: params.id,
              skill_id: tag.skillId,
              confidence: tag.confidence,
              rationale: tag.rationale,
              student_confirmed: false,
            }))
          )
      }

      return NextResponse.json({
        synthesis: synthesis.synthesisText,
        insight: synthesis.suggestedInsight,
        skillTags: skillTags.map(t => ({
          skillId: t.skillId,
          confidence: t.confidence,
          studentConfirmed: false,
          rationale: t.rationale,
        })),
        nextPhase: 'synthesis',
      })
    }

    return NextResponse.json({ error: 'Invalid phase' }, { status: 400 })
  } catch (error) {
    console.error('Error advancing conversation:', error)
    return NextResponse.json(
      { error: 'Failed to generate next question. Please try again.' },
      { status: 500 }
    )
  }
}

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
    result[camelKey] = value
  }
  return result
}
