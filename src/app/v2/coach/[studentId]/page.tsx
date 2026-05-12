import { redirect } from 'next/navigation'
import {
  getCurrentCoach,
  getSessionPrep,
  getGardenData,
} from '@/lib/queries'
import { createAdminClient } from '@/lib/supabase-admin'
import { StudentDetailView } from './StudentDetailView'
import type { CoachNote, GardenData, SessionPrepData } from '@/lib/types'

interface Props {
  params: { studentId: string }
  searchParams: { tab?: string }
}

/**
 * v2 Student Detail — coach drilling into one student.
 *
 * Server component: confirms coach auth, fetches all tab data in
 * parallel, hands to the client StudentDetailView which renders the
 * header + tab switcher + tab content. Client-side tab switching so
 * there's no roundtrip per click.
 *
 * Tabs:
 *   prep       — recent conversations, patterns, active goals
 *   portfolio  — read-only Garden view
 *   notes      — chronological list of coach notes
 *
 * Default tab is `prep` (the "what to talk about" view that's most
 * useful right before a session).
 */
export default async function V2StudentDetailPage({ params, searchParams }: Props) {
  const coach = await getCurrentCoach()
  if (!coach) redirect('/login')

  // In demo mode, every query in queries.ts routes through static
  // data, so the demo-student id like 'stu_aja' works. In real mode,
  // params.studentId is a UUID.
  const [sessionPrep, garden, notes] = await Promise.all([
    getSessionPrep(coach.id, params.studentId).catch(() => null),
    getGardenData(params.studentId).catch(() => null),
    fetchCoachNotes(coach.id, params.studentId),
  ])

  if (!sessionPrep && !garden) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Student not found
          </h1>
          <p className="text-sm text-gray-600">
            This student isn&rsquo;t on your caseload, or the id doesn&rsquo;t exist.
          </p>
        </div>
      </div>
    )
  }

  // Prefer the prep view's student record (has firstName/lastName);
  // fall back to garden's student in case prep failed.
  const student = sessionPrep?.student || garden?.student
  if (!student) {
    redirect('/v2/coach/caseload')
  }

  const initialTab = (searchParams.tab as 'prep' | 'portfolio' | 'notes') || 'prep'

  return (
    <StudentDetailView
      student={{
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        cohort: student.cohort,
      }}
      sessionPrep={sessionPrep}
      garden={garden}
      notes={notes}
      initialTab={initialTab}
    />
  )
}

interface NoteRow {
  id: string
  note_text: string
  bright_spot: string | null
  next_step: string | null
  session_date: string
  quarter: string
  contact_method: string
}

async function fetchCoachNotes(coachId: string, studentId: string): Promise<CoachNote[]> {
  // Demo mode: surface only the lastNote that getSessionPrep already
  // returned; full notes history isn't a separate static fetch.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('coach_note')
    .select('id, note_text, bright_spot, next_step, session_date, quarter, contact_method')
    .eq('coach_id', coachId)
    .eq('student_id', studentId)
    .order('session_date', { ascending: false })
  const rows = (data ?? []) as unknown as NoteRow[]

  return rows.map(n => ({
    id: n.id,
    coachId,
    studentId,
    noteText: n.note_text,
    brightSpot: n.bright_spot ?? undefined,
    nextStep: n.next_step ?? undefined,
    sessionDate: n.session_date,
    quarter: n.quarter,
    contactMethod: n.contact_method,
  })) as CoachNote[]
}

// Keep types imported (TypeScript would otherwise warn about unused)
export type _UnusedTypeChecks = SessionPrepData | GardenData | CoachNote
