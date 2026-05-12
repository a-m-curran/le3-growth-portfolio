import { redirect } from 'next/navigation'
import {
  getCurrentCoach,
  getCurrentStudent,
} from '@/lib/queries'
import { MeView } from './MeView'

/**
 * v2 Me — profile + account controls.
 *
 * Server component: resolves the current user (coach or student),
 * passes the relevant identity to the client view, which renders
 * account info and sign-out. Settings (notification preferences,
 * data-handling preferences re-show) are stubbed for now.
 */
export default async function V2MePage() {
  const coach = await getCurrentCoach()
  if (coach) {
    return (
      <MeView
        kind="coach"
        name={coach.name}
        email={coach.email}
        meta={coach.status === 'active' ? 'Active coach' : `Coach (${coach.status})`}
      />
    )
  }

  const student = await getCurrentStudent()
  if (student) {
    return (
      <MeView
        kind="student"
        name={`${student.firstName} ${student.lastName}`.trim()}
        email={student.email}
        meta={student.cohort || 'No cohort assigned'}
        nluId={student.nluId}
        programStartDate={student.programStartDate}
      />
    )
  }

  redirect('/login')
}
