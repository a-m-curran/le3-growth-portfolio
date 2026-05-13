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
 * enriched with pillarName so the v2 UI can tint per-skill cards
 * without a second round-trip.
 *
 * Returns 200 with `output: null` when nothing has been generated
 * yet, so the UI lands on the "Generate Career Output" CTA rather
 * than a hard error.
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

  return NextResponse.json({
    output: {
      resumeSummary: row.resume_summary,
      skillDescriptions: row.skill_descriptions.map(sd => ({
        ...sd,
        pillarName: skillToPillarName.get(sd.skillId) ?? null,
      })),
      version: row.version,
      generatedAt: row.generated_at,
    },
  })
}
