/**
 * LTI Asset Report Service client
 *
 * Sends processing reports back to the platform after the tool has
 * analyzed a submitted asset. Reports show up in the platform's
 * grading view so instructors know the tool received and processed
 * the submission.
 *
 * Auth: client credentials Bearer token with scope report
 */

import { getServiceToken, SCOPES } from './token'

export type ProcessingProgress =
  | 'Processing'
  | 'Processed'
  | 'Failed'
  | 'NotProcessed'
  | 'NotReady'
  | 'PendingManual'
  | 'Pending'

export interface AssetReport {
  assetId: string
  type: string
  timestamp: string
  title?: string
  comment?: string
  result?: string
  resultTruncated?: string
  indicationColor?: string
  indicationAlt?: string
  priority?: number
  processingProgress: ProcessingProgress
  visibleToOwner?: boolean
  errorCode?: string
}

/**
 * POST a report back to the platform via the report_url from the
 * original submission notice.
 */
export async function sendReport(
  reportUrl: string,
  report: AssetReport
): Promise<void> {
  const token = await getServiceToken([SCOPES.REPORT])

  const res = await fetch(reportUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(report),
  })

  if (!res.ok && res.status !== 409) {
    // 409 = timestamp superseding (newer report already sent) — tolerable
    const text = await res.text().catch(() => '')
    throw new Error(`Asset report upload failed: ${res.status} ${text}`)
  }
}

/**
 * Convenience: send a "processing in progress" report when we first
 * receive a submission notice.
 */
export async function sendProcessingReport(
  reportUrl: string,
  assetId: string
): Promise<void> {
  return sendReport(reportUrl, {
    assetId,
    type: 'reflection',
    timestamp: new Date().toISOString(),
    title: 'Growth Portfolio',
    result: 'Processing for reflection...',
    processingProgress: 'Processing',
    visibleToOwner: false,
  })
}

/**
 * Convenience: send a "ready for reflection" report after we've
 * successfully downloaded, extracted, and stored the submission.
 */
export async function sendReadyReport(
  reportUrl: string,
  assetId: string,
  title?: string
): Promise<void> {
  return sendReport(reportUrl, {
    assetId,
    type: 'reflection',
    timestamp: new Date().toISOString(),
    title: title || 'Growth Portfolio',
    result: 'Ready for reflection',
    indicationColor: '#16A34A',
    indicationAlt: 'Submission received and ready for reflective conversation',
    processingProgress: 'Processed',
    visibleToOwner: true,
  })
}

/**
 * Convenience: send a failure report with an error code.
 */
export async function sendFailureReport(
  reportUrl: string,
  assetId: string,
  errorMessage: string,
  errorCode = 'DOWNLOAD_FAILED'
): Promise<void> {
  return sendReport(reportUrl, {
    assetId,
    type: 'reflection',
    timestamp: new Date().toISOString(),
    title: 'Growth Portfolio',
    result: `Failed to process: ${errorMessage.substring(0, 200)}`,
    indicationColor: '#DC2626',
    indicationAlt: errorMessage.substring(0, 200),
    processingProgress: 'Failed',
    errorCode,
    visibleToOwner: false,
  })
}
