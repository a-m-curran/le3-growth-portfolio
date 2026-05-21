import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PERSONA_COOKIE = 'le3-v2-demo-persona'

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

  // /demo above covers the two direct-link demo routes (/demo/aja and
  // /demo/elizabeth). Each sets the persona cookie and redirects into
  // the relevant v2 shell — both must be reachable without a Supabase
  // session for stakeholder demo links to work in fresh browsers.

  // Demo persona cookie pass-through. v2-auth.ts treats the persona
  // cookie as a first-class identity (it looks up the matching is_demo
  // student/coach row by demo_slug). Without this exemption, persona
  // visits to /v2/today, /v2/coach, and friends would dead-end at /login
  // because no Supabase session exists. The cookie is httpOnly and only
  // settable by the /demo/aja and /demo/elizabeth routes, and v2-auth.ts
  // validates the slug against the DB on every request — so a tampered
  // cookie still resolves to no identity and the downstream layout
  // redirects to /login. Middleware just lets the request through.
  if (req.cookies.get(PERSONA_COOKIE)?.value) {
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
