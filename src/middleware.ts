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
    pathname === '/v2/demo' ||
    pathname.startsWith('/v2/demo/') ||
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

  // Note on /v2/demo above: the page is intentionally public (it's the
  // persona picker for demo-without-account exploration; see its own
  // page.tsx header comment). Without this exemption, unauthenticated
  // visits hit the no-session branch below and get bounced to /login,
  // which in turn breaks the passlink → callback → /v2/today flow when
  // the (student) layout redirects a non-student identity to /v2/demo
  // (an intentional UX path that becomes a /login dead-end without this
  // exemption). Match the exact path AND `/v2/demo/...` rather than a
  // bare `startsWith('/v2/demo')` so we don't accidentally allowlist a
  // future hypothetical /v2/demoXxx.

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
