/**
 * LTI 1.3 Assignment and Grade Services (AGS) client
 *
 * Used to fetch line items (assignments) for a course after an LTI launch.
 * Note: AGS only returns gradebook entries (title, due date, score). For
 * actual submission file content, use the Asset Processor flow instead.
 */

import { getServiceToken, SCOPES } from './token'

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
 * Fetch all line items (assignments) for a course from the AGS endpoint.
 */
export async function fetchLineItems(lineitemsUrl: string): Promise<LineItem[]> {
  const token = await getServiceToken([SCOPES.AGS_LINEITEM_READONLY])

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
