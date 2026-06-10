import { createAdminClient } from '@/lib/supabase-admin'
import { generateCareerOutput } from '@/lib/conversation-engine-live'
import { getV2StudentId } from '@/lib/v2-auth'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Student id is resolved through the v2 auth shim, which honors
    // the demo persona cookie OR real Supabase auth. Demo personas
    // are real DB rows now — Generate runs the actual LLM against
    // their actual data, no static-seed short-circuit.
    const studentId = await getV2StudentId()
    if (!studentId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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

    // Get all current narratives
    const { data: narrativeRows } = await admin
      .from('skill_narrative')
      .select('*, durable_skill(name)')
      .eq('student_id', studentRow.id)
      .order('version', { ascending: false })

    // Deduplicate to latest per skill
    const latest = new Map<string, Record<string, unknown>>()
    for (const n of (narrativeRows || [])) {
      if (!latest.has(n.skill_id)) latest.set(n.skill_id, n)
    }

    const narratives = Array.from(latest.values())
      .filter(n => n.narrative_text)
      .map(n => ({
        skillId: n.skill_id as string,
        skillName: ((n.durable_skill as Record<string, unknown>)?.name as string) || '',
        narrativeText: n.narrative_text as string,
        // Pass the per-narrative citations through so the career LLM can
        // carry conversationIds forward onto its resume sentences and
        // talking points. Stored on skill_narrative.narrative_annotations
        // as JSONB by the narrative generator. May be null when the
        // source narrative wasn't grounded — career output handles that.
        citations: (n.narrative_annotations as Array<{
          sentence: string
          conversationId: string
        }> | null) ?? [],
        studentPhrases:
          ((n.data_sources_used as Record<string, unknown> | null)
            ?.voiceFidelity as { groundedPhrases?: string[] } | undefined)
            ?.groundedPhrases ?? [],
      }))

    if (narratives.length === 0) {
      return NextResponse.json({ error: 'No skill narratives found. Generate narratives first.' }, { status: 400 })
    }

    const studentName = `${studentRow.first_name} ${studentRow.last_name}`
    const result = await generateCareerOutput(studentName, narratives)

    // Get next version
    const { data: existing } = await admin
      .from('career_output')
      .select('version')
      .eq('student_id', studentRow.id)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1

    // Save. `result.skillDescriptions` already carries per-skill `annotations`
    // (sentence → conversationId map) inside each entry; the JSONB column
    // takes the whole shape verbatim so the read side at GET /api/student/career
    // can surface inline source links exactly the way demo personas do.
    await admin.from('career_output').insert({
      student_id: studentRow.id,
      version: nextVersion,
      resume_summary: result.resumeSummary,
      skill_descriptions: result.skillDescriptions,
    })

    const annotationTotal = result.skillDescriptions.reduce(
      (acc, sd) => acc + sd.annotations.length,
      0
    )

    return NextResponse.json({
      resumeSummary: result.resumeSummary,
      skillDescriptions: result.skillDescriptions,
      version: nextVersion,
      annotationCount: annotationTotal,
    })
  } catch (error) {
    console.error('Career output error:', error)
    return NextResponse.json({ error: 'Failed to generate' }, { status: 500 })
  }
}
