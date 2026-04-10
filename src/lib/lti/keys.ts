/**
 * LTI 1.3 key management
 *
 * Loads our tool's RSA key pair from environment variables and
 * exports the public JWKS format for the /api/lti/jwks endpoint.
 */

import { importPKCS8, importSPKI, exportJWK, type JWK } from 'jose'
import { getToolConfig } from './config'

function normalizePem(pem: string): string {
  // Env vars typically have newlines escaped as \n. Restore them.
  return pem.replace(/\\n/g, '\n').trim()
}

export async function getPrivateKey() {
  const raw = process.env.LTI_PRIVATE_KEY
  if (!raw) {
    throw new Error('LTI_PRIVATE_KEY environment variable is required.')
  }
  return importPKCS8(normalizePem(raw), 'RS256')
}

export async function getPublicKey() {
  const raw = process.env.LTI_PUBLIC_KEY
  if (!raw) {
    throw new Error('LTI_PUBLIC_KEY environment variable is required.')
  }
  return importSPKI(normalizePem(raw), 'RS256')
}

export async function getPublicJwks(): Promise<{ keys: JWK[] }> {
  const { keyId } = getToolConfig()
  const publicKey = await getPublicKey()
  const jwk = await exportJWK(publicKey)

  return {
    keys: [
      {
        ...jwk,
        kid: keyId,
        alg: 'RS256',
        use: 'sig',
      },
    ],
  }
}
