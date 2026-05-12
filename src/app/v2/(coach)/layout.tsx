import { redirect } from 'next/navigation'
import { AppShell } from '@/components/v2/AppShell'
import { getV2Identity, isAdminEmail } from '@/lib/v2-auth'

/**
 * Coach-shell wrapper. Forces the coach sidebar regardless of role.
 *
 * Identity reflects the real authenticated user. ADMIN_EMAILS gate
 * controls whether Tools appears in the nav (coaches who aren't on
 * the allowlist don't see it).
 */
export default async function CoachGroupLayout({ children }: { children: React.ReactNode }) {
  const identity = await getV2Identity()
  if (!identity) {
    redirect(
      process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? '/v2/demo' : '/login'
    )
  }
  const name = identity.name
  const subLabel =
    identity.role === 'coach' ? 'Coach' : 'Previewing coach experience'

  const showAdmin = identity.role === 'coach' && isAdminEmail(identity.email)

  return (
    <AppShell role="coach" userName={name} userSubLabel={subLabel} showAdmin={showAdmin}>
      {children}
    </AppShell>
  )
}
