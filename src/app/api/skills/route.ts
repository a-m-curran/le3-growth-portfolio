import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/skills
 *
 * Returns the active skills framework — name + pillar — for any
 * caller that needs to resolve skill ids to names without the
 * full schema. The taxonomy (pillars + durable_skills) is
 * pre-seeded in the DB and is the same across demo and real
 * students, so there's no demo branch.
 *
 * Response shape:
 *   { skills: [{ id, name, pillarName }] }
 */
export async function GET() {
  try {
    const admin = createAdminClient()
    const { data: skills } = await admin
      .from('durable_skill')
      .select('id, name, pillar:pillar_id(name)')
      .eq('is_active', true)
      .order('display_order')

    const formatted = (skills || []).map((s: Record<string, unknown>) => ({
      id: s.id,
      name: s.name,
      pillarName: (s.pillar as Record<string, unknown>)?.name || 'Unknown',
    }))

    return NextResponse.json({ skills: formatted })
  } catch (error) {
    console.error('Error fetching skills:', error)
    return NextResponse.json({ skills: [] })
  }
}
