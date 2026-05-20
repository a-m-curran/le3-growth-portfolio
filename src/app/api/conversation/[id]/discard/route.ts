import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'
import { log } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/conversation/[id]/discard
 *
 * Discards an in-progress reflection by setting its status to
 * 'abandoned'. Used by:
 *   - The pinned in-progress banner's "Discard" button (after confirm)
 *   - The InProgressInterstitial's "Discard and start new" path also
 *     uses /api/conversation/start { discardAndStart: true } which
 *     abandons inline; this endpoint is for the standalone banner case.
 *
 * Status='abandoned' is reversible in the DB (an admin can flip it back
 * to 'in_progress'), but students see this as permanent. The endpoint
 * is a no-op for any conversation that is not currently 'in_progress'.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const reqLog = log.withRequest()
  const conversationId = params.id

  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: conv, error: loadErr } = await admin
    .from('growth_conversation')
    .select('id, student_id, status')
    .eq('id', conversationId)
    .maybeSingle()

  if (loadErr || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }
  if (conv.student_id !== studentId) {
    return NextResponse.json({ error: 'Not your conversation' }, { status: 403 })
  }

  // No-op if already not in_progress (already completed / already abandoned).
  // Idempotent: returns ok regardless so the UI doesn't need to special-case races.
  const { error: updateErr } = await admin
    .from('growth_conversation')
    .update({ status: 'abandoned' })
    .eq('id', conversationId)
    .eq('status', 'in_progress')

  if (updateErr) {
    await reqLog.error('conversation.discard_failed', {
      studentId,
      message: 'growth_conversation update failed during discard',
      context: { conversation_id: conversationId, db_error: updateErr.message },
    })
    return NextResponse.json({ error: 'Failed to discard' }, { status: 500 })
  }

  await reqLog.info('conversation.discarded', {
    studentId,
    actorType: 'student',
    actorId: studentId,
    message: 'Student discarded an in-progress conversation',
    context: { conversation_id: conversationId, prior_status: conv.status },
  })

  return NextResponse.json({ ok: true })
}
