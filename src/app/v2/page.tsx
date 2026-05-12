import { redirect } from 'next/navigation'
import { getCurrentStudent, getCurrentCoach } from '@/lib/queries'

/**
 * /v2 root — redirects to the right Today view based on role.
 * Layout above already enforces auth; this is just the
 * coach-vs-student fork.
 */
export default async function V2RootPage() {
  const coach = await getCurrentCoach()
  if (coach) redirect('/v2/coach')

  const student = await getCurrentStudent()
  if (student) redirect('/v2/today')

  redirect('/login')
}
