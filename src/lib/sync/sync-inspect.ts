/**
 * Truthful DB snapshot behind the admin Sync Inspector.
 *
 * Two hard rules, learned the hard way:
 *
 *  1. Headline counts are real `count(*)` totals — never the length of
 *     a capped fetched array. The old surface derived every count from
 *     `array.length` on a `.limit(30/50)` slice, which made a perfectly
 *     healthy sync (142 assignments, 50+ students) look permanently
 *     capped at ~30 and triggered repeated "is the sync truncating?"
 *     false alarms during the backfill.
 *
 *  2. Row lists stay bounded. Streaming thousands of student_work rows
 *     (~3,000+ now, growing) to the browser is the exact Vercel
 *     function timeout / memory blow-up this surface is meant to help
 *     diagnose — not reproduce. Each list is the most-recent
 *     {@link LIST_LIMIT} rows; the UI labels it as a recent slice while
 *     the counts above stay full totals.
 *
 * Framework-agnostic so it is unit-testable without an HTTP/auth round
 * trip (see scripts/test-sync-inspect.ts); the route only adds the
 * existing auth + coach gate on top.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Documented bounded slice size for every row list the inspector
 * returns. Counts are decoupled from this on purpose: they are always
 * the true `count(*)` total regardless of how many rows the list shows.
 */
export const LIST_LIMIT = 50

/** sync_run history is already a small bounded recent list — keep as-is. */
const SYNC_RUN_LIMIT = 10

const D2L_SOURCE = 'd2l_valence_sync'

export interface SyncInspectionCounts {
  courses: number
  /** Real students only (is_demo = false) — see note in gatherSyncInspection. */
  students: number
  coaches: number
  instructors: number
  assignments: number
  /** Total d2l_valence_sync student_work rows. */
  work: number
  /** d2l_valence_sync rows whose content has extracted text. */
  work_with_content: number
  /** d2l_valence_sync rows that landed with empty/null content. */
  work_empty: number
}

export interface InspectCourse {
  id: string
  name: string
  code: string | null
  quarter: string | null
  active: boolean
  brightspace_org_unit_id: string | null
  synced_at: string | null
}

export interface InspectStudent {
  id: string
  first_name: string
  last_name: string
  email: string
  nlu_id: string
  d2l_user_id: string | null
  coach_id: string | null
  cohort: string | null
  status: string
  created_at: string
}

export interface InspectCoach {
  id: string
  name: string
  email: string
  status: string
  auth_user_id: string | null
  created_at: string
}

export interface InspectInstructor {
  id: string
  name: string
  email: string
  d2l_user_id: string | null
  status: string
  created_at: string
}

export interface InspectAssignment {
  id: string
  title: string
  work_type: string | null
  course_id: string | null
  brightspace_folder_id: string | null
  due_date: string | null
  active: boolean
  synced_at: string | null
}

export interface InspectWork {
  id: string
  student_id: string
  assignment_id: string | null
  title: string
  grade: string | null
  source: string | null
  external_id: string | null
  brightspace_submission_id: string | null
  submitted_at: string | null
  imported_at: string | null
  content_len: number
  content_preview: string | null
}

export interface InspectSyncRun {
  id: string
  started_at: string
  completed_at: string | null
  status: string
  source: string
  mode: string
  courses_synced: number
  students_synced: number
  assignments_synced: number
  submissions_synced: number
  submissions_skipped: number
  errors_count: number
  error_details: unknown
}

export interface SyncInspection {
  counts: SyncInspectionCounts
  /** Bounded slice size applied to every list below (sync_run uses its own). */
  listLimit: number
  courses: InspectCourse[]
  students: InspectStudent[]
  coaches: InspectCoach[]
  instructors: InspectInstructor[]
  assignments: InspectAssignment[]
  work: InspectWork[]
  syncRuns: InspectSyncRun[]
}

