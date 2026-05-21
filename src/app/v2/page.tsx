import { redirect } from 'next/navigation'
import { getV2Identity } from '@/lib/v2-auth'

/**
 * /v2 root — redirects to the right starting point based on identity.
 *
 *   coach identity     → /v2/coach
 *   student identity   → /v2/today
 *   no identity        → /login
 *
 * Demo personas are reached via direct links (/demo/aja for the student
 * persona, /demo/elizabeth for the coach persona); those routes set the
 * persona cookie which gives a real identity here.
 */
export default async function V2RootPage() {
  const identity = await getV2Identity()
  if (identity?.role === 'coach') redirect('/v2/coach')
  if (identity?.role === 'student') redirect('/v2/today')
  redirect('/login')
}
