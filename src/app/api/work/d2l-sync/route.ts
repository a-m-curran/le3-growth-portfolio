import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { createD2LClient } from '@/lib/d2l-client'
import { autoTagWork } from '@/lib/conversation-engine-live'
import { extractText, isSupported } from '@/lib/extract-text'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { WorkType } from '@/lib/types'

/**
 * POST /api/work/d2l-sync — DEPRECATED
 *
 * Was: Poll-based sync via Valence REST API. Pulls assignments and
 * submissions for a course, downloads files, extracts text, and creates
 * student_work records.
 *
 * Now: LTI Asset Processor (see /api/lti/notice) is the active path.
 * It's push-based — Brightspace notifies us when students submit, and
 * we download via the LTI Asset Service with no polling. The Valence
 * approach is kept as a fallback only.
 *
 * Body: { courseId: string, courseName: string }
 */
export async function POST(request: Request) {
  try {
    const d2l = createD2LClient()
    if (!d2l) {
      return NextResponse.json(
        { error: 'D2L integration is not configured. Set D2L_INSTANCE_URL and D2L_ACCESS_TOKEN environment variables.' },
        { status: 503 }
      )
    }

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

    const admin = createAdminClient()
    const { data: student } = await admin
      .from('student')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const { courseId, courseName } = await request.json()
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

    // Pull assignments and submissions from D2L
    const { assignments, submissions } = await d2l.syncCourse(courseId, courseName || '')

    // Filter to this student's submissions
    // TODO: match D2L userId to our student record (via email or NLU ID)
    // For now, import all submissions and let the caller filter

    // Determine quarter
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    let quarter: string
    if (month < 3) quarter = `Winter ${year}`
    else if (month < 6) quarter = `Spring ${year}`
    else if (month < 9) quarter = `Summer ${year}`
    else quarter = `Fall ${year}`

    const results: { title: string; skills: string[]; error?: string }[] = []
    let imported = 0

    for (const assignment of assignments) {
      try {
        // Check if this assignment was already imported
        const { data: existing } = await admin
          .from('student_work')
          .select('id')
          .eq('student_id', student.id)
          .eq('external_id', `d2l:${courseId}:${assignment.id}`)
          .limit(1)

        if (existing && existing.length > 0) {
          results.push({ title: assignment.name, skills: [], error: 'Already imported' })
          continue
        }

        // Find this student's submission for this assignment
        const studentSubs = submissions.filter(s => s.assignmentId === assignment.id)

        // Try to download and extract text from the first submitted file
        let content: string | null = null
        if (studentSubs.length > 0 && studentSubs[0].files.length > 0) {
          const file = studentSubs[0].files[0]
          if (isSupported(file.fileName)) {
            try {
              const buffer = await d2l.downloadSubmissionFile(
                courseId, assignment.id, studentSubs[0].id, String(file.fileId)
              )
              content = await extractText(buffer, file.fileName)
            } catch (err) {
              console.error(`Failed to download/extract ${file.fileName}:`, err)
            }
          }
        }

        // Map D2L submission type to our work type
        const workType = mapAssignmentToWorkType(assignment.name, assignment.submissionType)

        // Create student_work record
        const { data: work, error: insertErr } = await admin
          .from('student_work')
          .insert({
            student_id: student.id,
            title: assignment.name,
            description: assignment.instructions?.substring(0, 500) || null,
            work_type: workType,
            course_name: assignment.courseName || null,
            submitted_at: studentSubs[0]?.submittedDate || now.toISOString(),
            quarter,
            grade: studentSubs[0]?.grade ? String(studentSubs[0].grade) : null,
            content,
            source: 'd2l_api',
            external_id: `d2l:${courseId}:${assignment.id}`,
            imported_at: now.toISOString(),
          })
          .select('id')
          .single()

        if (insertErr || !work) {
          results.push({ title: assignment.name, skills: [], error: insertErr?.message || 'Insert failed' })
          continue
        }

        // Auto-tag with skills
        const tags = await autoTagWork({
          id: work.id,
          studentId: student.id,
          title: assignment.name,
          description: assignment.instructions,
          workType: workType as WorkType,
          courseName: assignment.courseName,
          submittedAt: studentSubs[0]?.submittedDate || now.toISOString(),
          quarter,
          content: content || undefined,
        })

        if (tags.length > 0) {
          await admin.from('work_skill_tag').insert(
            tags.map(t => ({
              work_id: work.id,
              skill_id: t.skillId,
              confidence: t.confidence,
              rationale: t.rationale,
              source: 'llm_auto',
            }))
          )
        }

        results.push({ title: assignment.name, skills: tags.map(t => t.skillId) })
        imported++
      } catch (err) {
        results.push({ title: assignment.name, skills: [], error: String(err) })
      }
    }

    return NextResponse.json({
      courseId,
      courseName,
      total: assignments.length,
      imported,
      results,
    })
  } catch (error) {
    console.error('D2L sync error:', error)
    return NextResponse.json({ error: 'D2L sync failed: ' + String(error) }, { status: 500 })
  }
}

function mapAssignmentToWorkType(name: string, submissionType: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('discussion')) return 'discussion_post'
  if (lower.includes('presentation')) return 'presentation'
  if (lower.includes('exam') || lower.includes('quiz') || lower.includes('test')) return 'exam'
  if (lower.includes('lab')) return 'lab_report'
  if (lower.includes('essay') || lower.includes('paper') || lower.includes('report')) return 'essay'
  if (lower.includes('project')) return 'project'
  if (lower.includes('portfolio')) return 'portfolio_piece'
  if (submissionType === 'text') return 'essay'
  return 'other'
}
