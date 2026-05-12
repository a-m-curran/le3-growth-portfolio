import { redirect } from 'next/navigation'
import { getCurrentStudent, getCurrentCoach } from '@/lib/queries'
import { AppShell } from '@/components/v2/AppShell'

/**
 * v2 layout: detects role server-side, hands off to the client
 * AppShell which renders the responsive sidebar / tab bar.
 *
 * Auth model:
 *   - If a coach record exists for the auth user → coach shell
 *   - Else if a student record exists → student shell
 *   - Else → redirect to /login
 *
 * Tools route (admin) is gated inside the shell via the showAdmin
 * flag — currently keyed off ADMIN_EMAILS env var so only the
 * builder sees it during this exploration.
 */
export default async function V2Layout({ children }: { children: React.ReactNode }) {
  const coach = await getCurrentCoach()
  if (coach) {
    return (
      <AppShell
        role="coach"
        userName={coach.name}
        userSubLabel="Coach"
        showAdmin={isAdminEmail(coach.email)}
      >
        {children}
      </AppShell>
    )
  }

  const student = await getCurrentStudent()
  if (student) {
    return (
      <AppShell
        role="student"
        userName={`${student.firstName} ${student.lastName}`.trim()}
        userSubLabel={student.cohort}
      >
        {children}
      </AppShell>
    )
  }

  redirect('/login')
}

function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS || ''
  if (!raw.trim()) return false
  const list = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return list.includes(email.toLowerCase())
}
