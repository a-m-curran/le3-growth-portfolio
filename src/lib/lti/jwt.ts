/**
 * LTI 1.3 JWT verification and signing
 */

import { jwtVerify, SignJWT, createRemoteJWKSet } from 'jose'
import { getPlatformConfig, getToolConfig } from './config'
import { getPrivateKey } from './keys'
import type { LtiJwtPayload } from './claims'

// Cached JWKS for the platform — jose handles periodic refresh
let platformJwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getPlatformJwks() {
  if (!platformJwks) {
    const { jwksUrl } = getPlatformConfig()
    platformJwks = createRemoteJWKSet(new URL(jwksUrl))
  }
  return platformJwks
}

/**
 * Verify a JWT received from the LTI platform (Brightspace).
 * Validates signature, issuer, audience, expiration, and nonce.
 */
export async function verifyPlatformJwt(
  token: string,
  expectedNonce?: string
): Promise<LtiJwtPayload> {
  const { issuer, clientId } = getPlatformConfig()
  const jwks = getPlatformJwks()

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: clientId,
  })

  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error('LTI JWT nonce mismatch')
  }

  return payload as unknown as LtiJwtPayload
}

/**
 * Sign a JWT issued by our tool — used for deep linking responses
 * and AGS service token requests.
 */
export async function signToolJwt(
  claims: Record<string, unknown>,
  expiresInSeconds = 60
): Promise<string> {
  const privateKey = await getPrivateKey()
  const { keyId } = getToolConfig()
  const { clientId, issuer } = getPlatformConfig()

  const now = Math.floor(Date.now() / 1000)

  return await new SignJWT({
    iss: clientId,
    sub: clientId,
    aud: issuer,
    iat: now,
    exp: now + expiresInSeconds,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: keyId, typ: 'JWT' })
    .sign(privateKey)
}

/**
 * Sign a Deep Linking response JWT.
 * Returned to the platform when an instructor completes a deep linking flow.
 */
export async function signDeepLinkingResponse(
  deploymentId: string,
  contentItems: Record<string, unknown>[],
  data?: string
): Promise<string> {
  const privateKey = await getPrivateKey()
  const { keyId } = getToolConfig()
  const { clientId, issuer } = getPlatformConfig()

  const now = Math.floor(Date.now() / 1000)

  const payload: Record<string, unknown> = {
    iss: clientId,
    aud: issuer,
    iat: now,
    exp: now + 600,
    nonce: crypto.randomUUID(),
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': deploymentId,
    'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': contentItems,
  }

  if (data) {
    payload['https://purl.imsglobal.org/spec/lti-dl/claim/data'] = data
  }

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: keyId, typ: 'JWT' })
    .sign(privateKey)
}

/**
 * Generate random state and nonce for the OIDC login flow.
 */
export function generateStateAndNonce(): { state: string; nonce: string } {
  return {
    state: crypto.randomUUID(),
    nonce: crypto.randomUUID(),
  }
}
