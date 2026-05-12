import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { students as staticStudents, coaches as staticCoaches } from '@/data'
import { PERSONA_COOKIE } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/v2/demo-as?persona=<id>
 *
 * Sets the v2 demo persona cookie and redirects to the appropriate
 * Today view for that role. Only effective when NEXT_PUBLIC_DEMO_MODE
 * is true — in real mode the cookie is ignored by getV2Identity().
 *
 * GET ?persona=clear unsets the cookie and redirects to /v2.
 *
 * No real auth required — this is for demo navigation, and the
 * persona it sets only takes effect in demo mode.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const persona = url.searchParams.get('persona')

  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return NextResponse.json(
      { error: 'Demo persona switching only works when NEXT_PUBLIC_DEMO_MODE=true' },
      { status: 400 }
    )
  }

  // Clear branch
  if (persona === 'clear' || !persona) {
    const res = NextResponse.redirect(new URL('/v2', req.url), 302)
    res.cookies.delete(PERSONA_COOKIE)
    return res
  }

  // Validate persona id against static seed so we don't honor arbitrary
  // values from the URL.
  const student = staticStudents.find(s => s.id === persona)
  const coach = staticCoaches.find(c => c.id === persona)
  if (!student && !coach) {
    return NextResponse.json(
      { error: `Unknown demo persona: ${persona}` },
      { status: 400 }
    )
  }

  // Where to land after setting the persona
  const target = student ? '/v2/today' : '/v2/coach'

  const cookieStore = cookies()
  cookieStore.set({
    name: PERSONA_COOKIE,
    value: persona,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 1 day — keeps the demo persona for a session, not forever
  })

  return NextResponse.redirect(new URL(target, req.url), 302)
}
