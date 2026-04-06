import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { autoTagWork } from '@/lib/conversation-engine-live'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { StudentWork, WorkType } from '@/lib/types'

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

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
    }

    const csvText = await file.text()
    const rows = parseCSV(csvText)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })
    }

    // Create batch record
    const { data: batch } = await admin
      .from('work_import_batch')
      .insert({
        student_id: student.id,
        source: 'csv',
        filename: file.name,
        total_items: rows.length,
        status: 'processing',
      })
      .select('id')
      .single()

    const batchId = batch?.id

    // Determine quarter
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    let quarter: string
    if (month < 3) quarter = `Winter ${year}`
    else if (month < 6) quarter = `Spring ${year}`
    else if (month < 9) quarter = `Summer ${year}`
    else quarter = `Fall ${year}`

    // Process each row
    const results: { title: string; skills: string[]; error?: string }[] = []
    let processed = 0

    for (const row of rows) {
      try {
        // Insert student_work record
        const { data: work, error: insertError } = await admin
          .from('student_work')
          .insert({
            student_id: student.id,
            title: row.title,
            description: row.description || null,
            work_type: row.workType || 'other',
            course_name: row.courseName || null,
            course_code: row.courseCode || null,
            submitted_at: row.submittedAt || now.toISOString(),
            quarter: row.quarter || quarter,
            grade: row.grade || null,
            content: row.content || null,
            source: 'csv_import',
            imported_at: now.toISOString(),
          })
          .select('*')
          .single()

        if (insertError || !work) {
          results.push({ title: row.title, skills: [], error: insertError?.message || 'Insert failed' })
          continue
        }

        // Auto-tag with skills
        const workObj: StudentWork = {
          id: work.id,
          studentId: student.id,
          title: row.title,
          description: row.description,
          workType: (row.workType || 'other') as WorkType,
          courseName: row.courseName,
          courseCode: row.courseCode,
          submittedAt: row.submittedAt || now.toISOString(),
          quarter: row.quarter || quarter,
          content: row.content,
        }

        const tags = await autoTagWork(workObj)

        // Insert skill tags
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

        results.push({
          title: row.title,
          skills: tags.map(t => t.skillId),
        })

        processed++
      } catch (err) {
        results.push({ title: row.title, skills: [], error: String(err) })
      }
    }

    // Update batch
    if (batchId) {
      await admin
        .from('work_import_batch')
        .update({
          processed_items: processed,
          status: processed === rows.length ? 'completed' : 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', batchId)
    }

    return NextResponse.json({
      batchId,
      total: rows.length,
      processed,
      results,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}

interface CSVRow {
  title: string
  description?: string
  workType?: string
  courseName?: string
  courseCode?: string
  submittedAt?: string
  quarter?: string
  grade?: string
  content?: string
}

function parseCSV(text: string): CSVRow[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0) continue

    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      if (idx < values.length) row[header] = values[idx]
    })

    // Map common header names
    const title = row.title || row.name || row.assignment || row['assignment name']
    if (!title) continue

    rows.push({
      title,
      description: row.description || row.desc || row.instructions,
      workType: mapWorkType(row.type || row['work type'] || row['work_type'] || row.worktype),
      courseName: row.course || row['course name'] || row['course_name'] || row.coursename,
      courseCode: row['course code'] || row['course_code'] || row.coursecode,
      submittedAt: row['submitted at'] || row['submitted_at'] || row.submittedat || row.date || row['due date'],
      quarter: row.quarter,
      grade: row.grade || row.score,
      content: row.content || row.text || row.body,
    })
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function mapWorkType(type?: string): string {
  if (!type) return 'other'
  const normalized = type.toLowerCase().trim()
  const map: Record<string, string> = {
    essay: 'essay',
    paper: 'essay',
    project: 'project',
    discussion: 'discussion_post',
    'discussion post': 'discussion_post',
    presentation: 'presentation',
    exam: 'exam',
    quiz: 'exam',
    test: 'exam',
    lab: 'lab_report',
    'lab report': 'lab_report',
    portfolio: 'portfolio_piece',
  }
  return map[normalized] || 'other'
}
