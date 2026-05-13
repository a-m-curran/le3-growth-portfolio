import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { PERSONA_COOKIE } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/v2/demo-as?persona=<slug>
 *
 * Sets the v2 demo persona cookie and redirects to the appropriate
 * Today view for that role.
 *
 * Validation: the persona slug must match an `is_demo = true` row's
 * `demo_slug` in the DB (student or coach). This prevents arbitrary
 * URL values from being honored. After the cutover, demo data lives
 * in the same DB real students will use; the is_demo flag is what
 * gates real-cohort exposure.
 *
 * GET ?persona=clear unsets the cookie and redirects to /v2.
 *
 * No real auth required — demo personas are intentionally accessible
 * to stakeholders demoing the product. The is_demo flag keeps demo
 * personas out of real coach caseloads and analytics.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const persona = url.searchParams.get('persona')

  // Clear branch
  if (persona === 'clear' || !persona) {
    const res = NextResponse.redirect(new URL('/v2', req.url), 302)
    res.cookies.delete(PERSONA_COOKIE)
    return res
  }

  // Validate against the DB — demo_slug must match an is_demo row
  const admin = createAdminClient()
  const [{ data: student }, { data: coach }] = await Promise.all([
    admin
      .from('student')
      .select('id')
      .eq('demo_slug', persona)
      .eq('is_demo', true)
      .maybeSingle(),
    admin
      .from('coach')
      .select('id')
      .eq('demo_slug', persona)
      .eq('is_demo', true)
      .maybeSingle(),
  ])

  if (!student && !coach) {
    return NextResponse.json(
      { error: `Unknown demo persona: ${persona}` },
      { status: 400 }
    )
  }

  // Where to land after setting the persona
  const target = student ? '/v2/today' : '/v2/coach'

  // IMPORTANT: set the cookie on the response object, not via
  // cookies() from next/headers. In a route handler, cookies().set
  // attaches to the request-scoped store — a NextResponse.redirect
  // returns a *new* response and doesn't inherit those mutations,
  // so the Set-Cookie header never makes it to the browser and the
  // persona never persists. Setting via response.cookies works.
  const response = NextResponse.redirect(new URL(target, req.url), 302)
  response.cookies.set({
    name: PERSONA_COOKIE,
    value: persona,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 1 day — session-scoped marker
  })
  return response
}
