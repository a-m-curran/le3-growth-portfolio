/**
 * Low-level HTTP client for D2L Valence API.
 *
 * Handles:
 * - Bearer token injection via getValenceToken()
 * - URL construction for /le and /lp API namespaces
 * - Pagination via PagingInfo.Bookmark
 * - Error wrapping with request context
 * - File downloads as Buffer
 *
 * Higher-level endpoint modules (courses.ts, assignments.ts, etc.)
 * use this client rather than calling fetch directly.
 */

import { getValenceConfig } from './config'
import { getValenceToken } from './auth'
import type { D2LPagedResultSet } from './types'

/**
 * GET a JSON response from the Valence LE namespace (learning engine).
 * LE endpoints cover dropbox folders, submissions, discussions, etc.
 */
export async function leGet<T>(path: string): Promise<T> {
  return valenceGet<T>('le', path)
}

/**
 * GET a JSON response from the Valence LP namespace (learning platform).
 * LP endpoints cover org structure, enrollments, users, courses, etc.
 */
export async function lpGet<T>(path: string): Promise<T> {
  return valenceGet<T>('lp', path)
}

/**
 * Download a file as a Buffer from the LE namespace.
 * Used for submission file downloads. Skips JSON parsing.
 */
export async function leGetBuffer(path: string): Promise<{
  buffer: Buffer
  contentType: string
  filename: string
}> {
  const config = getValenceConfig()
  const token = await getValenceToken()
  const url = `${config.instanceUrl}/d2l/api/le/${config.leVersion}${path}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Valence file download failed: ${res.status} ${res.statusText} on ${path}. ${text.substring(0, 200)}`
    )
  }

  const arrayBuf = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || 'application/octet-stream'

  // Parse filename from Content-Disposition header if present
  const disposition = res.headers.get('content-disposition') || ''
  const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)
  const filename = filenameMatch
    ? decodeURIComponent(filenameMatch[1].replace(/"/g, ''))
    : 'download'

  return {
    buffer: Buffer.from(arrayBuf),
    contentType,
    filename,
  }
}

/**
 * Paginate through a Valence LP endpoint that returns PagedResultSet.
 * Returns all items across all pages.
 */
export async function lpGetAllPaged<T>(path: string): Promise<T[]> {
  return valenceGetAllPaged<T>('lp', path)
}

/**
 * Paginate through a Valence LE endpoint that returns PagedResultSet.
 */
export async function leGetAllPaged<T>(path: string): Promise<T[]> {
  return valenceGetAllPaged<T>('le', path)
}

// ─── Internal helpers ─────────────────────────────

async function valenceGet<T>(namespace: 'le' | 'lp', path: string): Promise<T> {
  const config = getValenceConfig()
  const token = await getValenceToken()
  const version = namespace === 'lp' ? config.lpVersion : config.leVersion
  const url = `${config.instanceUrl}/d2l/api/${namespace}/${version}${path}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Valence ${namespace.toUpperCase()} GET ${path} failed: ${res.status} ${res.statusText}. ${text.substring(0, 300)}`
    )
  }

  return (await res.json()) as T
}

async function valenceGetAllPaged<T>(
  namespace: 'le' | 'lp',
  path: string
): Promise<T[]> {
  const all: T[] = []
  let bookmark: string | undefined

  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const pathWithBookmark = bookmark
      ? `${path}${sep}bookmark=${encodeURIComponent(bookmark)}`
      : path

    const page = await valenceGet<D2LPagedResultSet<T>>(namespace, pathWithBookmark)
    all.push(...page.Items)

    if (!page.PagingInfo?.HasMoreItems) break
    bookmark = page.PagingInfo.Bookmark

    // Safety cap — don't paginate forever
    if (all.length > 50_000) {
      throw new Error(
        `Valence pagination safety cap hit (50000 items) on ${namespace}${path}`
      )
    }
  }

  return all
}
