import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/observability/logger'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Magic-link auth callback.
 *
 * Handles two distinct entry shapes:
 *
 *   A. token_hash + type — produced by `admin.auth.admin.generateLink`
 *      (the LTI launch flow, plus any other server-initiated sign-in).
 *      Verified via `supabase.auth.verifyOtp({ token_hash, type })`.
 *
 *   B. code — produced by an OAuth-style sign-in (PKCE flow). Verified
 *      via `supabase.auth.exchangeCodeForSession(code)`. Used by any
 *      future OAuth providers; not currently the LTI path.
 *
 * After verification, gates access strictly to:
 *   1. Users who are already linked to a coach or student row
 *   2. Users whose email matches an unlinked coach or student row (created
 *      either by Valence sync or a prior LTI launch)
 *   3. Users whose email is in the ADMIN_EMAILS env var (dev/admin access)
 *
 * Anyone else is rejected: their orphan auth.users row is deleted so they
 * don't accumulate, and they're redirected to /login?error=not_enrolled.
 */
export async function GET(request: Request) {
  const reqLog = log.withRequest()
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const tokenType = searchParams.get('type')
  const next = searchParams.get('next')

  await reqLog.info('auth.callback_received', {
    message: code
      ? 'OAuth code flow'
      : tokenHash
      ? `OTP token_hash flow (type=${tokenType})`
      : 'No auth params present',
    context: {
      has_code: !!code,
      has_token_hash: !!tokenHash,
      type: tokenType,
      has_next: !!next,
      next,
    },
  })

  if (!code && !tokenHash) {
    await reqLog.warn('auth.callback_failed', {
      message: 'Callback hit with no code and no token_hash — bouncing to /login',
    })
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If a `next` path is provided (e.g. from an LTI launch), honor it
  // in the final redirect after record linking.
  const nextPath = next && next.startsWith('/') ? next : null

  // Cookie-based Supabase client for setting session cookies.
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
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  if (tokenHash && tokenType) {
    // Token-hash flow (LTI launch path). Verify the hash and let
    // Supabase set the session cookie on our domain.
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tokenType as EmailOtpType,
    })
    if (otpError) {
      await reqLog.error('auth.callback_failed', {
        message: `verifyOtp failed: ${otpError.message}`,
        context: { type: tokenType, error: otpError.message },
      })
      return NextResponse.redirect(
        new URL('/login?error=auth_token_invalid', request.url)
      )
    }
  } else if (code) {
    const { error: codeError } = await supabase.auth.exchangeCodeForSession(code)
    if (codeError) {
      await reqLog.error('auth.callback_failed', {
        message: `exchangeCodeForSession failed: ${codeError.message}`,
        context: { error: codeError.message },
      })
      return NextResponse.redirect(
        new URL('/login?error=auth_code_invalid', request.url)
      )
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) {
    await reqLog.warn('auth.callback_failed', {
      message: 'Session established but user/email missing afterwards',
    })
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const email = user.email.toLowerCase()

  // Use admin client to bypass RLS for record linking
  const admin = createAdminClient()

  // 1. Already linked as coach?
  const { data: linkedCoach } = await admin
    .from('coach')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (linkedCoach) {
    await reqLog.info('auth.signed_in', {
      actorType: 'coach',
      actorId: linkedCoach.id as string,
      message: `Coach signed in (already linked): ${email}`,
      context: { email, redirect_to: nextPath || '/coach' },
    })
    return NextResponse.redirect(new URL(nextPath || '/coach', request.url))
  }

  // 2. Already linked as student?
  const { data: linkedStudent } = await admin
    .from('student')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (linkedStudent) {
    await reqLog.info('auth.signed_in', {
      actorType: 'student',
      actorId: user.id,
      studentId: linkedStudent.id as string,
      message: `Student signed in (already linked): ${email}`,
      context: { email, redirect_to: nextPath || '/garden' },
    })
    return NextResponse.redirect(new URL(nextPath || '/garden', request.url))
  }

  // 3. Unlinked coach matching this email?
  const { data: unmatchedCoach } = await admin
    .from('coach')
    .select('id')
    .eq('email', email)
    .is('auth_user_id', null)
    .maybeSingle()

  if (unmatchedCoach) {
    await admin
      .from('coach')
      .update({ auth_user_id: user.id })
      .eq('id', unmatchedCoach.id)
    await reqLog.info('auth.signed_in', {
      actorType: 'coach',
      actorId: unmatchedCoach.id as string,
      message: `Coach signed in (claimed unlinked record): ${email}`,
      context: { email, redirect_to: nextPath || '/coach' },
    })
    return NextResponse.redirect(new URL(nextPath || '/coach', request.url))
  }

  // 4. Unlinked student matching this email?
  const { data: unmatchedStudent } = await admin
    .from('student')
    .select('id')
    .eq('email', email)
    .is('auth_user_id', null)
    .maybeSingle()

  if (unmatchedStudent) {
    await admin
      .from('student')
      .update({ auth_user_id: user.id })
      .eq('id', unmatchedStudent.id)
    await reqLog.info('auth.signed_in', {
      actorType: 'student',
      actorId: user.id,
      studentId: unmatchedStudent.id as string,
      message: `Student signed in (claimed unlinked record): ${email}`,
      context: { email, redirect_to: nextPath || '/garden' },
    })
    return NextResponse.redirect(new URL(nextPath || '/garden', request.url))
  }

  // 5. Admin allowlist fallback (dev/admin access)
  if (isAdminEmail(email)) {
    // Auto-provision the admin as an active coach so they can access the
    // coach dashboard. Only creates the row if it doesn't already exist.
    const { data: newCoach, error: coachInsertError } = await admin
      .from('coach')
      .insert({
        auth_user_id: user.id,
        name: deriveNameFromEmail(email),
        email,
        status: 'active',
      })
      .select('id')
      .single()

    if (!coachInsertError && newCoach) {
      console.log(`Admin coach provisioned via ADMIN_EMAILS: ${email}`)
      return NextResponse.redirect(new URL(nextPath || '/coach', request.url))
    }
    // If the coach insert failed for some reason, fall through to rejection
    console.error('Failed to provision admin coach:', coachInsertError)
  }

  // 6. Reject — no enrollment match, not on admin list
  // Sign out the current session and delete the orphaned auth user so the
  // rejected user doesn't accumulate Supabase auth rows on repeated attempts.
  await reqLog.warn('auth.callback_rejected', {
    actorType: 'anonymous',
    message: `Authenticated email not enrolled as coach or student: ${email}`,
    context: { email },
  })
  await supabase.auth.signOut()
  try {
    await admin.auth.admin.deleteUser(user.id)
  } catch (err) {
    console.error(`Failed to delete orphan auth user ${user.id}:`, err)
  }

  return NextResponse.redirect(new URL('/login?error=not_enrolled', request.url))
}

// ─── helpers ─────────────────────────────────────────

function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS || ''
  if (!raw.trim()) return false
  const list = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return list.includes(email)
}

function deriveNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'Admin'
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Admin'
  )
}
