import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { revokeAllPasslinks } from '@/lib/auth/passlink-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST /api/admin/passlinks/revoke-all — kill every non-revoked link (pilot teardown). ADMIN_EMAILS-gated. */
export async function POST() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.res
    const admin = createAdminClient()
    const revoked = await revokeAllPasslinks(admin)
    return NextResponse.json({ revoked })
  } catch (error) {
    console.error('passlinks/revoke-all error:', error)
    return NextResponse.json({ error: 'Revoke-all failed: ' + String(error) }, { status: 500 })
  }
}
