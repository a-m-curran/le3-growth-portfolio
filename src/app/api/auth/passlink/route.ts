import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirectWithSession } from '@/lib/auth/redirect-with-session'
import { ACTIVE_ROLE_COOKIE } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/auth/passlink?t=<token>
 *
 * Permanent per-coach login link — the no-email staff auth bridge.
 * Validates the token (SHA-256 hash lookup, non-revoked, coach active),
 * then delegates to the existing redirectWithSession → /api/auth/callback
 * verifyOtp path. No bespoke session handling. Public via the /api/auth
 * middleware allowlist prefix (middleware unchanged).
 *
 * Every failure redirects to the SAME generic /login?error=invalid_link
 * (no token enumeration). Issued/revoked via scripts/*-passlink.ts.
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
    .select('id, coach_id, revoked_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle()

  if (!link) return invalid(origin)

  const { data: coach } = await admin
    .from('coach')
    .select('id, email, status')
    .eq('id', link.coach_id as string)
    .maybeSingle()

  if (!coach || coach.status !== 'active') return invalid(origin)

  // Best-effort usage stamp; a failed stats write must not block sign-in.
  await admin
    .from('auth_passlink')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', link.id as string)

  const res = await redirectWithSession(
    admin,
    coach.email as string,
    '/v2/coach',
    origin
  )
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
