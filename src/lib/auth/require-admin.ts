import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { isAdminEmail } from '@/lib/v2-auth'

/**
 * Admin gate for /api/admin/passlinks/* routes. Verbatim pattern from
 * /api/admin/recover-extractions: authenticated coach AND
 * isAdminEmail(coach.email). Defense-in-depth — middleware already
 * session-gates /api/admin (it is not in the public allowlist).
 *
 * Returns a discriminated result: { ok: true, adminEmail } or
 * { ok: false, res } where res is the 401/403 to return directly.
 */
export async function requireAdmin(): Promise<
  { ok: true; adminEmail: string } | { ok: false; res: NextResponse }
> {
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

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, res: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data: coach } = await admin
    .from('coach')
    .select('email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!coach || !isAdminEmail(coach.email as string)) {
    return { ok: false, res: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }

  return { ok: true, adminEmail: coach.email as string }
}
