import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { ACTIVE_ROLE_COOKIE } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/v2/switch-role?role=student|coach|clear
 *
 * Dual-role humans only. Sets the le3-v2-active-role cookie so
 * getV2Identity resolves the chosen experience. The cookie is a
 * SELECTOR among roles the authenticated user provably owns — it never
 * grants a role (getV2Identity re-validates row ownership every
 * request, so a tampered cookie cannot escalate). ?role=clear unsets
 * it (→ coach-first default). Real Supabase auth required; the
 * persona-cookie set by /demo/aja and /demo/elizabeth is the demo
 * analog.
 *
 * Cookie attributes mirror the demo-persona cookie (same-site web set;
 * sameSite=lax, secure in production) — distinct from the LTI launch
 * set-site which mirrors lti_context (see api/lti/launch/route.ts).
 */
export async function POST(req: NextRequest) {
  const role = new URL(req.url).searchParams.get('role')

  // Clear branch — unset the selector (→ coach-first). Set on the
  // response object: a redirecting route handler does not inherit
  // next/headers cookie mutations.
  if (role === 'clear') {
    const res = NextResponse.redirect(new URL('/v2', req.url), 302)
    res.cookies.delete(ACTIVE_ROLE_COOKIE)
    return res
  }

  if (role !== 'student' && role !== 'coach') {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
  }

  // Resolve the REAL Supabase auth user (no persona path here).
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // no-op: called outside a mutable cookie scope
          }
        },
      },
    }
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Security spine: the user must actually OWN a row for the requested
  // role. Never trust the client.
  const admin = createAdminClient()
  const table = role === 'coach' ? 'coach' : 'student'
  const { data: owned } = await admin
    .from(table)
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!owned) {
    return NextResponse.json(
      { error: `You do not have a ${role} role` },
      { status: 403 }
    )
  }

  const target = role === 'coach' ? '/v2/coach' : '/v2/today'
  const response = NextResponse.redirect(new URL(target, req.url), 302)
  response.cookies.set({
    name: ACTIVE_ROLE_COOKIE,
    value: role,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
  })
  return response
}
