import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createAdminClient } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Use admin client to bypass RLS for record linking
  const admin = createAdminClient()

  // Check if already linked as coach
  const { data: linkedCoach } = await admin
    .from('coach')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (linkedCoach) {
    return NextResponse.redirect(new URL(nextPath || '/coach', request.url))
  }

  // Check if already linked as student
  const { data: linkedStudent } = await admin
    .from('student')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (linkedStudent) {
    return NextResponse.redirect(new URL(nextPath || '/garden', request.url))
  }

  // Not linked yet — try to find by email and link
  const { data: unmatchedCoach } = await admin
    .from('coach')
    .select('id')
    .eq('email', user.email)
    .is('auth_user_id', null)
    .single()

  if (unmatchedCoach) {
    await admin
      .from('coach')
      .update({ auth_user_id: user.id })
      .eq('id', unmatchedCoach.id)
    return NextResponse.redirect(new URL(nextPath || '/coach', request.url))
  }

  const { data: unmatchedStudent } = await admin
    .from('student')
    .select('id')
    .eq('email', user.email)
    .is('auth_user_id', null)
    .single()

  if (unmatchedStudent) {
    await admin
      .from('student')
      .update({ auth_user_id: user.id })
      .eq('id', unmatchedStudent.id)
    return NextResponse.redirect(new URL(nextPath || '/garden', request.url))
  }

  // No existing record — send to onboarding
  return NextResponse.redirect(new URL('/onboarding', request.url))
}
