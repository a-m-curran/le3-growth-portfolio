import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { generateSkillNarrative } from '@/lib/conversation-engine-live'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NarrativeContext } from '@/lib/llm-prompts'

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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { skillId } = await request.json()
    if (!skillId) {
      return NextResponse.json({ error: 'skillId is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get student
    const { data: studentRow } = await admin
      .from('student')
      .select('*')
      .eq('auth_user_id', user.id)
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
      // Conversations tagged with this skill
      admin.from('growth_conversation')
        .select('*, conversation_skill_tag!inner(skill_id)')
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

    const conversations = (convoResult.data || []).map((c: Record<string, unknown>) => ({
      date: c.started_at as string,
      workTitle: (c.work_context as string) || 'Reflection',
      synthesisText: (c.synthesis_text as string) || '',
      suggestedInsight: (c.suggested_insight as string) || '',
      keyMoments: [] as { phase: number; quote: string; significance: string }[],
    }))

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

    // Save narrative
    const { data: narrative, error: insertError } = await admin
      .from('skill_narrative')
      .insert({
        student_id: studentRow.id,
        skill_id: skillId,
        version: nextVersion,
        narrative_text: result.narrativeText,
        narrative_richness: result.richness,
        data_sources_used: {
          conversationCount: conversations.length,
          assignmentCount: 0,
          hasC2aData: outputs.length > 0,
          hasDefinitions: (defResult.data || []).length > 0,
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
    })
  } catch (error) {
    console.error('Narrative generation error:', error)
    return NextResponse.json({ error: 'Failed to generate narrative' }, { status: 500 })
  }
}
