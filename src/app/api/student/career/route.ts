import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { skills, pillars, getCareerOutput } from '@/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/career
 *
 * Powers /v2/career. Returns the latest career_output for the
 * current student — a professional summary plus a per-skill list
 * with resume language + interview talking points.
 *
 * Each skillDescription is enriched with pillarName so the v2 UI
 * can tint cards by pillar without an extra round-trip.
 *
 * Demo mode reads the static `careerOutputs` seed; real mode pulls
 * the latest `career_output` row for the student.
 *
 * Returns 200 with `output: null` when no output has been generated
 * yet — the UI then shows the empty/CTA state rather than a hard
 * error.
 */
export async function GET() {
  const cookieStore = cookies()
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  // ─── Demo mode ──────────────────────────────
  // The demo starts with no career output so the Generate flow is
  // visible. After the user hits /api/career/generate, that endpoint
  // sets a cookie marking the output as "generated" for this session;
  // subsequent reads return the populated seed. Cookie is per-browser-
  // session, so a fresh demo tab always starts from empty.
  if (isDemoMode) {
    const wasGenerated =
      cookieStore.get('demo-career-generated')?.value === 'true'
    if (!wasGenerated) {
      return NextResponse.json({ output: null })
    }
    const demoStudentId = 'stu_aja'
    const career = getCareerOutput(demoStudentId)
    if (!career) {
      return NextResponse.json({ output: null })
    }
    return NextResponse.json({
      output: {
        resumeSummary: career.resumeSummary,
        skillDescriptions: career.skillDescriptions.map(sd =>
          enrichWithPillar(sd)
        ),
        version: career.version,
        generatedAt: null as string | null,
      },
    })
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

  // Pull the most recent career_output row.
  const { data: rows } = await admin
    .from('career_output')
    .select('resume_summary, skill_descriptions, version, generated_at')
    .eq('student_id', student.id)
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

  return NextResponse.json({
    output: {
      resumeSummary: row.resume_summary,
      skillDescriptions: row.skill_descriptions.map(sd => enrichWithPillar(sd)),
      version: row.version,
      generatedAt: row.generated_at,
    },
  })
}

interface SkillDescription {
  skillId: string
  skillName: string
  resumeLanguage: string
  talkingPoints: string[]
}

/**
 * Add pillarName to a skill description by looking up the skill in
 * the static catalog. Used to drive per-card pillar tints on the
 * v2 career page without a second fetch.
 */
function enrichWithPillar(sd: SkillDescription): SkillDescription & {
  pillarName: string | null
} {
  const skill = skills.find(s => s.id === sd.skillId)
  const pillar = skill ? pillars.find(p => p.id === skill.pillarId) : null
  return { ...sd, pillarName: pillar?.name ?? null }
}
