import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/sync-inspect
 *
 * Coach-only dashboard endpoint that returns the actual DB state
 * produced by the most recent syncs — so we can see without SQL
 * queries whether students, assignments, and submissions actually
 * landed, and critically, whether student_work.content has real
 * extracted text or is empty (the content_len=0 failure mode).
 *
 * Returns compact slices (not full dumps) of each table so the
 * response stays render-friendly.
 */
export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: coach } = await admin
    .from('coach')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!coach) {
    return NextResponse.json({ error: 'Coach access required' }, { status: 403 })
  }

  // ─── Courses ──────────────────────────────────
  const { data: courses } = await admin
    .from('course')
    .select('id, name, code, quarter, active, brightspace_org_unit_id, synced_at')
    .order('synced_at', { ascending: false, nullsFirst: false })
    .limit(20)

  // ─── Students (synced from D2L) ──────────────
  const { data: students } = await admin
    .from('student')
    .select('id, first_name, last_name, email, nlu_id, d2l_user_id, coach_id, cohort, status, created_at')
    .not('d2l_user_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  // ─── Instructors (Brightspace course teachers) ──
  // Distinct from coaches — instructors come from classlist sync,
  // coaches are LE3 program-level humans. See migration 014.
  const { data: instructors } = await admin
    .from('instructor')
    .select('id, name, email, d2l_user_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  // ─── Coaches (LE3 program mentors) ───────────
  // Surfaced here so the dashboard distinction between coach and
  // instructor is visible.
  const { data: coaches } = await admin
    .from('coach')
    .select('id, name, email, status, auth_user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  // ─── Assignments (most recent) ────────────────
  const { data: assignments } = await admin
    .from('assignment')
    .select('id, title, work_type, course_id, brightspace_folder_id, due_date, active, synced_at')
    .order('synced_at', { ascending: false, nullsFirst: false })
    .limit(30)

  // ─── Student work from D2L sync ───────────────
  // This is the critical table for debugging — content_len=0 means
  // text extraction silently failed.
  const { data: workRaw } = await admin
    .from('student_work')
    .select(
      'id, student_id, assignment_id, title, content, grade, source, ' +
        'external_id, brightspace_submission_id, submitted_at, imported_at'
    )
    .eq('source', 'd2l_valence_sync')
    .order('imported_at', { ascending: false })
    .limit(30)

  // Transform content → content_len + preview so we don't ship
  // large document bodies back to the browser on every load.
  interface WorkRow {
    id: string
    student_id: string
    assignment_id: string | null
    title: string
    content: string | null
    grade: string | null
    source: string | null
    external_id: string | null
    brightspace_submission_id: string | null
    submitted_at: string | null
    imported_at: string | null
  }
  const workRows = (workRaw ?? []) as unknown as WorkRow[]
  const work = workRows.map(w => {
    const content = w.content
    return {
      id: w.id,
      student_id: w.student_id,
      assignment_id: w.assignment_id,
      title: w.title,
      grade: w.grade,
      source: w.source,
      external_id: w.external_id,
      brightspace_submission_id: w.brightspace_submission_id,
      submitted_at: w.submitted_at,
      imported_at: w.imported_at,
      content_len: content ? content.length : 0,
      content_preview: content
        ? content.substring(0, 140) + (content.length > 140 ? '…' : '')
        : null,
    }
  })

  // ─── Sync run history ─────────────────────────
  const { data: syncRuns } = await admin
    .from('sync_run')
    .select(
      'id, started_at, completed_at, status, source, mode, ' +
        'courses_synced, students_synced, assignments_synced, ' +
        'submissions_synced, submissions_skipped, errors_count, error_details'
    )
    .order('started_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    counts: {
      courses: courses?.length ?? 0,
      students: students?.length ?? 0,
      coaches: coaches?.length ?? 0,
      instructors: instructors?.length ?? 0,
      assignments: assignments?.length ?? 0,
      work: work.length,
      work_with_content: work.filter(w => w.content_len > 0).length,
      work_empty: work.filter(w => w.content_len === 0).length,
    },
    courses: courses ?? [],
    students: students ?? [],
    coaches: coaches ?? [],
    instructors: instructors ?? [],
    assignments: assignments ?? [],
    work,
    syncRuns: syncRuns ?? [],
  })
}
