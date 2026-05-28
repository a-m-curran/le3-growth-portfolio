import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/skill/[skillId]/unreflected-work
 *
 * Returns the student's submissions tagged with this skill (via
 * work_skill_tag) that have NO reflection yet — i.e. no growth_
 * conversation that is in_progress or completed for the work. Newest
 * first, capped at 5. Also returns the student's current active
 * in-progress reflection so the panel can wire useStartReflection
 * (which routes through the in-progress interstitial when one exists).
 *
 * Self-scoped via getV2StudentId. Shape: { activeInProgress, items }
 * where items match SubmissionItem (status always 'unreflected').
 */
export async function GET(
  _req: Request,
  { params }: { params: { skillId: string } }
) {
  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ error: 'Not a student' }, { status: 403 })
  }
  const skillId = params.skillId
  const admin = createAdminClient()

  // 1. Work ids tagged with this skill, for this student.
  const { data: tagRows } = await admin
    .from('work_skill_tag')
    .select('work_id, student_work!inner(student_id)')
    .eq('skill_id', skillId)
    .eq('student_work.student_id', studentId)
  const taggedWorkIds = Array.from(
    new Set((tagRows ?? []).map(t => t.work_id as string))
  )

  // 2. Active-in-progress reflection (global for the student), used to
  //    prime useStartReflection in the panel.
  const { data: activeRow } = await admin
    .from('growth_conversation')
    .select('id, work_id, conversation_type, started_at, current_phase, student_work(title)')
    .eq('student_id', studentId)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const activeInProgress = activeRow
    ? {
        id: activeRow.id as string,
        workId: (activeRow.work_id as string | null) ?? null,
        workTitle:
          ((activeRow.student_work as { title?: string } | null)?.title as string | undefined) ?? null,
        conversationType: (activeRow.conversation_type ?? 'work_based') as
          | 'work_based'
          | 'open_reflection',
        currentPhase: ((activeRow.current_phase as number | null) ?? 1) as 1 | 2 | 3,
        startedAt: activeRow.started_at as string,
      }
    : null

  if (taggedWorkIds.length === 0) {
    return NextResponse.json({ activeInProgress, items: [] })
  }

  // 3. Work ids that already have an in_progress/completed conversation.
  const { data: convRows } = await admin
    .from('growth_conversation')
    .select('work_id, status')
    .eq('student_id', studentId)
    .in('status', ['in_progress', 'completed'])
    .in('work_id', taggedWorkIds)
  const reflectedWorkIds = new Set(
    (convRows ?? []).map(c => c.work_id as string).filter(Boolean)
  )

  // 4. Fetch the unreflected tagged work, newest first, cap 5.
  const unreflectedIds = taggedWorkIds.filter(id => !reflectedWorkIds.has(id))
  if (unreflectedIds.length === 0) {
    return NextResponse.json({ activeInProgress, items: [] })
  }
  const { data: workRows } = await admin
    .from('student_work')
    .select('id, title, course_name, course_code, week_number, submitted_at, quarter, work_type')
    .in('id', unreflectedIds)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(5)

  const items = (workRows ?? []).map(w => ({
    id: w.id as string,
    title: w.title as string,
    courseName: (w.course_name as string | null) ?? null,
    courseCode: (w.course_code as string | null) ?? null,
    weekNumber: (w.week_number as number | null) ?? null,
    submittedAt: (w.submitted_at as string | null) ?? null,
    quarter: (w.quarter as string | null) ?? '',
    workType: (w.work_type as string | null) ?? null,
    status: 'unreflected' as const,
    conversationId: null,
    primaryPillar: null,
  }))

  return NextResponse.json({ activeInProgress, items })
}
