import { redirect } from 'next/navigation'
import { AppShell } from '@/components/v2/AppShell'
import { getV2Identity } from '@/lib/v2-auth'

/**
 * Student-shell wrapper. Forces the student sidebar / bottom-tab-bar
 * regardless of the authenticated user's actual role — so a coach
 * previewing the demo can browse /v2/today, /v2/garden, etc. and
 * experience the student IA.
 *
 * The shell's identity (name + sub-label in the sidebar) always shows
 * the real authenticated user. Data on each page handles demo mode
 * separately (via the API endpoints' demo short-circuits).
 */
export default async function StudentGroupLayout({ children }: { children: React.ReactNode }) {
  const identity = await getV2Identity()
  // Auth gate: if no identity (no real auth AND no demo persona),
  // bounce to demo entry in demo mode or login otherwise.
  if (!identity) {
    redirect(
      process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? '/v2/demo' : '/login'
    )
  }
  const name = identity.name
  const subLabel =
    identity.role === 'student'
      ? identity.cohort
      : 'Previewing student experience'

  return (
    <AppShell role="student" userName={name} userSubLabel={subLabel}>
      {children}
    </AppShell>
  )
}
