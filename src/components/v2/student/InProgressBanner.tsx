'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DiscardConfirmDialog } from '@/components/v2/student/DiscardConfirmDialog'
import type { ActiveInProgress } from '@/components/v2/student/types'

/**
 * Pinned amber banner showing the student's single active in-progress
 * conversation. Same component on /v2/reflect and /v2/today.
 *
 * Resume → /v2/conversation/[id] (the existing ConversationView
 * dispatcher; in_progress renders ConversationFlowView).
 * Discard → DiscardConfirmDialog → POST /api/conversation/[id]/discard.
 * On successful discard, calls onDiscarded so the parent can refresh
 * (re-fetch the route to drop the banner + the in_progress row from
 * the tree/buckets).
 */

interface InProgressBannerProps {
  active: ActiveInProgress
  onDiscarded: () => void
}

export function InProgressBanner({ active, onDiscarded }: InProgressBannerProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // For work_based: prefer the work title. For open_reflection: workTitle
  // is null; the banner does not have direct access to work_context yet
  // (the route returns it only on the underlying convo). For now, fall
  // back to a generic label; future iteration can add work_context to
  // ActiveInProgress if it reads thin.
  const title = active.workTitle ?? 'your reflection'

  const handleResume = () => {
    router.push(`/v2/conversation/${active.id}`)
  }

  const handleConfirmDiscard = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`/api/conversation/${active.id}/discard`, {
        method: 'POST',
        cache: 'no-store',
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `HTTP ${r.status}`)
      }
      setConfirming(false)
      onDiscarded()
    } catch (e) {
      // Close the modal on error so the error message (rendered in the
      // banner below) becomes visible to the student instead of being
      // occluded by the still-open modal overlay.
      setConfirming(false)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-lg" aria-hidden="true">⏳</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Resume: <span className="font-normal">{title}</span>
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Phase {active.currentPhase} · started{' '}
              {new Date(active.startedAt).toLocaleString()}
            </p>
            {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResume}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-700 text-white hover:bg-amber-800"
            >
              Resume →
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-red-200 text-red-700 hover:bg-red-50"
            >
              Discard
            </button>
          </div>
        </div>
      </div>

      {confirming && (
        <DiscardConfirmDialog
          title="Discard your in-progress reflection?"
          body={`Your progress on "${title}" (Phase ${active.currentPhase}) will be removed. This can't be undone from here.`}
          confirmLabel={busy ? 'Discarding…' : 'Discard'}
          onConfirm={handleConfirmDiscard}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