interface WorkContentRow {
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

/**
 * Gather the truthful inspector snapshot: full `count(*)` totals plus
 * bounded most-recent row slices. Pure data access — no auth; the
 * caller (route) owns the coach gate.
 *
 * `students` is scoped to is_demo = false on both the count and the
 * list so the headline number matches the population the list samples
 * (the "Showing N of TOTAL" label would otherwise compare two
 * different populations). This mirrors the established convention in
 * src/lib/queries.ts.
 */
export async function gatherSyncInspection(
  admin: SupabaseClient
): Promise<SyncInspection> {
  // ─── Truthful counts: real count(*), never array.length ──────
  const [
    { count: courses },
    { count: students },
    { count: coaches },
    { count: instructors },
    { count: assignments },
    { count: work },
    { count: workWithContent },
  ] = await Promise.all([
    admin.from('course').select('*', { count: 'exact', head: true }),
    admin
      .from('student')
      .select('*', { count: 'exact', head: true })
      .eq('is_demo', false),
    admin.from('coach').select('*', { count: 'exact', head: true }),
    admin.from('instructor').select('*', { count: 'exact', head: true }),
    admin.from('assignment').select('*', { count: 'exact', head: true }),
    admin
      .from('student_work')
      .select('*', { count: 'exact', head: true })
      .eq('source', D2L_SOURCE),
    admin
      .from('student_work')
      .select('*', { count: 'exact', head: true })
      .eq('source', D2L_SOURCE)
      .not('content', 'is', null)
      .neq('content', ''),
  ])

  const workTotal = work ?? 0
  const workWith = workWithContent ?? 0
  // work_empty is the exact complement of work_with_content within the
  // d2l set, so work_with_content + work_empty === work always holds —
  // the invariant the Overview tab renders ("X of Y have text").
  const workEmpty = Math.max(0, workTotal - workWith)

  // ─── Bounded lists: most-recent LIST_LIMIT only ──────────────
  const [
    coursesRes,
    studentsRes,
    coachesRes,
    instructorsRes,
    assignmentsRes,
    workRes,
    syncRunsRes,
  ] = await Promise.all([
    admin
      .from('course')
      .select(
        'id, name, code, quarter, active, brightspace_org_unit_id, synced_at'
      )
      .order('synced_at', { ascending: false, nullsFirst: false })
      .limit(LIST_LIMIT),
    admin
      .from('student')
      .select(
        'id, first_name, last_name, email, nlu_id, d2l_user_id, coach_id, cohort, status, created_at'
      )
      .eq('is_demo', false)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
    admin
      .from('coach')
      .select('id, name, email, status, auth_user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
    admin
      .from('instructor')
      .select('id, name, email, d2l_user_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
    admin
      .from('assignment')
      .select(
        'id, title, work_type, course_id, brightspace_folder_id, due_date, active, synced_at'
      )
      .order('synced_at', { ascending: false, nullsFirst: false })
      .limit(LIST_LIMIT),
    admin
      .from('student_work')
      .select(
        'id, student_id, assignment_id, title, content, grade, source, ' +
          'external_id, brightspace_submission_id, submitted_at, imported_at'
      )
      .eq('source', D2L_SOURCE)
      .order('imported_at', { ascending: false })
      .limit(LIST_LIMIT),
    admin
      .from('sync_run')
      .select(
        'id, started_at, completed_at, status, source, mode, ' +
          'courses_synced, students_synced, assignments_synced, ' +
          'submissions_synced, submissions_skipped, errors_count, error_details'
      )
      .order('started_at', { ascending: false })
      .limit(SYNC_RUN_LIMIT),
  ])

  // Transform content → content_len + preview so document bodies are
  // never shipped to the browser (size + the OOM mode again).
  const workRows = (workRes.data ?? []) as unknown as WorkContentRow[]
  const workList: InspectWork[] = workRows.map(w => {
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

  return {
    counts: {
      courses: courses ?? 0,
      students: students ?? 0,
      coaches: coaches ?? 0,
      instructors: instructors ?? 0,
      assignments: assignments ?? 0,
      work: workTotal,
      work_with_content: workWith,
      work_empty: workEmpty,
    },
    listLimit: LIST_LIMIT,
    courses: (coursesRes.data ?? []) as unknown as InspectCourse[],
    students: (studentsRes.data ?? []) as unknown as InspectStudent[],
    coaches: (coachesRes.data ?? []) as unknown as InspectCoach[],
    instructors: (instructorsRes.data ?? []) as unknown as InspectInstructor[],
    assignments: (assignmentsRes.data ?? []) as unknown as InspectAssignment[],
    work: workList,
    syncRuns: (syncRunsRes.data ?? []) as unknown as InspectSyncRun[],
  }
}
