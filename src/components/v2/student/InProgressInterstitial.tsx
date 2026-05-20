'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DiscardConfirmDialog } from '@/components/v2/student/DiscardConfirmDialog'
import type { ActiveInProgress, SubmissionItem } from '@/components/v2/student/types'

/**
 * Modal shown when a student clicks a NEW assignment row while one
 * in-progress conversation exists. Three exits:
 *
 *   - Resume in-progress      → /v2/conversation/[existing id]
 *   - Discard and start new   → DiscardConfirmDialog (always confirm)
 *                                → POST /api/conversation/start
 *                                    { workId, discardAndStart: true }
 *                                → /v2/conversation/[new id]
 *   - Cancel                  → close modal, no navigation
 *
 * The parent (via useStartReflection) handles opening/closing.
 */

interface InProgressInterstitialProps {
  active: ActiveInProgress
  /** The submission the student just clicked (the one they want to start). */
  newWork: SubmissionItem
  onClose: () => void
  /** Called after a successful discardAndStart so the parent can refresh. */
  onStarted: () => void
}

export function InProgressInterstitial({
  active,
  newWork,
  onClose,
  onStarted,
}: InProgressInterstitialProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't close the outer interstitial via Escape when:
      //   - the inner confirm modal is open (Escape should close the
      //     inner one first; second Escape closes outer)
      //   - a POST is in flight (avoid unmounting mid-fetch and
      //     triggering state updates on an unmounted component)
      if (e.key === 'Escape' && !confirming && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, confirming, busy])

  const activeTitle = active.workTitle ?? 'your reflection'

  const handleResume = () => {
    if (busy) return
    router.push(`/v2/conversation/${active.id}`)
  }

  const handleConfirmDiscardAndStart = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/conversation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workId: newWork.id, discardAndStart: true }),
      })
      const data = await r.json()
      if (!r.ok) {
        throw new Error(data?.error || `HTTP ${r.status}`)
      }
      setConfirming(false)
      onStarted()
      router.push(`/v2/conversation/${data.conversationId}`)
    } catch (e) {
      // Close the inner confirm modal on error so the error message
      // (rendered in the interstitial below) becomes visible instead of
      // being occluded by the still-open confirm overlay.
      setConfirming(false)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="interstitial-title"
        className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40"
        onClick={busy ? undefined : onClose}
      >
        <div
          className="relative max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-5"
          onClick={e => e.stopPropagation()}
        >
          <h2 id="interstitial-title" className="text-base font-semibold text-gray-900 mb-2">
            You have a reflection in progress
          </h2>
          <p className="text-sm text-gray-700 mb-4">
            You&rsquo;re partway through reflecting on <b>{activeTitle}</b> (Phase{' '}
            {active.currentPhase}). Want to finish that first, or set it aside and start the
            new one on <b>{newWork.title}</b>?
          </p>
          {error && <p className="text-xs text-red-700 mb-2">{error}</p>}
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              onClick={handleResume}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-green-700 text-white hover:bg-green-800"
            >
              Resume in-progress
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-50"
            >
              Discard and start new
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {confirming && (
        <DiscardConfirmDialog
          title="Discard your in-progress reflection?"
          body={`Your progress on "${activeTitle}" (Phase ${active.currentPhase}) will be removed and the new reflection on "${newWork.title}" will start in its place.`}
          confirmLabel={busy ? 'Discarding…' : 'Discard and start new'}
          onConfirm={handleConfirmDiscardAndStart}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
