import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirectWithSession } from '@/lib/auth/redirect-with-session'
import { ACTIVE_ROLE_COOKIE } from '@/lib/v2-auth'

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

  if (link.coach_id) {
    const { data: coach } = await admin
      .from('coach')
      .select('id, email, status')
      .eq('id', link.coach_id as string)
      .maybeSingle()
    if (!coach || coach.status !== 'active') return invalid(origin)

    const res = await redirectWithSession(admin, coach.email as string, '/v2/coach', origin)
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
