import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getV2StudentId } from '@/lib/v2-auth'

/**
 * PUT /api/conversation/:id/tags
 *
 * Updates skill tags for a conversation. Identity resolves via
 * getV2Identity (real Supabase auth incl. LTI, OR demo persona).
 * A student may only modify tags on their own conversation.
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const studentId = await getV2StudentId()
    if (!studentId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { tags } = await request.json() as {
      tags: { skillId: string; confidence: number; studentConfirmed: boolean; rationale?: string }[]
    }

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json({ error: 'tags array is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: conversation } = await admin
      .from('growth_conversation')
      .select('id, student_id')
      .eq('id', params.id)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    if (conversation.student_id !== studentId) {
      return NextResponse.json({ error: 'Not your conversation' }, { status: 403 })
    }

    await admin
      .from('conversation_skill_tag')
      .delete()
      .eq('conversation_id', params.id)

    if (tags.length > 0) {
      await admin
        .from('conversation_skill_tag')
        .insert(
          tags.map(t => ({
            conversation_id: params.id,
            skill_id: t.skillId,
            confidence: t.confidence,
            student_confirmed: t.studentConfirmed,
            rationale: t.rationale || null,
          }))
        )
    }

    return NextResponse.json({ ok: true, tagCount: tags.length })
  } catch (error) {
    console.error('Tag update error:', error)
    return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 })
  }
}
