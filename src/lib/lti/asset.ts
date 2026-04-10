/**
 * LTI Asset Service client
 *
 * Downloads student-submitted assets (files) from the platform using the
 * URL and metadata provided in an LtiAssetProcessorSubmissionNotice.
 *
 * Auth: client credentials Bearer token with scope asset.readonly
 */

import { getServiceToken, SCOPES } from './token'
import type { LtiAsset } from './claims'

export interface DownloadedAsset {
  asset: LtiAsset
  buffer: Buffer
  contentType: string
  filename: string
}

/**
 * Download a single asset from the platform's asset service.
 *
 * The platform may redirect; fetch follows redirects by default.
 */
export async function downloadAsset(asset: LtiAsset): Promise<DownloadedAsset> {
  const token = await getServiceToken([SCOPES.ASSET_READONLY])

  const res = await fetch(asset.url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    redirect: 'follow',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Asset download failed for ${asset.asset_id}: ${res.status} ${text}`
    )
  }

  const arrayBuf = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)

  return {
    asset,
    buffer,
    contentType: res.headers.get('content-type') || asset.content_type || 'application/octet-stream',
    filename: asset.title || asset.filename || `asset-${asset.asset_id}`,
  }
}

/**
 * Download all assets from a submission notice in parallel.
 * Failures on individual assets are caught and reported so partial
 * processing can continue.
 */
export async function downloadAssets(
  assets: LtiAsset[]
): Promise<{ downloaded: DownloadedAsset[]; errors: { assetId: string; error: string }[] }> {
  const results = await Promise.allSettled(assets.map(a => downloadAsset(a)))

  const downloaded: DownloadedAsset[] = []
  const errors: { assetId: string; error: string }[] = []

  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      downloaded.push(result.value)
    } else {
      errors.push({
        assetId: assets[idx].asset_id,
        error: String(result.reason),
      })
    }
  })

  return { downloaded, errors }
}
