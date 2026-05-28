import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/student/skill-definition
 *
 * Create a new version of the authenticated student's definition for a
 * skill. Self-scoped: the student id comes from getV2StudentId (persona
 * cookie OR real auth) — never from the request body — so a caller can
 * only write their OWN definitions. Each save demotes the prior
 * is_current row and inserts a new is_current row at version+1, tagged
 * prompted_by='self_initiated'. The backend reflection/conversation/
 * narrative flows already read these.
 */
export async function POST(req: Request) {
  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ ok: false, error: 'Not a student' }, { status: 403 })
  }

  let body: {
    skillId?: string
    definitionText?: string
    personalExample?: string | null
    whyItMatters?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const skillId = body.skillId
  const definitionText = (body.definitionText ?? '').trim()
  const personalExample = body.personalExample?.trim() || null
  const whyItMatters = body.whyItMatters?.trim() || null

  if (!skillId) {
    return NextResponse.json({ ok: false, error: 'skillId is required' }, { status: 400 })
  }
  if (definitionText.length === 0) {
    return NextResponse.json({ ok: false, error: 'A definition is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Validate the skill exists.
  const { data: skill } = await admin
    .from('durable_skill')
    .select('id')
    .eq('id', skillId)
    .maybeSingle()
  if (!skill) {
    return NextResponse.json({ ok: false, error: 'Unknown skill' }, { status: 400 })
  }

  // Compute next version from existing rows for this student+skill.
  const { data: existing } = await admin
    .from('student_skill_definition')
    .select('version')
    .eq('student_id', studentId)
    .eq('skill_id', skillId)
    .order('version', { ascending: false })
    .limit(1)
  const nextVersion = ((existing?.[0]?.version as number | undefined) ?? 0) + 1

  // Demote any current row(s), then insert the new current version.
  const { error: demoteErr } = await admin
    .from('student_skill_definition')
    .update({ is_current: false })
    .eq('student_id', studentId)
    .eq('skill_id', skillId)
    .eq('is_current', true)
  if (demoteErr) {
    return NextResponse.json({ ok: false, error: `Demote failed: ${demoteErr.message}` }, { status: 500 })
  }

  const { error: insertErr } = await admin
    .from('student_skill_definition')
    .insert({
      student_id: studentId,
      skill_id: skillId,
      definition_text: definitionText,
      personal_example: personalExample,
      why_it_matters: whyItMatters,
      version: nextVersion,
      is_current: true,
      prompted_by: 'self_initiated',
    })
  if (insertErr) {
    return NextResponse.json({ ok: false, error: `Insert failed: ${insertErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
