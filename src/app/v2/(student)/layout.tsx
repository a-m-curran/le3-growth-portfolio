import { redirect } from 'next/navigation'
import { AppShell } from '@/components/v2/AppShell'
import { getV2Identity } from '@/lib/v2-auth'
import { DataConsentModal } from '@/components/student/DataConsentModal'

/**
 * Student-shell wrapper. Forces the student sidebar / bottom-tab-bar
 * regardless of the authenticated user's actual role.
 *
 * Redirects:
 *   - No identity at all → /login. Demo viewers should arrive via the
 *     direct-link routes (/demo/aja, /demo/elizabeth), which set the
 *     persona cookie and land them in the right shell.
 *   - Coach identity (no student persona cookie) → /login. The student
 *     IA is for student identities; coaches who want to preview as a
 *     student should hit /demo/aja.
 *   - Student identity → renders the student shell with their own
 *     data (real or demo persona, same code path).
 */
export default async function StudentGroupLayout({ children }: { children: React.ReactNode }) {
  const identity = await getV2Identity()
  if (!identity) {
    redirect('/login')
  }
  if (identity.role !== 'student') {
    redirect('/login')
  }

  const subLabel = identity.cohort

  return (
    <AppShell role="student" userName={identity.name} userSubLabel={subLabel} dualRole={identity.dualRole}>
      {children}
      <DataConsentModal />
    </AppShell>
  )
}
