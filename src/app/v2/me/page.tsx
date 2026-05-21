import { redirect } from 'next/navigation'
import { AppShell } from '@/components/v2/AppShell'
import { getV2Identity, isAdminEmail } from '@/lib/v2-auth'
import { MeView } from './MeView'

/**
 * v2 Me — profile + account controls.
 *
 * Lives outside the (student) and (coach) route groups because it's
 * accessible to both roles. Renders its own AppShell with role
 * picked from the real authenticated identity.
 */
export default async function V2MePage() {
  const identity = await getV2Identity()
  if (!identity) {
    redirect('/login')
  }

  const showAdmin =
    identity.role === 'coach' && isAdminEmail(identity.email)

  return (
    <AppShell
      role={identity.role}
      userName={identity.name}
      userSubLabel={identity.role === 'coach' ? 'Coach' : identity.cohort}
      showAdmin={showAdmin}
      dualRole={identity.dualRole}
    >
      {identity.role === 'coach' ? (
        <MeView
          kind="coach"
          name={identity.name}
          email={identity.email}
          meta="Active coach"
          dualRole={identity.dualRole}
        />
      ) : (
        <MeView
          kind="student"
          name={identity.name}
          email={identity.email}
          meta={identity.cohort || 'No cohort assigned'}
          dualRole={identity.dualRole}
        />
      )}
    </AppShell>
  )
}
