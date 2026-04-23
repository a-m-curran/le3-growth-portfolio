/**
 * D2L Brightspace Valence client configuration.
 *
 * Reads Valence OAuth2 client credentials and connection settings from
 * environment variables. Used by the auth module to obtain access tokens
 * and by the individual API endpoint modules.
 *
 * Auth flow: JWT client assertion (not shared secret).
 * Brightspace verifies our identity by fetching our public key from the
 * JWKS URL we registered — which is the same LTI JWKS URL at
 * /api/lti/jwks, re-used here so one RSA key pair covers both LTI and
 * Valence auth. That means LTI_PRIVATE_KEY and LTI_PUBLIC_KEY (plus
 * LTI_KEY_ID) must be set for Valence auth to work, even if LTI is
 * otherwise not in use.
 */

export interface D2LValenceConfig {
  /** Brightspace instance URL, e.g. https://d2ltest.nl.edu */
  instanceUrl: string
  /** OAuth2 client ID from Brightspace's Manage Extensibility → OAuth 2.0 */
  clientId: string
  /** OAuth2 token endpoint — typically https://auth.brightspace.com/core/connect/token */
  tokenUrl: string
  /** Valence API version, e.g. '1.82' */
  apiVersion: string
  /** Org unit ID containing LE3 courses — sync is scoped to children of this unit */
  le3OrgUnitId: string
}

/**
 * Get the D2L Valence config from environment variables. Throws if any
 * required value is missing. Intended to be called inside sync jobs and
 * API routes, not at module load time, so the rest of the app can start
 * without Valence being configured.
 *
 * Defaults D2L_VALENCE_TOKEN_URL to the standard global D2L auth endpoint
 * (https://auth.brightspace.com/core/connect/token), which works for
 * most Brightspace deployments. Override per-instance if needed.
 */
export function getValenceConfig(): D2LValenceConfig {
  const instanceUrl = process.env.D2L_VALENCE_INSTANCE_URL
  const clientId = process.env.D2L_VALENCE_CLIENT_ID
  const tokenUrl =
    process.env.D2L_VALENCE_TOKEN_URL ||
    'https://auth.brightspace.com/core/connect/token'
  const apiVersion = process.env.D2L_VALENCE_API_VERSION || '1.82'
  const le3OrgUnitId = process.env.D2L_VALENCE_LE3_ORG_UNIT_ID

  const missing: string[] = []
  if (!instanceUrl) missing.push('D2L_VALENCE_INSTANCE_URL')
  if (!clientId) missing.push('D2L_VALENCE_CLIENT_ID')
  if (!le3OrgUnitId) missing.push('D2L_VALENCE_LE3_ORG_UNIT_ID')

  if (missing.length > 0) {
    throw new Error(
      `D2L Valence config incomplete. Set these environment variables: ${missing.join(', ')}`
    )
  }

  return {
    instanceUrl: instanceUrl!,
    clientId: clientId!,
    tokenUrl,
    apiVersion,
    le3OrgUnitId: le3OrgUnitId!,
  }
}

/**
 * Check if Valence is configured without throwing. Used by UI elements
 * (e.g. the coach dashboard's "Sync Now" button) to hide/disable when
 * Valence credentials aren't set yet.
 */
export function isValenceConfigured(): boolean {
  return !!(
    process.env.D2L_VALENCE_INSTANCE_URL &&
    process.env.D2L_VALENCE_CLIENT_ID &&
    process.env.D2L_VALENCE_LE3_ORG_UNIT_ID
  )
}
