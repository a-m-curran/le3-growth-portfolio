import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { gatherSyncInspection } from '@/lib/sync/sync-inspect'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/sync-inspect
 *
 * Coach-only endpoint that returns a truthful snapshot of what is
 * actually in the DB: every headline number is a real `count(*)`
 * total (never a capped array length, which used to make healthy
 * syncs look truncated), while the row lists are bounded to the
 * most-recent slice so the response can never time out / OOM on the
 * ~3,000+ (and growing) student_work table.
 *
 * Data gathering lives in src/lib/sync/sync-inspect.ts so it is
 * unit-testable without an HTTP/auth round trip; this handler only
 * owns the auth + coach gate.
 */
export async function GET() {
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
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: coach } = await admin
    .from('coach')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!coach) {
    return NextResponse.json({ error: 'Coach access required' }, { status: 403 })
  }

  const inspection = await gatherSyncInspection(admin)
  return NextResponse.json(inspection)
}
