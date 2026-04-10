/**
 * LTI 1.3 platform configuration
 *
 * Reads NLU Brightspace configuration from environment variables.
 * Single-platform for MVP. Promote to a database table if we need
 * multi-platform support later.
 */

export interface LtiPlatformConfig {
  issuer: string
  clientId: string
  authUrl: string
  tokenUrl: string
  jwksUrl: string
  deploymentId: string
}

export interface LtiToolConfig {
  toolUrl: string
  keyId: string
}

export function getPlatformConfig(): LtiPlatformConfig {
  const issuer = process.env.LTI_PLATFORM_ISSUER
  const clientId = process.env.LTI_PLATFORM_CLIENT_ID
  const authUrl = process.env.LTI_PLATFORM_AUTH_URL
  const tokenUrl = process.env.LTI_PLATFORM_TOKEN_URL
  const jwksUrl = process.env.LTI_PLATFORM_JWKS_URL
  const deploymentId = process.env.LTI_DEPLOYMENT_ID

  if (!issuer || !clientId || !authUrl || !tokenUrl || !jwksUrl || !deploymentId) {
    throw new Error(
      'LTI platform config incomplete. Set LTI_PLATFORM_ISSUER, LTI_PLATFORM_CLIENT_ID, ' +
      'LTI_PLATFORM_AUTH_URL, LTI_PLATFORM_TOKEN_URL, LTI_PLATFORM_JWKS_URL, ' +
      'and LTI_DEPLOYMENT_ID environment variables.'
    )
  }

  return { issuer, clientId, authUrl, tokenUrl, jwksUrl, deploymentId }
}

export function getToolConfig(): LtiToolConfig {
  const toolUrl = process.env.LTI_TOOL_URL
  const keyId = process.env.LTI_KEY_ID || 'lti-2026'

  if (!toolUrl) {
    throw new Error('LTI_TOOL_URL environment variable is required.')
  }

  return { toolUrl, keyId }
}

export function isLtiConfigured(): boolean {
  return !!(
    process.env.LTI_PLATFORM_ISSUER &&
    process.env.LTI_PLATFORM_CLIENT_ID &&
    process.env.LTI_PLATFORM_AUTH_URL &&
    process.env.LTI_PLATFORM_TOKEN_URL &&
    process.env.LTI_PLATFORM_JWKS_URL &&
    process.env.LTI_DEPLOYMENT_ID &&
    process.env.LTI_PRIVATE_KEY &&
    process.env.LTI_PUBLIC_KEY &&
    process.env.LTI_TOOL_URL
  )
}
