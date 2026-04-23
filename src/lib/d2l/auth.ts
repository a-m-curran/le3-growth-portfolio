/**
 * D2L Valence OAuth2 token exchange via JWT client assertion.
 *
 * Brightspace's modern OAuth 2.0 setup (the one registered via
 * Admin Tools → Manage Extensibility → OAuth 2.0 with a JWK URL)
 * does NOT issue a shared Client Secret. Instead, clients authenticate
 * by signing a JWT with their private key, which Brightspace verifies
 * against the public key fetched from the JWK URL we registered.
 *
 * We re-use our LTI key pair (LTI_PRIVATE_KEY + LTI_PUBLIC_KEY) for
 * Valence too, so one JWKS endpoint at /api/lti/jwks serves both
 * protocols. Brightspace will have fetched our public key once during
 * OAuth registration.
 *
 * Tokens are cached in-process until ~60 seconds before expiration.
 */

import { SignJWT } from 'jose'
import { getPrivateKey } from '@/lib/lti/keys'
import { getToolConfig } from '@/lib/lti/config'
import { getValenceConfig } from './config'

interface CachedToken {
  token: string
  expiresAt: number
}

let cache: CachedToken | null = null

/**
 * Scopes requested on every Valence token. Must match what the OAuth
 * app has been granted on the Brightspace side; the token endpoint
 * returns the intersection of requested and granted scopes.
 *
 * users:own_profile:read is required for /users/whoami (the service
 * user reading its own profile). users:profile:read lets us read
 * other users' profiles for enrichment. users:userdata:read covers
 * user data like grades and enrollments.
 */
const VALENCE_SCOPES = [
  'dropbox:folders:read',
  'dropbox:submissions:read',
  'dropbox:folder-attachments:read',
  'enrollment:orgunit:read',
  'users:own_profile:read',
  'users:profile:read',
  'users:userdata:read',
  'orgunit:children:read',
] as const

/**
 * Get a valid Valence OAuth2 access token, refreshing if needed.
 * Safe to call concurrently — refreshes are not deduplicated but the
 * race is benign (worst case, two tokens get minted and the first one
 * is overwritten in the cache).
 */
export async function getValenceToken(): Promise<string> {
  // Return cached token if still valid, with a 60-second safety margin
  if (cache && cache.expiresAt > Date.now() + 60_000) {
    return cache.token
  }

  const config = getValenceConfig()

  // Sign a client assertion JWT with our private key. Brightspace will
  // verify it against the public key at our JWK URL (which Brightspace
  // fetched once during OAuth registration).
  const clientAssertion = await signClientAssertion(config.clientId, config.tokenUrl)

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion,
    scope: VALENCE_SCOPES.join(' '),
  })

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(
      `Valence token request failed: ${res.status} ${res.statusText}. ${errText}`
    )
  }

  const data = (await res.json()) as {
    access_token: string
    token_type: string
    expires_in: number
  }

  if (!data.access_token) {
    throw new Error('Valence token response missing access_token')
  }

  cache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return data.access_token
}

/**
 * Force-clear the cached token. Useful in tests and after configuration
 * changes. Not typically needed in production — tokens refresh automatically.
 */
export function clearValenceTokenCache(): void {
  cache = null
}

// ─── JWT client assertion ──────────────────────────────

/**
 * Sign a client assertion JWT for the Valence OAuth2 token endpoint.
 *
 * Uses the same RSA private key + key ID we have for LTI — one key pair
 * serves both protocols. The JWT's iss and sub claims are the Valence
 * Client ID (not the LTI Client ID), and the aud is the Valence token URL.
 */
async function signClientAssertion(clientId: string, tokenUrl: string): Promise<string> {
  const privateKey = await getPrivateKey()
  const { keyId } = getToolConfig()

  const now = Math.floor(Date.now() / 1000)

  return await new SignJWT({
    iss: clientId,
    sub: clientId,
    aud: tokenUrl,
    iat: now,
    exp: now + 300, // 5 minutes — assertion JWT, tokens come back with their own expiry
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: 'RS256', kid: keyId, typ: 'JWT' })
    .sign(privateKey)
}
