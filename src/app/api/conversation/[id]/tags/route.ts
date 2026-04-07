import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * PUT /api/conversation/:id/tags
 *
 * Updates skill tags for a conversation. Handles:
 * - Confirming/unconfirming existing tags
 * - Adding new student-tagged skills
 * - Removing tags
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { tags } = await request.json() as {
      tags: { skillId: string; confidence: number; studentConfirmed: boolean; rationale?: string }[]
    }

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json({ error: 'tags array is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify the conversation belongs to this user
    const { data: student } = await admin
      .from('student')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const { data: conversation } = await admin
      .from('growth_conversation')
      .select('id, student_id')
      .eq('id', params.id)
      .single()

    if (!conversation || conversation.student_id !== student.id) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Delete existing tags and replace with the new set
    await admin
      .from('conversation_skill_tag')
      .delete()
      .eq('conversation_id', params.id)

    // Insert updated tags
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
