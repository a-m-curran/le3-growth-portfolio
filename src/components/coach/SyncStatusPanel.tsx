'use client'

import { useState } from 'react'
import type { SyncRun } from '@/lib/types'

interface SyncStatusPanelProps {
  /** Most recent sync runs (any status), newest first */
  recentRuns: SyncRun[]
  /** Most recent completed run, or null if none */
  lastSuccessful: SyncRun | null
}

/**
 * Coach dashboard panel showing sync observability + a manual trigger.
 *
 * Shows:
 *   - Last successful sync timestamp + counts (courses, students, submissions)
 *   - Warning if the most recent run failed
 *   - "Sync Now" button that POSTs to /api/admin/sync-le3
 *
 * During a manual sync, the button is disabled and shows progress text.
 * After sync completes, the panel doesn't auto-refresh — the coach reloads
 * the page to see updated state. This keeps the component simple; we can
 * add polling later if needed.
 */
export function SyncStatusPanel({ recentRuns, lastSuccessful }: SyncStatusPanelProps) {
  const [syncing, setSyncing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mostRecent = recentRuns[0] || null
  const mostRecentFailed = mostRecent?.status === 'failed'

  const handleSyncNow = async () => {
    setSyncing(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/admin/sync-le3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'incremental', source: 'd2l_valence_manual' }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        status?: string
        triggerRunId?: string
        syncRunId?: string
        error?: string
        counts?: {
          coursesSynced: number
          studentsSynced: number
          submissionsSynced: number
          errorsCount: number
        }
      }

      if (!res.ok) {
        setErrorMessage(data.error || `Request failed with status ${res.status}`)
        setSyncing(false)
        return
      }

      if (data.status === 'enqueued') {
        setStatusMessage(
          `Sync enqueued via Trigger.dev${
            data.triggerRunId ? ` (run ${data.triggerRunId.slice(0, 12)}\u2026)` : ''
          }. Refresh in a minute to see results.`
        )
      } else if (data.status === 'completed' && data.counts) {
        setStatusMessage(
          `Sync completed: ${data.counts.coursesSynced} courses, ` +
            `${data.counts.studentsSynced} students, ` +
            `${data.counts.submissionsSynced} submissions, ` +
            `${data.counts.errorsCount} errors. ` +
            `Refresh the page to see updated portfolios.`
        )
      } else {
        setStatusMessage('Sync dispatched. Refresh in a moment to see results.')
      }
    } catch (err) {
      setErrorMessage(String(err))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="mb-6 p-4 rounded-xl bg-white border border-gray-200">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
            Brightspace Sync
          </h3>
          <p className="text-xs text-gray-500">
            Pulls LE3 courses, rosters, assignments, and submissions from
            Brightspace via Valence.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing}
          className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {syncing ? 'Syncing\u2026' : 'Sync Now'}
        </button>
      </div>

      {/* Last successful sync summary */}
      {lastSuccessful ? (
        <div className="text-xs text-gray-700 space-y-0.5">
          <div>
            <span className="font-semibold">Last successful sync:</span>{' '}
            {formatRelativeTime(lastSuccessful.startedAt)}
          </div>
          <div className="text-gray-500">
            {lastSuccessful.coursesSynced} courses &middot;{' '}
            {lastSuccessful.studentsSynced} students &middot;{' '}
            {lastSuccessful.assignmentsSynced} assignments &middot;{' '}
            {lastSuccessful.submissionsSynced} submissions
            {lastSuccessful.errorsCount > 0 && (
              <span className="text-amber-700">
                {' '}
                &middot; {lastSuccessful.errorsCount} errors
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-500 italic">
          No successful sync yet. Once NLU&rsquo;s Valence credentials are set,
          the first run will populate the portfolio with all LE3 data.
        </div>
      )}

      {/* Flag recent failure */}
      {mostRecentFailed && mostRecent && (
        <div className="mt-3 p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">
          <strong>Most recent sync failed</strong> at{' '}
          {formatRelativeTime(mostRecent.startedAt)}.{' '}
          {firstErrorMessage(mostRecent) && (
            <span className="italic">&ldquo;{firstErrorMessage(mostRecent)}&rdquo;</span>
          )}
        </div>
      )}

      {/* Action feedback */}
      {statusMessage && (
        <div className="mt-3 p-2 rounded-md bg-green-50 border border-green-200 text-xs text-green-800">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mt-3 p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">
          Error: {errorMessage}
        </div>
      )}
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then

  if (diffMs < 60_000) return 'just now'
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000)
    return `${mins} minute${mins === 1 ? '' : 's'} ago`
  }
  if (diffMs < 86_400_000) {
    const hours = Math.floor(diffMs / 3_600_000)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  const days = Math.floor(diffMs / 86_400_000)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function firstErrorMessage(run: SyncRun): string | null {
  if (!run.errorDetails) return null
  const details = Array.isArray(run.errorDetails) ? run.errorDetails : [run.errorDetails]
  const first = details[0]
  if (!first || typeof first !== 'object') return null
  const msg = (first as Record<string, unknown>).message
  return typeof msg === 'string' ? msg.slice(0, 120) : null
}
