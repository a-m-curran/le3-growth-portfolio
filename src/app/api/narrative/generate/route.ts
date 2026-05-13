import { createAdminClient } from '@/lib/supabase-admin'
import { generateSkillNarrative } from '@/lib/conversation-engine-live'
import { getV2StudentId } from '@/lib/v2-auth'
import { NextResponse } from 'next/server'
import type { NarrativeContext } from '@/lib/llm-prompts'

export async function POST(request: Request) {
  try {
    // Student id is resolved through the v2 auth shim (persona cookie
    // OR real auth). Demo personas are real DB rows now, so Generate
    // runs the actual LLM against their actual DB conversations —
    // no static-seed short-circuit anywhere.
    const studentId = await getV2StudentId()
    if (!studentId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { skillId } = await request.json()
    if (!skillId) {
      return NextResponse.json({ error: 'skillId is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: studentRow } = await admin
      .from('student')
      .select('*')
      .eq('id', studentId)
      .single()

    if (!studentRow) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Get skill name
    const { data: skillRow } = await admin
      .from('durable_skill')
      .select('name')
      .eq('id', skillId)
      .single()

    if (!skillRow) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    // Gather all data for this skill
    const [convoResult, defResult, assessResult, outputResult] = await Promise.all([
      // Conversations tagged with this skill — joined to student_work so
      // the narrative context can reference the actual assignment title,
      // the instructor's prompt, and the course name
      admin.from('growth_conversation')
        .select('*, conversation_skill_tag!inner(skill_id), student_work(title, description, course_name)')
        .eq('student_id', studentRow.id)
        .eq('status', 'completed')
        .eq('conversation_skill_tag.skill_id', skillId)
        .order('started_at', { ascending: true }),
      // Definitions for this skill
      admin.from('student_skill_definition')
        .select('*')
        .eq('student_id', studentRow.id)
        .eq('skill_id', skillId)
        .order('version', { ascending: true }),
      // Assessments for this skill
      admin.from('skill_assessment')
        .select('*')
        .eq('student_id', studentRow.id)
        .eq('skill_id', skillId)
        .order('assessed_at', { ascending: true }),
      // Conversation outputs (for voice markers and key moments)
      admin.from('conversation_output')
        .select('*, growth_conversation!inner(student_id, conversation_skill_tag!inner(skill_id))')
        .eq('growth_conversation.student_id', studentRow.id)
        .eq('growth_conversation.conversation_skill_tag.skill_id', skillId),
    ])

    const conversations = (convoResult.data || []).map((c: Record<string, unknown>) => {
      const work = c.student_work as Record<string, unknown> | null
      return {
        // The growth_conversation uuid — surfaced to the LLM so it can emit
        // citations that point back at the exact source conversation for
        // every sentence it grounds in a specific moment. The renderer uses
        // this id to wire up inline source-link buttons on the narrative view.
        conversationId: c.id as string,
        date: c.started_at as string,
        // Prefer the actual assignment title from student_work; fall back to
        // the conversation's work_context framing or "Reflection" for
        // open-reflection conversations with no linked work.
        workTitle:
          (work?.title as string) ||
          (c.work_context as string) ||
          'Reflection',
        // Thread the instructor's assignment prompt through to the narrative
        // context so the LLM can write "on the Ethics Paper, which asked you
        // to..." rather than generic references.
        workDescription: (work?.description as string) || undefined,
        courseName: (work?.course_name as string) || undefined,
        synthesisText: (c.synthesis_text as string) || '',
        suggestedInsight: (c.suggested_insight as string) || '',
        keyMoments: [] as { phase: number; quote: string; significance: string }[],
      }
    })

    // Attach key moments from outputs
    const outputs = outputResult.data || []
    for (const output of outputs) {
      const moments = (output.key_moments || []) as { phase: number; quote: string; significance: string }[]
      const convoId = output.conversation_id
      const matchingConvo = (convoResult.data || []).find((c: Record<string, unknown>) => c.id === convoId)
      if (matchingConvo) {
        const idx = (convoResult.data || []).indexOf(matchingConvo)
        if (idx >= 0 && idx < conversations.length) {
          conversations[idx].keyMoments = moments
        }
      }
    }

    // Aggregate voice markers from all outputs
    let voiceMarkers: NarrativeContext['voiceMarkers']
    if (outputs.length > 0) {
      const allMarkers = outputs.map((o: Record<string, unknown>) => o.voice_markers as Record<string, unknown>).filter(Boolean)
      if (allMarkers.length > 0) {
        const latest = allMarkers[allMarkers.length - 1]
        voiceMarkers = {
          sentenceLength: (latest.sentenceLength as string) || 'medium',
          vocabulary: (latest.vocabulary as string) || 'conversational',
          metaphors: (latest.metaphors as string[]) || [],
          repeatPhrases: (latest.repeatPhrases as string[]) || [],
          emotionalRegister: (latest.emotionalRegister as string) || 'neutral',
        }
      }
    }

    const ctx: NarrativeContext = {
      student: { firstName: studentRow.first_name, cohort: studentRow.cohort },
      skillName: skillRow.name,
      definitions: (defResult.data || []).map((d: Record<string, unknown>) => ({
        text: d.definition_text as string,
        version: d.version as number,
        createdAt: d.created_at as string,
      })),
      conversations,
      assessments: (assessResult.data || []).map((a: Record<string, unknown>) => ({
        level: a.sdt_level as string,
        assessorType: a.assessor_type as string,
        date: a.assessed_at as string,
      })),
      voiceMarkers,
    }

    // Generate narrative
    const result = await generateSkillNarrative(ctx)

    // Get current max version for this student+skill
    const { data: existing } = await admin
      .from('skill_narrative')
      .select('version')
      .eq('student_id', studentRow.id)
      .eq('skill_id', skillId)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1

    // Save narrative. The citations the LLM emitted alongside narrativeText
    // are persisted to `narrative_annotations` so the v2 narrative view can
    // render inline source links — same shape the demo personas use, but
    // sourced from the model rather than hand-annotated. Stored as null
    // (not []) when there are zero citations so the column read is
    // unambiguous and the UI's nullish-coalesce works cleanly.
    const annotationsToStore =
      result.citations.length > 0 ? result.citations : null

    const { data: narrative, error: insertError } = await admin
      .from('skill_narrative')
      .insert({
        student_id: studentRow.id,
        skill_id: skillId,
        version: nextVersion,
        narrative_text: result.narrativeText,
        narrative_richness: result.richness,
        narrative_annotations: annotationsToStore,
        data_sources_used: {
          conversationCount: conversations.length,
          assignmentCount: 0,
          hasC2aData: outputs.length > 0,
          hasDefinitions: (defResult.data || []).length > 0,
          citationCount: result.citations.length,
        },
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Narrative insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save narrative' }, { status: 500 })
    }

    return NextResponse.json({
      narrativeId: narrative?.id,
      narrativeText: result.narrativeText,
      richness: result.richness,
      version: nextVersion,
      conversationCount: conversations.length,
      citationCount: result.citations.length,
    })
  } catch (error) {
    console.error('Narrative generation error:', error)
    return NextResponse.json({ error: 'Failed to generate narrative' }, { status: 500 })
  }
}
