import { redirect } from 'next/navigation'
import { AppShell } from '@/components/v2/AppShell'
import { getV2Identity } from '@/lib/v2-auth'
import { DataConsentModal } from '@/components/student/DataConsentModal'

/**
 * Student-shell wrapper. Forces the student sidebar / bottom-tab-bar
 * regardless of the authenticated user's actual role.
 *
 * Redirects:
 *   - No identity at all → /v2/demo (persona picker) so anyone can
 *     start exploring without a real account.
 *   - Coach identity without a student persona cookie → /v2/demo so
 *     they pick a student persona to preview as. Coaches can browse
 *     the student IA, but they need to explicitly select WHICH
 *     student first — otherwise the API routes correctly return 401
 *     ("not a student"). This is the better default than silently
 *     surfacing demo data regardless of who you are.
 *   - Student identity → renders the student shell with their own
 *     data (real or demo persona, same code path).
 */
export default async function StudentGroupLayout({ children }: { children: React.ReactNode }) {
  const identity = await getV2Identity()
  if (!identity) {
    redirect('/v2/demo')
  }
  if (identity.role !== 'student') {
    redirect('/v2/demo')
  }

  const subLabel = identity.cohort

  return (
    <AppShell role="student" userName={identity.name} userSubLabel={subLabel} dualRole={identity.dualRole}>
      {children}
      <DataConsentModal />
    </AppShell>
  )
}
