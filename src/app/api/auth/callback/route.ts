import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
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

    // Determine role: check if user is a coach
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: coach } = await supabase
        .from('coach')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (coach) {
        return NextResponse.redirect(new URL('/coach', request.url))
      }
    }
  }

  return NextResponse.redirect(new URL('/garden', request.url))
}
