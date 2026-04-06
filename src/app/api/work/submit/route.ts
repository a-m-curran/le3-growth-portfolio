import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
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

    const admin = createAdminClient()

    // Get student record
    const { data: student } = await admin
      .from('student')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const { title, description, workType, courseName } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const validTypes = ['essay', 'project', 'discussion_post', 'presentation', 'exam', 'lab_report', 'portfolio_piece', 'other']
    if (!validTypes.includes(workType)) {
      return NextResponse.json({ error: 'Invalid work type' }, { status: 400 })
    }

    // Determine quarter
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    let quarter: string
    if (month < 3) quarter = `Winter ${year}`
    else if (month < 6) quarter = `Spring ${year}`
    else if (month < 9) quarter = `Summer ${year}`
    else quarter = `Fall ${year}`

    // Calculate approximate week number in the quarter
    const quarterStartMonth = Math.floor(month / 3) * 3
    const quarterStart = new Date(year, quarterStartMonth, 1)
    const weekNumber = Math.ceil((now.getTime() - quarterStart.getTime()) / (7 * 24 * 60 * 60 * 1000))

    const { data: work, error: insertError } = await admin
      .from('student_work')
      .insert({
        student_id: student.id,
        title,
        description: description || null,
        work_type: workType,
        course_name: courseName || null,
        submitted_at: now.toISOString(),
        quarter,
        week_number: weekNumber,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Work submit error:', insertError)
      return NextResponse.json({ error: 'Failed to submit work' }, { status: 500 })
    }

    return NextResponse.json({ workId: work.id })
  } catch (error) {
    console.error('Work submit error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
