import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirectWithSession } from '@/lib/auth/redirect-with-session'
import { ACTIVE_ROLE_COOKIE, PERSONA_COOKIE } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STUDENT_LANDING = process.env.LTI_POST_LAUNCH_STUDENT_PATH || '/v2/today'

/**
 * GET /api/auth/passlink?t=<token>
 *
 * Permanent per-subject login link (no-email bridge). Validates the
 * token (SHA-256 hash lookup, non-revoked), resolves the subject
 * (coach XOR student), requires it active, then delegates to the
 * existing redirectWithSession → /api/auth/callback verifyOtp path.
 * Coach → /v2/coach (role coach); student → /v2/today (role student).
 * Public via the /api/auth middleware allowlist prefix (unchanged).
 *
 * Every failure redirects to the SAME generic /login?error=invalid_link
 * (no token/subject enumeration). Issued/revoked via the admin surface
 * and scripts/*-passlink.ts.
 *
 * Session hygiene: a passlink represents the subject the link was
 * issued to — clicking it should ALWAYS land you as that subject,
 * regardless of any existing session in the browser. Before redirecting
 * to the magic-link callback we explicitly sign out any existing
 * Supabase auth session AND clear the demo PERSONA_COOKIE, so the
 * callback's verifyOtp starts from a clean slate. Without this,
 * collisions between an existing coach/admin session and the new
 * student session would surface as "click passlink → land somewhere
 * other than the student's /v2/today" (see PR #25 + #26 thread).
 */
function invalid(origin: string): NextResponse {
  return NextResponse.redirect(new URL('/login?error=invalid_link', origin), 302)
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return invalid(origin)

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('auth_passlink')
    .select('id, coach_id, student_id, revoked_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle()

  if (!link) return invalid(origin)

  // Best-effort usage stamp; a failed stats write must not block sign-in.
  // Stamped here — for ANY valid, non-revoked token, BEFORE subject
  // resolution — so the coach and student branches share one stamp.
  // Semantics: "token presented & passed token-level validation".
  // NOTE: intentionally differs from 017's coach-only stamp (placed
  // AFTER the active-coach check); admin surfaces (Tasks 4/6) must read
  // last_used_at with THESE semantics, not the old coach-only meaning.
  await admin
    .from('auth_passlink')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', link.id as string)

  // Sign out any existing Supabase session so the magic-link callback
  // runs with a clean slate. supabase.auth.signOut() will produce a set
  // of "expire the auth cookies" entries via setAll; we capture them
  // and apply them to the final redirect response below (cookies set on
  // a non-cookies()-bound response aren't otherwise carried).
  const cookieStore = cookies()
  const clearCookies: Array<{
    name: string
    value: string
    options: Record<string, unknown>
  }> = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const c of cookiesToSet) {
            clearCookies.push({
              name: c.name,
              value: c.value,
              options: c.options as Record<string, unknown>,
            })
          }
        },
      },
    }
  )
  try {
    await supabase.auth.signOut()
  } catch {
    // Best-effort: if no existing session or sign-out fails, proceed.
    // The magic-link callback will set the new session cookies regardless;
    // failing to clear isn't fatal, it just risks the cross-session
    // collision this block is meant to prevent.
  }

  if (link.coach_id) {
    const { data: coach } = await admin
      .from('coach')
      .select('id, email, status')
      .eq('id', link.coach_id as string)
      .maybeSingle()
    if (!coach || coach.status !== 'active') return invalid(origin)

    const res = await redirectWithSession(admin, coach.email as string, '/v2/coach', origin)
    applySessionReset(res, clearCookies)
    res.cookies.set({
      name: ACTIVE_ROLE_COOKIE,
      value: 'coach',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 86400,
    })
    return res
  }

  if (link.student_id) {
    const { data: student } = await admin
      .from('student')
      .select('id, email, status')
      .eq('id', link.student_id as string)
      .maybeSingle()
    if (!student || student.status !== 'active') return invalid(origin)

    const res = await redirectWithSession(admin, student.email as string, STUDENT_LANDING, origin)
    applySessionReset(res, clearCookies)
    res.cookies.set({
      name: ACTIVE_ROLE_COOKIE,
      value: 'student',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 86400,
    })
    return res
  }

  return invalid(origin)
}

/**
 * Apply the captured signOut() clear-cookies to the response, plus
 * explicitly clear the demo PERSONA_COOKIE (supabase.signOut() doesn't
 * know about that one — it's our own cookie used to short-circuit
 * getV2Identity onto a demo persona).
 */
function applySessionReset(
  res: NextResponse,
  clearCookies: Array<{ name: string; value: string; options: Record<string, unknown> }>
): void {
  for (const c of clearCookies) {
    res.cookies.set(c.name, c.value, c.options)
  }
  res.cookies.set({
    name: PERSONA_COOKIE,
    value: '',
    path: '/',
    maxAge: 0,
  })
}
