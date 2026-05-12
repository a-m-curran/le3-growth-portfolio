import { redirect } from 'next/navigation'
import { getV2Identity } from '@/lib/v2-auth'

/**
 * /v2 root — redirects to the right starting point based on identity.
 *
 *   coach identity     → /v2/coach
 *   student identity   → /v2/today
 *   no identity, demo  → /v2/demo (pick a persona)
 *   no identity, real  → /login
 */
export default async function V2RootPage() {
  const identity = await getV2Identity()
  if (identity?.role === 'coach') redirect('/v2/coach')
  if (identity?.role === 'student') redirect('/v2/today')
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') redirect('/v2/demo')
  redirect('/login')
}
