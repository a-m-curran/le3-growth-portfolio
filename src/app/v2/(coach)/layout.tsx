import { redirect } from 'next/navigation'
import { AppShell } from '@/components/v2/AppShell'
import { getV2Identity, isAdminEmail } from '@/lib/v2-auth'

/**
 * Coach-shell wrapper. Forces the coach sidebar.
 *
 * Redirects:
 *   - No identity → /v2/demo (persona picker).
 *   - Student identity → /v2/demo so they pick a coach persona to
 *     preview as. Same shape as the student layout — explicit persona
 *     selection beats silently leaking demo data.
 *   - Coach identity → renders the coach shell. Tools nav item is
 *     gated by ADMIN_EMAILS allowlist.
 */
export default async function CoachGroupLayout({ children }: { children: React.ReactNode }) {
  const identity = await getV2Identity()
  if (!identity) {
    redirect('/v2/demo')
  }
  if (identity.role !== 'coach') {
    redirect('/v2/demo')
  }

  const showAdmin = isAdminEmail(identity.email)

  return (
    <AppShell role="coach" userName={identity.name} userSubLabel="Coach" showAdmin={showAdmin} dualRole={identity.dualRole}>
      {children}
    </AppShell>
  )
}
