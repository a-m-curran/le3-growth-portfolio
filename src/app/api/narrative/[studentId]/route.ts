import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    const admin = createAdminClient()

    // Get the most recent narrative for each skill
    const { data: narratives, error } = await admin
      .from('skill_narrative')
      .select('*, durable_skill(name, pillar:pillar_id(name))')
      .eq('student_id', params.studentId)
      .order('version', { ascending: false })

    if (error) {
      console.error('Narrative query error:', error)
      return NextResponse.json({ error: 'Failed to fetch narratives' }, { status: 500 })
    }

    // Deduplicate to latest version per skill
    const latest = new Map<string, Record<string, unknown>>()
    for (const n of (narratives || [])) {
      if (!latest.has(n.skill_id)) {
        latest.set(n.skill_id, n)
      }
    }

    const result = Array.from(latest.values()).map(n => ({
      id: n.id,
      skillId: n.skill_id,
      skillName: (n.durable_skill as Record<string, unknown>)?.name || '',
      pillarName: ((n.durable_skill as Record<string, unknown>)?.pillar as Record<string, unknown>)?.name || '',
      version: n.version,
      narrativeText: n.narrative_text,
      narrativeRichness: n.narrative_richness,
      dataSourcesUsed: n.data_sources_used,
      generatedAt: n.generated_at,
    }))

    return NextResponse.json({ narratives: result })
  } catch (error) {
    console.error('Narrative endpoint error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
