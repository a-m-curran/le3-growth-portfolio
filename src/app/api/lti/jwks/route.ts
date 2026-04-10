import { NextResponse } from 'next/server'
import { getPublicJwks } from '@/lib/lti/keys'

export const dynamic = 'force-dynamic'

/**
 * GET /api/lti/jwks
 *
 * Public JWKS endpoint used by the LTI platform (Brightspace) to verify
 * JWTs signed by this tool (deep linking responses, service client assertions).
 */
export async function GET() {
  try {
    const jwks = await getPublicJwks()
    return NextResponse.json(jwks, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('JWKS error:', error)
    return NextResponse.json({ error: 'LTI keys not configured' }, { status: 503 })
  }
}
