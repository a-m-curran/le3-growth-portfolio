/**
 * LTI Platform Notification Service subscription
 *
 * Tools self-register their notice handler URLs with the platform.
 * The subscription is persistent on the platform side, so we only need
 * to do this once per deployment (though re-subscribing is idempotent).
 *
 * Spec: LTI Platform Notification Service 1.0
 */

import { getServiceToken, SCOPES } from './token'
import { getToolConfig } from './config'
import type { LtiPnsEndpointClaim, LtiNoticeType } from './claims'

/**
 * Subscribe to a notice type on the platform.
 *
 * @param pnsEndpoint The platform notification service URL from the LTI launch claim
 * @param noticeType The notice type to subscribe to
 */
export async function subscribeNoticeHandler(
  pnsEndpoint: LtiPnsEndpointClaim,
  noticeType: LtiNoticeType
): Promise<void> {
  // Confirm the platform supports this notice type
  if (!pnsEndpoint.notice_types_supported?.includes(noticeType)) {
    throw new Error(
      `Platform does not support notice type ${noticeType}. ` +
      `Supported: ${pnsEndpoint.notice_types_supported?.join(', ') || 'none'}`
    )
  }

  const { toolUrl } = getToolConfig()
  const handlerUrl = `${toolUrl}/api/lti/notice`

  const token = await getServiceToken([SCOPES.NOTICE_HANDLERS])

  const res = await fetch(pnsEndpoint.platform_notification_service_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      notice_type: noticeType,
      handler: handlerUrl,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Notice handler subscription failed (${noticeType}): ${res.status} ${text}`
    )
  }
}

/**
 * Subscribe to all notice types we care about.
 * Called opportunistically on LTI launches that include a PNS endpoint claim.
 */
export async function subscribeAll(pnsEndpoint: LtiPnsEndpointClaim): Promise<void> {
  const desired: LtiNoticeType[] = ['LtiAssetProcessorSubmissionNotice']

  for (const noticeType of desired) {
    try {
      await subscribeNoticeHandler(pnsEndpoint, noticeType)
    } catch (err) {
      console.error(`Failed to subscribe to ${noticeType}:`, err)
    }
  }
}
