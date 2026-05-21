import { redirect } from 'next/navigation'
import { AppShell } from '@/components/v2/AppShell'
import { getV2Identity, isAdminEmail } from '@/lib/v2-auth'

/**
 * Coach-shell wrapper. Forces the coach sidebar.
 *
 * Redirects:
 *   - No identity → /login. Demo viewers should arrive via
 *     /demo/elizabeth (coach persona) — the direct link sets the
 *     persona cookie and lands them in the right shell.
 *   - Student identity → /login. The coach IA is for coach identities;
 *     students who want to preview the coach view should hit
 *     /demo/elizabeth.
 *   - Coach identity → renders the coach shell. Tools nav item is
 *     gated by ADMIN_EMAILS allowlist.
 */
export default async function CoachGroupLayout({ children }: { children: React.ReactNode }) {
  const identity = await getV2Identity()
  if (!identity) {
    redirect('/login')
  }
  if (identity.role !== 'coach') {
    redirect('/login')
  }

  const showAdmin = isAdminEmail(identity.email)

  return (
    <AppShell role="coach" userName={identity.name} userSubLabel="Coach" showAdmin={showAdmin} dualRole={identity.dualRole}>
      {children}
    </AppShell>
  )
}
