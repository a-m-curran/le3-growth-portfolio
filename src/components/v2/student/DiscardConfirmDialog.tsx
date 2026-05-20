'use client'

import { useEffect } from 'react'

/**
 * Generic destructive-confirm modal. Used by:
 *   - InProgressBanner Discard
 *   - InProgressInterstitial "Discard and start new"
 *
 * Always shown before any discard takes effect so a student can back
 * out. The actual discard call lives in the caller's onConfirm.
 */

interface DiscardConfirmDialogProps {
  /** Heading copy. */
  title: string
  /** Body paragraph. */
  body: string
  /** Discard button label (defaults to "Discard"). */
  confirmLabel?: string
  /** Called when the student clicks Discard. */
  onConfirm: () => void
  /** Called when the student clicks Cancel, presses Escape, or clicks the backdrop. */
  onCancel: () => void
}

export function DiscardConfirmDialog({
  title,
  body,
  confirmLabel = 'Discard',
  onConfirm,
  onCancel,
}: DiscardConfirmDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onCancel}
    >
      <div
        className="relative max-w-sm w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="discard-confirm-title" className="text-base font-semibold text-gray-900 mb-2">
          {title}
        </h2>
        <p className="text-sm text-gray-700 mb-4">{body}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-2 text-sm font-semibold text-white rounded-lg bg-red-600 hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
