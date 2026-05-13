import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { skills, pillars, getSkillNarrative } from '@/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/narrative
 *
 * Powers /v2/narrative. Returns a per-skill list of narratives —
 * each active skill in the system gets an entry with its pillar
 * info, and (when one has been generated) its narrativeText +
 * richness + version.
 *
 * Demo mode reads the static seed in src/data/skill-narratives.ts;
 * the seed already carries narratives for all of Aja's active
 * skills so the demo page renders fully populated.
 *
 * Real mode joins skill_narrative on the student id, deduping to
 * the latest version per skill.
 */
export async function GET() {
  const cookieStore = cookies()
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  // ─── Demo mode ──────────────────────────────
  if (isDemoMode) {
    const demoStudentId = 'stu_aja'
    const activeSkills = skills.filter(s => s.isActive)

    const narratives = activeSkills.map(skill => {
      const pillar = pillars.find(p => p.id === skill.pillarId)
      const seed = getSkillNarrative(demoStudentId, skill.id)
      return {
        skillId: skill.id,
        skillName: skill.name,
        pillarId: skill.pillarId,
        pillarName: pillar?.name ?? null,
        narrativeText: seed?.narrativeText ?? null,
        narrativeRichness: seed?.narrativeRichness ?? null,
        version: seed?.version ?? 0,
        generatedAt: null as string | null,
      }
    })

    return NextResponse.json({ narratives })
  }

  // ─── DB-backed flow ─────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: student } = await admin
    .from('student')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!student) {
    return NextResponse.json(
      { error: 'Student record not found' },
      { status: 404 }
    )
  }

  // Fetch the list of active skills + pillars (also DB-sourced in
  // real mode — but for now we read off the static seed since the
  // catalog is small and rarely changes).
  const activeSkills = skills.filter(s => s.isActive)

  // Pull all narrative rows for this student, latest version first.
  const { data: narrativeRows } = await admin
    .from('skill_narrative')
    .select('skill_id, narrative_text, narrative_richness, version, generated_at')
    .eq('student_id', student.id)
    .order('version', { ascending: false })

  interface NarrativeRow {
    skill_id: string
    narrative_text: string | null
    narrative_richness: string | null
    version: number | null
    generated_at: string | null
  }
  const rows = (narrativeRows ?? []) as unknown as NarrativeRow[]
  const latestBySkill = new Map<string, NarrativeRow>()
  for (const r of rows) {
    if (!latestBySkill.has(r.skill_id)) latestBySkill.set(r.skill_id, r)
  }

  const narratives = activeSkills.map(skill => {
    const pillar = pillars.find(p => p.id === skill.pillarId)
    const row = latestBySkill.get(skill.id)
    return {
      skillId: skill.id,
      skillName: skill.name,
      pillarId: skill.pillarId,
      pillarName: pillar?.name ?? null,
      narrativeText: row?.narrative_text ?? null,
      narrativeRichness: row?.narrative_richness ?? null,
      version: row?.version ?? 0,
      generatedAt: row?.generated_at ?? null,
    }
  })

  return NextResponse.json({ narratives })
}
