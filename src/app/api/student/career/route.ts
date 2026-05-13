import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/career
 *
 * Powers /v2/career. Returns the latest career_output for the
 * current student — a professional summary plus per-skill resume
 * language + interview talking points. Each skill description is
 * enriched with:
 *   - pillarName: drives the v2 card tint
 *   - annotations: sentence → conversation_id mapping carried over
 *     from the career_output.skill_descriptions JSONB so the v2 UI
 *     can render inline source links the same way the narrative
 *     view does
 *   - sources: every conversation tagged with this skill, for the
 *     "Built from N conversations" disclosure at the bottom of
 *     each card
 *
 * Returns `{ output: null }` when no career output exists yet so the
 * UI can land on the empty CTA rather than throwing.
 *
 * Demo personas are real DB rows; student id resolved via
 * `getV2StudentId` (persona cookie OR real auth).
 */
export async function GET() {
  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('career_output')
    .select('resume_summary, skill_descriptions, version, generated_at')
    .eq('student_id', studentId)
    .order('version', { ascending: false })
    .limit(1)

  interface CareerRow {
    resume_summary: string
    skill_descriptions: Array<{
      skillId: string
      skillName: string
      resumeLanguage: string
      talkingPoints: string[]
      annotations?: Array<{ sentence: string; conversationId: string }>
    }>
    version: number
    generated_at: string | null
  }
  const row = ((rows ?? []) as unknown as CareerRow[])[0]
  if (!row) {
    return NextResponse.json({ output: null })
  }

  // Look up pillar name per skill id in one query so the per-skill
  // cards can render their pillar tint without a second fetch.
  const skillIds = Array.from(new Set(row.skill_descriptions.map(s => s.skillId)))
  const skillToPillarName = new Map<string, string | null>()
  if (skillIds.length > 0) {
    const { data: skillRows } = await admin
      .from('durable_skill')
      .select('id, pillar:pillar_id(name)')
      .in('id', skillIds)
    interface SkillJoin {
      id: string
      pillar: { name: string } | null
    }
    for (const s of (skillRows ?? []) as unknown as SkillJoin[]) {
      skillToPillarName.set(s.id, s.pillar?.name ?? null)
    }
  }

  // Source list per skill — every conversation tagged with that
  // skill, chronological. Same shape as narrative's sources.
  const sourcesBySkill = new Map<
    string,
    Array<{ id: string; workTitle: string; date: string }>
  >()
  if (skillIds.length > 0) {
    const { data: tagRows } = await admin
      .from('conversation_skill_tag')
      .select(
        'skill_id, growth_conversation!inner(id, started_at, student_id, student_work(title))'
      )
      .eq('growth_conversation.student_id', studentId)
      .in('skill_id', skillIds)

    interface TagRow {
      skill_id: string
      growth_conversation: {
        id: string
        started_at: string
        student_id: string
        student_work: { title: string } | null
      }
    }
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
  }

  return NextResponse.json({
    output: {
      resumeSummary: row.resume_summary,
      skillDescriptions: row.skill_descriptions.map(sd => ({
        skillId: sd.skillId,
        skillName: sd.skillName,
        resumeLanguage: sd.resumeLanguage,
        talkingPoints: sd.talkingPoints,
        pillarName: skillToPillarName.get(sd.skillId) ?? null,
        annotations: sd.annotations ?? [],
        sources: sourcesBySkill.get(sd.skillId) ?? [],
      })),
      version: row.version,
      generatedAt: row.generated_at,
    },
  })
}
