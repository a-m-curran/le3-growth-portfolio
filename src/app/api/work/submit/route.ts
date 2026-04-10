import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { extractText, isSupported } from '@/lib/extract-text'
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

    const { data: student } = await admin
      .from('student')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Parse form data (supports file upload)
    const formData = await request.formData()
    const title = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const workType = (formData.get('workType') as string) || 'other'
    const courseName = (formData.get('courseName') as string) || null
    const ltiResourceLinkId = (formData.get('ltiResourceLinkId') as string) || null
    const file = formData.get('file') as File | null

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const validTypes = ['essay', 'project', 'discussion_post', 'presentation', 'exam', 'lab_report', 'portfolio_piece', 'other']
    if (!validTypes.includes(workType)) {
      return NextResponse.json({ error: 'Invalid work type' }, { status: 400 })
    }

    // Extract text from file if provided
    let content: string | null = null
    let fileUrl: string | null = null

    if (file && file.size > 0) {
      // Validate file
      if (!isSupported(file.name)) {
        return NextResponse.json(
          { error: 'Unsupported file type. Use PDF, DOCX, TXT, or MD.' },
          { status: 400 }
        )
      }

      if (file.size > 4 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 4MB.' },
          { status: 400 }
        )
      }

      // Extract text content
      const buffer = Buffer.from(await file.arrayBuffer())
      try {
        content = await extractText(buffer, file.name)
      } catch (err) {
        console.error('Text extraction error:', err)
        // Continue without extracted content — the file will still be stored
      }

      // Upload to Supabase Storage
      const ext = file.name.split('.').pop()
      const storagePath = `${student.id}/${Date.now()}.${ext}`

      const { error: uploadError } = await admin.storage
        .from('student-work')
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        // Continue without stored file — we still have extracted text
      } else {
        const { data: urlData } = admin.storage
          .from('student-work')
          .getPublicUrl(storagePath)
        fileUrl = urlData.publicUrl
      }
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

    const quarterStartMonth = Math.floor(month / 3) * 3
    const quarterStart = new Date(year, quarterStartMonth, 1)
    const weekNumber = Math.ceil((now.getTime() - quarterStart.getTime()) / (7 * 24 * 60 * 60 * 1000))

    // If this submission is tied to an LTI resource link (student uploading
    // the file for an assignment launched from Brightspace), set external_id
    // so we can dedupe against any auto-sync of the same resource link.
    const externalId = ltiResourceLinkId
      ? `lti:${process.env.LTI_PLATFORM_ISSUER || 'unknown'}:${ltiResourceLinkId}`
      : null
    const source = ltiResourceLinkId ? 'manual' : 'manual'

    const { data: work, error: insertError } = await admin
      .from('student_work')
      .insert({
        student_id: student.id,
        title,
        description,
        work_type: workType,
        course_name: courseName,
        submitted_at: now.toISOString(),
        quarter,
        week_number: weekNumber,
        content,
        source,
        external_id: externalId,
        imported_at: ltiResourceLinkId ? now.toISOString() : null,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Work submit error:', insertError)
      return NextResponse.json({ error: 'Failed to submit work' }, { status: 500 })
    }

    return NextResponse.json({ workId: work.id, fileUrl, hasContent: !!content })
  } catch (error) {
    console.error('Work submit error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
