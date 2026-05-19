import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * Generate a Supabase session for the user and redirect to our callback
 * to consume it.
 *
 * Implementation note: we use admin.generateLink with type='magiclink' to
 * mint a hashed token, then redirect to our own callback with that token.
 * The callback calls verifyOtp({ type: 'magiclink', token_hash }) to
 * exchange it for a session — that's the SSR-compatible flow.
 *
 * What does NOT work: redirecting to data.properties.action_link directly.
 * That URL goes through Supabase's hosted /auth/v1/verify handler which
 * doesn't return an OAuth `code` param to our callback (the action_link
 * either uses the implicit flow with URL fragments, which servers can't
 * read, or PKCE which our callback wasn't initiated for). Result: user
 * lands on /api/auth/callback with no recognizable auth params and gets
 * bounced to /login.
 */
export async function redirectWithSession(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  redirectPath: string,
  origin: string
): Promise<NextResponse> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (error || !data.properties?.hashed_token) {
    console.error('Failed to generate magic link:', error)
    return NextResponse.redirect(new URL('/login', origin), 302)
  }

  // Hand the hashed token to our callback in a query param. Callback
  // verifies it server-side and sets the session cookie on our domain.
  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
    next: redirectPath,
  })
  return NextResponse.redirect(
    new URL(`/api/auth/callback?${params.toString()}`, origin),
    302
  )
}
