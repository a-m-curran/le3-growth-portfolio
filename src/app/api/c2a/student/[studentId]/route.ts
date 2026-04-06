import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * C2A Data Endpoint
 *
 * Returns all structured conversation outputs for a student.
 * This is the read-only interface that the C2A tool will consume.
 *
 * GET /api/c2a/student/:studentId
 *
 * Future: Add API key auth for the C2A service.
 */
export async function GET(
  _request: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    const admin = createAdminClient()

    // Get all conversation outputs for this student
    const { data: outputs, error } = await admin
      .from('conversation_output')
      .select(`
        *,
        growth_conversation!inner(
          id,
          student_id,
          work_id,
          quarter,
          status,
          started_at,
          completed_at,
          conversation_type,
          synthesis_text,
          suggested_insight,
          conversation_skill_tag(skill_id, confidence, rationale)
        )
      `)
      .eq('growth_conversation.student_id', params.studentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('C2A query error:', error)
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
    }

    // Get student info
    const { data: student } = await admin
      .from('student')
      .select('id, first_name, last_name, cohort, program_start_date')
      .eq('id', params.studentId)
      .single()

    return NextResponse.json({
      student: student ? {
        id: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        cohort: student.cohort,
        programStartDate: student.program_start_date,
      } : null,
      conversationOutputs: outputs || [],
      meta: {
        totalConversations: outputs?.length || 0,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      },
    })
  } catch (error) {
    console.error('C2A endpoint error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
