import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { skills as staticSkills, pillars as staticPillars } from '@/data'

export const dynamic = 'force-dynamic'

/**
 * GET /api/skills
 *
 * Returns the active skills framework. In demo mode
 * (NEXT_PUBLIC_DEMO_MODE=true) returns the static seed from
 * src/data/skills.ts so demo students see the same skill names that
 * their seeded conversations reference. In normal mode queries
 * durable_skill from the DB.
 *
 * Response shape is identical either way:
 *   { skills: [{ id, name, pillarName }] }
 */
export async function GET() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  if (isDemoMode) {
    const pillarNameById = new Map(staticPillars.map(p => [p.id, p.name]))
    const formatted = staticSkills
      .filter(s => s.isActive)
      .map(s => ({
        id: s.id,
        name: s.name,
        pillarName: pillarNameById.get(s.pillarId) || 'Unknown',
      }))
    return NextResponse.json({ skills: formatted })
  }

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
