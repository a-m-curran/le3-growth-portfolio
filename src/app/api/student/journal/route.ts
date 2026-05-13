import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/journal
 *
 * Powers /v2/journal — open standalone reflections
 * (conversation_type = 'open_reflection'). Distinct from
 * /api/student/reflect which handles work-tied conversations.
 *
 * Returns:
 *   inProgress  — in-progress journal entries (resume cards)
 *   completed   — completed entries with description + synthesis
 *
 * Demo personas are real DB rows; the student id is resolved via
 * `getV2StudentId` which honors the demo persona cookie OR real
 * Supabase auth — single query path either way.
 */
export async function GET() {
  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: convoRows } = await admin
    .from('growth_conversation')
    .select(
      'id, status, started_at, completed_at, work_context, ' +
        'response_phase_1, response_phase_2, prompt_phase_2, prompt_phase_3, ' +
        'synthesis_text, ' +
        'conversation_skill_tag(skill_id, confidence, student_confirmed, ' +
        '  durable_skill(name, pillar:pillar_id(name)))'
    )
    .eq('student_id', studentId)
    .eq('conversation_type', 'open_reflection')
    .order('started_at', { ascending: false })
    .limit(50)

  interface ConvoTag {
    skill_id: string
    confidence: number
    student_confirmed: boolean
    durable_skill: { name: string; pillar: { name: string } | null } | null
  }
  interface ConvoRow {
    id: string
    status: string
    started_at: string
    completed_at: string | null
    work_context: string | null
    response_phase_1: string | null
    response_phase_2: string | null
    prompt_phase_2: string | null
    prompt_phase_3: string | null
    synthesis_text: string | null
    conversation_skill_tag: ConvoTag[] | null
  }
  const convos = (convoRows ?? []) as unknown as ConvoRow[]

  function dominantPillar(c: ConvoRow): string | null {
    const tags = c.conversation_skill_tag ?? []
    if (tags.length === 0) return null
    const top = [...tags].sort((a, b) => b.confidence - a.confidence)[0]
    return top.durable_skill?.pillar?.name ?? null
  }

  const inProgress = convos
    .filter(c => c.status === 'in_progress')
    .map(c => ({
      id: c.id,
      startedAt: c.started_at,
      description: c.work_context,
      currentPhase: deriveDbPhase(c),
      primaryPillar: dominantPillar(c),
    }))

  const completed = convos
    .filter(c => c.status === 'completed')
    .map(c => ({
      id: c.id,
      startedAt: c.started_at,
      completedAt: c.completed_at,
      description: c.work_context,
      synthesisExcerpt: c.synthesis_text
        ? c.synthesis_text.slice(0, 160) + (c.synthesis_text.length > 160 ? '…' : '')
        : null,
      primaryPillar: dominantPillar(c),
    }))

  return NextResponse.json({ inProgress, completed })
}

function deriveDbPhase(c: {
  response_phase_1: string | null
  response_phase_2: string | null
  prompt_phase_2: string | null
  prompt_phase_3: string | null
}): 1 | 2 | 3 {
  if (c.response_phase_2 && c.prompt_phase_3) return 3
  if (c.response_phase_1 && c.prompt_phase_2) return 2
  return 1
}
