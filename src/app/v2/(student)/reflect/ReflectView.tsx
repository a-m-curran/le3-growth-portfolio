'use client'

import { useCallback, useEffect, useState } from 'react'
import { InProgressBanner } from '@/components/v2/student/InProgressBanner'
import { InProgressInterstitial } from '@/components/v2/student/InProgressInterstitial'
import { ReflectTree } from '@/components/v2/student/ReflectTree'
import { useStartReflection } from '@/components/v2/student/use-start-reflection'
import type { ActiveInProgress, SubmissionItem } from '@/components/v2/student/types'

/**
 * v2 Reflect view — work-tied reflections, navigable archive.
 *
 * Layout (post-redesign):
 *   - Page header "Reflect"
 *   - InProgressBanner (if activeInProgress)
 *   - ReflectTree (Quarter -> Course -> Week -> Submissions, smart-expanded)
 *
 * Click routing is delegated to useStartReflection (shared with TodayView).
 */

interface ReflectResponse {
  activeInProgress: ActiveInProgress | null
  submissions: SubmissionItem[]
}

export function ReflectView() {
  const [data, setData] = useState<ReflectResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const refresh = useCallback(() => setReloadKey(k => k + 1), [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/reflect', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as ReflectResponse
      })
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [reloadKey])

  const { onSubmissionClick, interstitialFor, closeInterstitial, startError } =
    useStartReflection({ active: data?.activeInProgress ?? null, onRefresh: refresh })

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
        Couldn&rsquo;t load reflections: {error}
      </div>
    )
  }
  if (data === null) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-xl bg-white border border-gray-200 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.activeInProgress && (
        <InProgressBanner active={data.activeInProgress} onDiscarded={refresh} />
      )}
      {startError && (
        <p className="text-xs text-red-700">{startError}</p>
      )}
      <ReflectTree submissions={data.submissions} onRowClick={onSubmissionClick} />

      {interstitialFor && data.activeInProgress && (
        <InProgressInterstitial
          active={data.activeInProgress}
          newWork={interstitialFor}
          onClose={closeInterstitial}
          onStarted={refresh}
        />
      )}
    </div>
  )
}
