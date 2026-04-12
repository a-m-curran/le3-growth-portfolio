/**
 * D2L Valence OAuth2 client credentials flow.
 *
 * Brightspace's Valence API uses OAuth2 client credentials grant for
 * server-to-server integrations. We POST client_id + client_secret to
 * the token endpoint and receive a bearer token valid for ~1 hour (up
 * to 20h if configured). Tokens are cached in-process until expiry.
 *
 * The token endpoint varies by deployment:
 *   - Global: https://auth.brightspace.com/core/connect/token
 *   - Per-instance: https://{instance}.brightspace.com/d2l/auth/api/token
 *
 * NLU IT tells us which one to use during registration.
 */

import { getValenceConfig } from './config'

interface CachedToken {
  token: string
  expiresAt: number
}

let cache: CachedToken | null = null

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

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    // Scope is optional per client config; some Brightspace deployments
    // require it, others infer from the client's registered scopes.
    scope: [
      'core:*:*',
      'dropbox:folders:read',
      'dropbox:submissions:read',
      'enrollment:orgunit:read',
      'users:userdata:read',
    ].join(' '),
  })

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(
      `Valence token request failed: ${res.status} ${res.statusText}. ${errText}`
    )
  }

  const body = (await res.json()) as {
    access_token: string
    token_type: string
    expires_in: number
  }

  if (!body.access_token) {
    throw new Error('Valence token response missing access_token')
  }

  cache = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  }

  return body.access_token
}

/**
 * Force-clear the cached token. Useful in tests and after configuration
 * changes. Not typically needed in production — tokens refresh automatically.
 */
export function clearValenceTokenCache(): void {
  cache = null
}
