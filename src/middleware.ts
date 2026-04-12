import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  // Public routes — no auth required.
  //
  // Note: /onboarding and /api/onboarding have been removed. Self-service
  // account creation is no longer supported. Students arrive either via
  // Valence bulk sync (pre-populated before they first log in) or via a
  // signed LTI 1.3 launch from NLU's Brightspace instance. Admin access
  // for development is granted by the ADMIN_EMAILS env var, which
  // /api/auth/callback honors when a user's email is not otherwise
  // enrolled.
  if (
    pathname.startsWith('/demo') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/skills') ||
    pathname.startsWith('/api/lti') ||
    pathname.startsWith('/lti')
  ) {
    return res
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
