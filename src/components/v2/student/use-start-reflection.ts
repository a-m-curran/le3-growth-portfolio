'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ActiveInProgress, SubmissionItem } from '@/components/v2/student/types'

/**
 * Shared click-routing for the Reflect tree + Today buckets.
 *
 * Click semantics by row status:
 *   - completed   → navigate to /v2/conversation/[conversationId]
 *                   (ConversationView dispatches to ConversationFullView
 *                    for the side-modal-style "all at once" view)
 *   - in_progress → navigate to /v2/conversation/[conversationId]
 *                   (ConversationFlowView resumes the live flow)
 *   - unreflected, no active in-progress → POST /api/conversation/start
 *                   and navigate to the new conversation
 *   - unreflected, active in-progress exists → open
 *                   <InProgressInterstitial /> for explicit
 *                   Resume / Discard-and-start-new / Cancel
 *
 * The hook returns the click handler + the interstitial target (null
 * when no interstitial is open). The parent renders the interstitial
 * conditionally.
 *
 * onRefresh is called when something changed that requires re-fetching
 * the surface's data (after a successful discardAndStart navigation
 * the parent route changes anyway, but on cancel the data is fine; this
 * is wired so callers can re-fetch if they need to).
 */
interface UseStartReflectionArgs {
  active: ActiveInProgress | null
  onRefresh: () => void
}

interface UseStartReflectionReturn {
  onSubmissionClick: (item: SubmissionItem) => void
  interstitialFor: SubmissionItem | null
  closeInterstitial: () => void
  startError: string | null
}

export function useStartReflection({
  active,
  onRefresh,
}: UseStartReflectionArgs): UseStartReflectionReturn {
  const router = useRouter()
  const [interstitialFor, setInterstitialFor] = useState<SubmissionItem | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  const closeInterstitial = useCallback(() => setInterstitialFor(null), [])

  const onSubmissionClick = useCallback(
    (item: SubmissionItem) => {
      setStartError(null)

      // Data-anomaly guards: a completed or in_progress row without a
      // conversationId would otherwise silently fall through to the
      // POST-new-start path and risk creating a duplicate. Surface to
      // the student instead.
      if (item.status === 'completed' && !item.conversationId) {
        setStartError('Missing conversation for completed item; please refresh.')
        return
      }
      if (item.status === 'in_progress' && !item.conversationId) {
        setStartError('Missing conversation for in-progress item; please refresh.')
        return
      }

      // Existing conversations: navigate directly.
      if (item.status === 'completed' && item.conversationId) {
        router.push(`/v2/conversation/${item.conversationId}`)
        return
      }
      if (item.status === 'in_progress' && item.conversationId) {
        router.push(`/v2/conversation/${item.conversationId}`)
        return
      }

      // Unreflected: if any active in-progress exists, route through
      // the interstitial so the student decides explicitly. (Even if
      // active.workId === item.id — a stale-data race where the row
      // still reads 'unreflected' while a conversation was already
      // created — the interstitial's Resume button navigates to the
      // existing conversation, which is the correct UX.)
      if (active) {
        setInterstitialFor(item)
        return
      }

      // Unreflected with no active in-progress: start immediately.
      ;(async () => {
        try {
          const r = await fetch('/api/conversation/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workId: item.id }),
          })
          const data = await r.json()
          if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
          onRefresh()
          router.push(`/v2/conversation/${data.conversationId}`)
        } catch (e) {
          setStartError(e instanceof Error ? e.message : String(e))
        }
      })()
    },
    [active, router, onRefresh]
  )

  return { onSubmissionClick, interstitialFor, closeInterstitial, startError }
}
