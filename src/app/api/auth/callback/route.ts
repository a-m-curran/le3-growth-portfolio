import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Magic-link auth callback.
 *
 * Gates access strictly to:
 *   1. Users who are already linked to a coach or student row
 *   2. Users whose email matches an unlinked coach or student row (created
 *      either by Valence sync or a prior LTI launch)
 *   3. Users whose email is in the ADMIN_EMAILS env var (dev/admin access)
 *
 * Anyone else is rejected: their orphan auth.users row is deleted so they
 * don't accumulate, and they're redirected to /login?error=not_enrolled.
 *
 * The previous self-serve /onboarding path has been removed — there are
 * no legitimate flows where an unenrolled user should be creating their
 * own student record. Real students arrive via Valence bulk sync (done
 * by a coach or scheduled task) or via a signed LTI launch JWT from
 * NLU's Brightspace instance.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If a `next` path is provided (e.g. from an LTI launch), honor it
  // in the final redirect after record linking.
  const nextPath = next && next.startsWith('/') ? next : null

  // Exchange code for session using the normal cookie-based client
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
  await supabase.auth.exchangeCodeForSession(code)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) {
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
    return NextResponse.redirect(new URL(nextPath || '/coach', request.url))
  }

  // 2. Already linked as student?
  const { data: linkedStudent } = await admin
    .from('student')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (linkedStudent) {
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
  await supabase.auth.signOut()
  try {
    await admin.auth.admin.deleteUser(user.id)
  } catch (err) {
    // Log but don't fail the redirect — the rejection itself is the important
    // part. The orphan will age out or can be cleaned up manually later.
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
