import { redirect } from 'next/navigation'
import { getV2Identity } from '@/lib/v2-auth'

/**
 * /v2 root — redirects to the right Today view based on the real
 * authenticated role. Layout above already enforces auth.
 */
export default async function V2RootPage() {
  const identity = await getV2Identity()
  if (identity?.role === 'coach') redirect('/v2/coach')
  if (identity?.role === 'student') redirect('/v2/today')
  redirect('/login')
}
