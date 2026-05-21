import { NextResponse } from 'next/server'
import { PERSONA_COOKIE } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /demo/aja — direct-link demo as the student persona Aja Williams.
 *
 * Sets the persona cookie (stu_aja) and redirects to /v2/today. Anyone
 * with the link gets the student experience as Aja — no Supabase login,
 * no picker. The persona row in `student` carries is_demo=true so it
 * stays out of real-cohort views.
 *
 * IMPORTANT: cookie must be set on the response object, not via
 * cookies() from next/headers. NextResponse.redirect returns a fresh
 * response that doesn't inherit request-store mutations, so a cookie
 * set via the helper never makes it to the browser.
 */
export async function GET(req: Request) {
  const response = NextResponse.redirect(new URL('/v2/today', req.url), 302)
  response.cookies.set({
    name: PERSONA_COOKIE,
    value: 'stu_aja',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
  })
  return response
}
