import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getPasslinkRoster } from '@/lib/auth/passlink-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/admin/passlinks — roster + status (NO urls). ADMIN_EMAILS-gated. */
export async function GET() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.res
    const admin = createAdminClient()
    const roster = await getPasslinkRoster(admin)
    return NextResponse.json({ roster })
  } catch (error) {
    console.error('passlinks/roster error:', error)
    return NextResponse.json({ error: 'Roster failed: ' + String(error) }, { status: 500 })
  }
}
