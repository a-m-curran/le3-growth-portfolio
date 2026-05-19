import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { rotatePasslink } from '@/lib/auth/passlink-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST /api/admin/passlinks/rotate {passlinkId} — revoke+mint one subject, return {url}. ADMIN_EMAILS-gated. */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.res
    const body = (await req.json().catch(() => ({}))) as { passlinkId?: string }
    if (!body.passlinkId) {
      return NextResponse.json({ error: 'passlinkId required' }, { status: 400 })
    }
    const admin = createAdminClient()
    const result = await rotatePasslink(admin, body.passlinkId, req.nextUrl.origin)
    if (result.status === 'error') {
      return NextResponse.json({ error: result.detail }, { status: 400 })
    }
    return NextResponse.json({ url: result.url, email: result.email, role: result.role })
  } catch (error) {
    console.error('passlinks/rotate error:', error)
    return NextResponse.json({ error: 'Rotate failed: ' + String(error) }, { status: 500 })
  }
}
