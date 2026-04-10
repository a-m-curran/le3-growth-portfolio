/**
 * OAuth2 service token exchange for LTI Advantage services.
 *
 * When calling server-to-server endpoints (AGS, Asset Service, Report Service,
 * Notice Handlers registration), we need an access token from the platform.
 * This uses the Client Credentials Grant with a signed JWT client assertion.
 *
 * Spec: IMS Security Framework 1.0
 */

import { signToolJwt } from './jwt'
import { getPlatformConfig } from './config'

interface CachedToken {
  token: string
  expiresAt: number
  scopes: string
}

const tokenCache = new Map<string, CachedToken>()

/**
 * Request (or reuse) a service access token from the platform with the
 * given scopes. Tokens are cached in-memory until ~60s before expiration.
 */
export async function getServiceToken(scopes: string[]): Promise<string> {
  const scopeKey = [...scopes].sort().join(' ')

  // Return cached token if still valid (60s buffer)
  const cached = tokenCache.get(scopeKey)
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token
  }

  const { tokenUrl, clientId } = getPlatformConfig()

  // Client assertion JWT — proves we are the registered client.
  // aud = platform token endpoint, iss/sub = our client_id.
  const clientAssertion = await signToolJwt(
    {
      iss: clientId,
      sub: clientId,
      aud: tokenUrl,
      jti: crypto.randomUUID(),
    },
    300
  )

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion,
    scope: scopeKey,
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Service token request failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
    token_type: string
  }

  const expiresAt = Date.now() + data.expires_in * 1000
  tokenCache.set(scopeKey, {
    token: data.access_token,
    expiresAt,
    scopes: scopeKey,
  })

  return data.access_token
}

/**
 * Common LTI Advantage scopes.
 */
export const SCOPES = {
  NOTICE_HANDLERS: 'https://purl.imsglobal.org/spec/lti/scope/noticehandlers',
  ASSET_READONLY: 'https://purl.imsglobal.org/spec/lti/scope/asset.readonly',
  REPORT: 'https://purl.imsglobal.org/spec/lti/scope/report',
  AGS_LINEITEM_READONLY:
    'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  AGS_RESULT_READONLY:
    'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
} as const
