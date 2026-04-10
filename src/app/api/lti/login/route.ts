import { NextRequest, NextResponse } from 'next/server'
import { getPlatformConfig, getToolConfig } from '@/lib/lti/config'
import { generateStateAndNonce } from '@/lib/lti/jwt'

export const dynamic = 'force-dynamic'

/**
 * OIDC Login Initiation — both GET and POST per LTI 1.3 spec.
 *
 * Brightspace calls this endpoint when a student clicks an LTI link.
 * We generate state + nonce, store them in cookies, and redirect
 * the browser to the platform's auth endpoint for the ID token request.
 */
async function handleLogin(params: URLSearchParams): Promise<NextResponse> {
  try {
    const { issuer, clientId, authUrl } = getPlatformConfig()
    const { toolUrl } = getToolConfig()

    const iss = params.get('iss')
    const loginHint = params.get('login_hint')
    const targetLinkUri = params.get('target_link_uri')
    const ltiMessageHint = params.get('lti_message_hint')
    const clientIdParam = params.get('client_id')
    const deploymentIdParam = params.get('lti_deployment_id')

    if (!iss || !loginHint) {
      return NextResponse.json(
        { error: 'Missing required OIDC parameters (iss, login_hint)' },
        { status: 400 }
      )
    }

    // Verify issuer matches what we're configured for
    if (iss !== issuer) {
      return NextResponse.json(
        { error: `Unexpected issuer: ${iss}` },
        { status: 400 }
      )
    }

    // If platform sent client_id, verify it matches ours
    if (clientIdParam && clientIdParam !== clientId) {
      return NextResponse.json(
        { error: 'client_id mismatch' },
        { status: 400 }
      )
    }

    const { state, nonce } = generateStateAndNonce()

    const authParams = new URLSearchParams({
      response_type: 'id_token',
      response_mode: 'form_post',
      scope: 'openid',
      client_id: clientId,
      redirect_uri: `${toolUrl}/api/lti/launch`,
      login_hint: loginHint,
      state,
      nonce,
      prompt: 'none',
    })

    if (ltiMessageHint) authParams.set('lti_message_hint', ltiMessageHint)
    if (targetLinkUri) authParams.set('target_link_uri', targetLinkUri)
    if (deploymentIdParam) authParams.set('lti_deployment_id', deploymentIdParam)

    const redirectUrl = `${authUrl}?${authParams.toString()}`

    const response = NextResponse.redirect(redirectUrl, 302)

    // SameSite=None required for cross-site POST from Brightspace to our launch endpoint
    const cookieOpts = {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      maxAge: 600,
      path: '/',
    }

    response.cookies.set('lti_state', state, cookieOpts)
    response.cookies.set('lti_nonce', nonce, cookieOpts)

    return response
  } catch (error) {
    console.error('LTI login error:', error)
    return NextResponse.json(
      { error: 'LTI login initiation failed: ' + String(error) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  return handleLogin(req.nextUrl.searchParams)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const params = new URLSearchParams()
  formData.forEach((value, key) => {
    if (typeof value === 'string') params.set(key, value)
  })
  return handleLogin(params)
}
