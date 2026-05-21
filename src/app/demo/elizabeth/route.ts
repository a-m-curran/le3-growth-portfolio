import { NextResponse } from 'next/server'
import { PERSONA_COOKIE } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /demo/elizabeth — direct-link demo as the coach persona
 * Elizabeth Chen.
 *
 * Sets the persona cookie (coach_elizabeth) and redirects to /v2/coach.
 * Anyone with the link gets the coach experience as Elizabeth — no
 * Supabase login, no picker. The persona row in `coach` carries
 * is_demo=true so it stays out of real-cohort views.
 *
 * Cookie set on the response object — see /demo/aja/route.ts for the
 * reason (NextResponse.redirect doesn't inherit cookies() mutations).
 */
export async function GET(req: Request) {
  const response = NextResponse.redirect(new URL('/v2/coach', req.url), 302)
  response.cookies.set({
    name: PERSONA_COOKIE,
    value: 'coach_elizabeth',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
  })
  return response
}
