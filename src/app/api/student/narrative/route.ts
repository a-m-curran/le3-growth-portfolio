import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  skills,
  pillars,
  getSkillNarrative,
  getConversationsForSkill,
  getStudentWork,
} from '@/data'

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
  // Three skills start blank in the demo so the Generate flow is
  // visible on the page. After the user clicks Generate on one,
  // /api/narrative/generate sets a cookie marking that skill as
  // "revealed" — this endpoint then returns the seed text for it
  // on the next read. Cookie is session-scoped so a fresh tab
  // always starts with the same three blank.
  const DEMO_INITIALLY_BLANK = new Set<string>([
    'skill_networking',
    'skill_communication',
    'skill_adaptability',
  ])

  if (isDemoMode) {
    const demoStudentId = 'stu_aja'
    const activeSkills = skills.filter(s => s.isActive)
    const revealedRaw = cookieStore.get('demo-narrative-revealed')?.value ?? ''
    const revealed = new Set(revealedRaw.split(',').filter(Boolean))

    const narratives = activeSkills.map(skill => {
      const pillar = pillars.find(p => p.id === skill.pillarId)
      const seed = getSkillNarrative(demoStudentId, skill.id)
      const isBlank =
        DEMO_INITIALLY_BLANK.has(skill.id) && !revealed.has(skill.id)

      // Source list: every conversation tagged with this skill,
      // sorted oldest-first so the timeline reads chronologically
      // when the Sources disclosure is expanded.
      const sourceConvos = getConversationsForSkill(demoStudentId, skill.id)
        .slice()
        .sort(
          (a, b) =>
            new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
        )
        .map(c => {
          const work = c.workId ? getStudentWork(c.workId) : null
          return {
            id: c.id,
            workTitle: work?.title ?? c.workContext ?? 'Reflection',
            date: c.startedAt,
          }
        })

      return {
        skillId: skill.id,
        skillName: skill.name,
        pillarId: skill.pillarId,
        pillarName: pillar?.name ?? null,
        narrativeText: isBlank ? null : seed?.narrativeText ?? null,
        narrativeRichness: isBlank ? null : seed?.narrativeRichness ?? null,
        version: isBlank ? 0 : seed?.version ?? 0,
        generatedAt: null as string | null,
        annotations: isBlank ? [] : seed?.annotations ?? [],
        sources: sourceConvos,
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
  // `narrative_annotations` is a planned JSON column carrying the
  // sentence → conversation_id mapping produced by a post-processing
  // LLM pass at generation time. The column may not exist yet on
  // the live schema, in which case the select silently returns the
  // rows without it and the cast below leaves annotations empty.
  const { data: narrativeRows } = await admin
    .from('skill_narrative')
    .select(
      'skill_id, narrative_text, narrative_richness, version, generated_at, narrative_annotations'
    )
    .eq('student_id', student.id)
    .order('version', { ascending: false })

  interface NarrativeRow {
    skill_id: string
    narrative_text: string | null
    narrative_richness: string | null
    version: number | null
    generated_at: string | null
    narrative_annotations: Array<{ sentence: string; conversationId: string }> | null
  }
  const rows = (narrativeRows ?? []) as unknown as NarrativeRow[]
  const latestBySkill = new Map<string, NarrativeRow>()
  for (const r of rows) {
    if (!latestBySkill.has(r.skill_id)) latestBySkill.set(r.skill_id, r)
  }

  // Pull all skill-tagged conversations for this student in one
  // round-trip so we can construct each narrative's `sources` list
  // without a per-skill query.
  const { data: tagRows } = await admin
    .from('conversation_skill_tag')
    .select(
      'skill_id, growth_conversation!inner(id, started_at, student_id, student_work(title))'
    )
    .eq('growth_conversation.student_id', student.id)

  interface TagRow {
    skill_id: string
    growth_conversation: {
      id: string
      started_at: string
      student_id: string
      student_work: { title: string } | null
    }
  }
  const tags = (tagRows ?? []) as unknown as TagRow[]
  const sourcesBySkill = new Map<
    string,
    Array<{ id: string; workTitle: string; date: string }>
  >()
  for (const t of tags) {
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
      annotations: row?.narrative_annotations ?? [],
      sources: sourcesBySkill.get(skill.id) ?? [],
    }
  })

  return NextResponse.json({ narratives })
}
