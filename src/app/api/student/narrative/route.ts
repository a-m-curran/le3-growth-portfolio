import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/narrative
 *
 * Powers /v2/narrative. Returns a per-skill list with the latest
 * narrative (when generated) + the conversations tagged with that
 * skill (so the bottom "Built from N conversations" disclosure can
 * render without a second fetch).
 *
 * Demo personas are real DB rows. Student id resolved via
 * `getV2StudentId` (persona cookie OR real auth).
 */
export async function GET() {
  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Pull the full skill catalog joined to pillar so we can render
  // every active skill (even those without a narrative yet) and
  // group them by pillar in the v2 UI.
  const { data: skillRows } = await admin
    .from('durable_skill')
    .select('id, name, pillar_id, is_active, pillar:pillar_id(id, name)')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  interface SkillRow {
    id: string
    name: string
    pillar_id: string
    is_active: boolean
    pillar: { id: string; name: string } | null
  }
  const activeSkills = (skillRows ?? []) as unknown as SkillRow[]

  // Pull all narrative rows for this student, latest version first.
  const { data: narrativeRows } = await admin
    .from('skill_narrative')
    .select('skill_id, narrative_text, narrative_richness, version, generated_at, narrative_annotations')
    .eq('student_id', studentId)
    .order('version', { ascending: false })

  interface NarrativeRow {
    skill_id: string
    narrative_text: string | null
    narrative_richness: string | null
    version: number | null
    generated_at: string | null
    narrative_annotations: Array<{ sentence: string; conversationId: string }> | null
  }
  const latestBySkill = new Map<string, NarrativeRow>()
  for (const r of (narrativeRows ?? []) as unknown as NarrativeRow[]) {
    if (!latestBySkill.has(r.skill_id)) latestBySkill.set(r.skill_id, r)
  }

  // Pull all conversation→skill tags for this student in one query
  // and group by skill_id, so each narrative can carry its source list.
  const { data: tagRows } = await admin
    .from('conversation_skill_tag')
    .select(
      'skill_id, growth_conversation!inner(id, started_at, student_id, student_work(title))'
    )
    .eq('growth_conversation.student_id', studentId)

  interface TagRow {
    skill_id: string
    growth_conversation: {
      id: string
      started_at: string
      student_id: string
      student_work: { title: string } | null
    }
  }
  const sourcesBySkill = new Map<
    string,
    Array<{ id: string; workTitle: string; date: string }>
  >()
  for (const t of (tagRows ?? []) as unknown as TagRow[]) {
    if (!t.growth_conversation) continue
    const entry = {
      id: t.growth_conversation.id,
      workTitle: t.growth_conversation.student_work?.title ?? 'Reflection',
      date: t.growth_conversation.started_at,
    }
    const arr = sourcesBySkill.get(t.skill_id) ?? []
    if (!arr.some(e => e.id === entry.id)) arr.push(entry)
    sourcesBySkill.set(t.skill_id, arr)
  }
  sourcesBySkill.forEach(arr => {
    arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  })

  const narratives = activeSkills.map(skill => {
    const row = latestBySkill.get(skill.id)
    return {
      skillId: skill.id,
      skillName: skill.name,
      pillarId: skill.pillar_id,
      pillarName: skill.pillar?.name ?? null,
      narrativeText: row?.narrative_text ?? null,
      narrativeRichness: row?.narrative_richness ?? null,
      version: row?.version ?? 0,
      generatedAt: row?.generated_at ?? null,
      annotations: row?.narrative_annotations ?? [],
      sources: sourcesBySkill.get(skill.id) ?? [],
    }
  })

  return NextResponse.json({ narratives })
}
