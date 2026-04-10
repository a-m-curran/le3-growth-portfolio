/**
 * LTI 1.3 Assignment and Grade Services (AGS) client
 *
 * Used to fetch line items (assignments) for a course after an LTI launch.
 * Authentication: client credentials grant against the platform's token endpoint,
 * using a signed client assertion JWT from our tool.
 */

import { signToolJwt } from './jwt'
import { getPlatformConfig } from './config'

export interface LineItem {
  id: string
  label: string
  scoreMaximum: number
  resourceLinkId?: string
  resourceId?: string
  tag?: string
  startDateTime?: string
  endDateTime?: string
  gradesReleased?: boolean
}

/**
 * Request a service access token for AGS from the platform.
 * Uses a client assertion JWT signed with our private key.
 */
export async function getServiceToken(scopes: string[]): Promise<string> {
  const { tokenUrl, clientId } = getPlatformConfig()

  // The client assertion is a JWT signed by our tool that proves we are
  // the registered client. The aud is the platform's token endpoint.
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
    scope: scopes.join(' '),
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AGS token request failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data.access_token as string
}

/**
 * Fetch all line items (assignments) for a course from the AGS endpoint.
 */
export async function fetchLineItems(lineitemsUrl: string): Promise<LineItem[]> {
  const token = await getServiceToken([
    'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  ])

  const res = await fetch(lineitemsUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.ims.lis.v2.lineitemcontainer+json',
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AGS line items fetch failed: ${res.status} ${text}`)
  }

  const items = await res.json()
  return items as LineItem[]
}
