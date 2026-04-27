import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  generatePhase2Question,
  generatePhase3Question,
  generateSynthesis,
  suggestSkillTags,
  generateConversationOutput,
} from '@/lib/conversation-engine-live'
import { createAdminClient } from '@/lib/supabase-admin'
import { determineTargetSkill, buildSkillLevelMap } from '@/lib/llm-prompts'
import { log } from '@/lib/observability/logger'
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
  const reqLog = log.withRequest()
  let studentId: string | undefined

  try {
    const supabase = getSupabase()
    const { studentResponse, currentPhase } = await request.json()

    if (!studentResponse || !currentPhase) {
      await reqLog.warn('conversation.advance_failed', {
        message: 'studentResponse or currentPhase missing',
        context: { conversation_id: params.id, current_phase: currentPhase },
      })
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
      await reqLog.warn('conversation.advance_failed', {
        message: 'Conversation not found',
        context: { conversation_id: params.id, db_error: convError?.message },
      })
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    studentId = rawConversation.student_id as string

    if (rawConversation.status !== 'in_progress') {
      await reqLog.warn('conversation.advance_failed', {
        studentId,
        message: 'Attempt to advance non-in-progress conversation',
        context: {
          conversation_id: params.id,
          status: rawConversation.status,
        },
      })
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
      targetSkillLevel: (skillLevels.get(targetSkillId) || 'external') as SdtLevel,
      quarter: rawConversation.quarter,
    }

    if (currentPhase === 1) {
      const phase2Question = await generatePhase2Question(context, studentResponse)

      const { error: updateErr } = await supabase
        .from('growth_conversation')
        .update({
          response_phase_1: studentResponse,
          prompt_phase_2: phase2Question,
        })
        .eq('id', params.id)

      if (updateErr) {
        await reqLog.error('conversation.advance_failed', {
          studentId,
          message: 'DB update failed advancing 1→2',
          context: { conversation_id: params.id, db_error: updateErr.message },
        })
        return NextResponse.json(
          { error: 'Failed to advance conversation' },
          { status: 500 }
        )
      }

      await reqLog.info('conversation.phase_advanced', {
        studentId,
        actorType: 'student',
        message: 'Phase 1 → 2',
        context: {
          conversation_id: params.id,
          from_phase: 1,
          to_phase: 2,
          response_length: studentResponse.length,
        },
      })

      return NextResponse.json({ nextPrompt: phase2Question, nextPhase: 2 })
    }

    if (currentPhase === 2) {
      const phase3Question = await generatePhase3Question(
        context,
        rawConversation.response_phase_1,
        studentResponse
      )

      const { error: updateErr } = await supabase
        .from('growth_conversation')
        .update({
          response_phase_2: studentResponse,
          prompt_phase_3: phase3Question,
        })
        .eq('id', params.id)

      if (updateErr) {
        await reqLog.error('conversation.advance_failed', {
          studentId,
          message: 'DB update failed advancing 2→3',
          context: { conversation_id: params.id, db_error: updateErr.message },
        })
        return NextResponse.json(
          { error: 'Failed to advance conversation' },
          { status: 500 }
        )
      }

      await reqLog.info('conversation.phase_advanced', {
        studentId,
        actorType: 'student',
        message: 'Phase 2 → 3',
        context: {
          conversation_id: params.id,
          from_phase: 2,
          to_phase: 3,
          response_length: studentResponse.length,
        },
      })

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

      const { error: completeErr } = await supabase
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

      if (completeErr) {
        await reqLog.error('conversation.advance_failed', {
          studentId,
          message: 'DB update failed completing conversation',
          context: { conversation_id: params.id, db_error: completeErr.message },
        })
        return NextResponse.json(
          { error: 'Failed to complete conversation' },
          { status: 500 }
        )
      }

      // Insert skill tags
      if (skillTags.length > 0) {
        const { error: tagErr } = await supabase
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
        if (tagErr) {
          await reqLog.warn('conversation.tag_insert_failed', {
            studentId,
            message: 'Skill tags failed to insert (conversation still completed)',
            context: { conversation_id: params.id, db_error: tagErr.message },
          })
        }
      }

      await reqLog.info('conversation.completed', {
        studentId,
        actorType: 'student',
        message: `Conversation completed in ${durationSeconds}s`,
        durationMs: durationSeconds * 1000,
        context: {
          conversation_id: params.id,
          duration_seconds: durationSeconds,
          skill_tag_count: skillTags.length,
          synthesis_length: synthesis.synthesisText.length,
        },
      })

      // Generate structured output for C2A (fire-and-forget, don't block response).
      // Logs success/failure into event_log so silent failures don't go invisible.
      const admin = createAdminClient()
      generateConversationOutput(
        {
          promptPhase1: rawConversation.prompt_phase_1,
          responsePhase1: rawConversation.response_phase_1,
          promptPhase2: rawConversation.prompt_phase_2,
          responsePhase2: rawConversation.response_phase_2,
          promptPhase3: rawConversation.prompt_phase_3,
          responsePhase3: studentResponse,
          synthesisText: synthesis.synthesisText,
        },
        skillTags,
        {}, // rubric descriptors — TODO: fetch from DB
        (prevConvosResult.data || []).map((c: Record<string, unknown>) => ({
          synthesisText: c.synthesis_text as string,
          suggestedInsight: c.suggested_insight as string,
        }))
      ).then(async (output) => {
        const { error: outputErr } = await admin.from('conversation_output').insert({
          conversation_id: params.id,
          evidence_strength: output.evidenceStrength,
          evidence_rationale: output.evidenceRationale,
          behavioral_indicators: output.behavioralIndicators,
          sdt_level_signals: output.sdtLevelSignals,
          growth_trajectory: output.growthTrajectory,
          trajectory_rationale: output.trajectoryRationale,
          key_moments: output.keyMoments,
          voice_markers: output.voiceMarkers,
        })
        if (outputErr) {
          await log.error('conversation.output_insert_failed', {
            studentId,
            message: 'conversation_output insert failed',
            context: { conversation_id: params.id, db_error: outputErr.message },
          })
        } else {
          await log.info('conversation.output_generated', {
            studentId,
            message: 'C2A structured output stored',
            context: {
              conversation_id: params.id,
              evidence_strength: output.evidenceStrength,
              growth_trajectory: output.growthTrajectory,
            },
          })
        }
      }).catch(err => {
        log.error('conversation.output_generation_failed', {
          studentId,
          message: `generateConversationOutput threw: ${String(err).slice(0, 200)}`,
          context: {
            conversation_id: params.id,
            error_message: String(err),
            error_stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
          },
        })
      })

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

    await reqLog.warn('conversation.advance_failed', {
      studentId,
      message: 'Invalid phase number',
      context: { conversation_id: params.id, current_phase: currentPhase },
    })
    return NextResponse.json({ error: 'Invalid phase' }, { status: 400 })
  } catch (error) {
    await reqLog.error('conversation.advance_failed', {
      studentId,
      message: 'Unexpected exception advancing conversation',
      context: {
        conversation_id: params.id,
        error_message: String(error),
        error_stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
      },
    })
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
