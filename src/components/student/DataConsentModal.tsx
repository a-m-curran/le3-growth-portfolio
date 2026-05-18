'use client'

import { useEffect, useState } from 'react'
import { DataHandlingNotice } from './DataHandlingNotice'

/**
 * One-time data-handling notice shown to students on their first v2
 * visit. Self-gating: decides whether to render based on
 * /api/student/acknowledge-consent. Non-students and already-
 * acknowledged students see nothing. Notice body is the shared
 * DataHandlingNotice (single source of truth).
 *
 * Not a legal-grade consent flow. Doesn't gate access. Purpose is
 * "no surprises the first time you see your D2L work appear" + an
 * auditable timestamp on the student row.
 */

interface ConsentStatus {
  acknowledged: boolean
  acknowledgedAt: string | null
}

export function DataConsentModal() {
  const [status, setStatus] = useState<ConsentStatus | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/acknowledge-consent', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: ConsentStatus) => {
        if (!cancelled) setStatus(j)
      })
      .catch(() => {
        if (!cancelled) setStatus({ acknowledged: true, acknowledgedAt: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // While loading, OR if already acknowledged, render nothing.
  if (!status || status.acknowledged) return null

  const handleAcknowledge = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/student/acknowledge-consent', {
        method: 'POST',
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const j = (await res.json()) as { acknowledgedAt: string }
      setStatus({ acknowledged: true, acknowledgedAt: j.acknowledgedAt })
    } catch (e) {
      setError(String(e))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🌱</span>
          <h2 className="text-lg font-bold text-green-900">
            Welcome to your Growth Portfolio
          </h2>
        </div>

        <DataHandlingNotice />

        {error && (
          <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800">
            Couldn&rsquo;t record acknowledgement: {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving…' : 'I understand — let’s go'}
          </button>
        </div>
      </div>
    </div>
  )
}
