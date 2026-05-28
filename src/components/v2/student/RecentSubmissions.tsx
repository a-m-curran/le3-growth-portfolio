'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { SubmissionRow } from '@/components/v2/student/SubmissionRow'
import type { SubmissionItem, ActiveInProgress } from '@/components/v2/student/types'

/**
 * "Recent submissions" card for /v2/today — the 10 most recent
 * ACTIONABLE submissions (unreflected or in_progress), newest first.
 *
 * Replaces the prior date-bucketed TodayBuckets. Today is a to-do
 * surface: completed reflections are excluded (they live in the
 * Reflect archive). The single active in-progress reflection already
 * shows in the InProgressBanner above, so it's de-duped out here
 * (matched by conversationId === activeInProgress.id).
 *
 * Hard cap of 10; when more actionable items exist, a footer links to
 * /v2/reflect (the full archive tree). Empty state renders a gentle
 * "caught up" message so students learn where recent work appears.
 */

const CAP = 10

interface RecentSubmissionsProps {
  submissions: SubmissionItem[]
  activeInProgress: ActiveInProgress | null
  onRowClick: (item: SubmissionItem) => void
}

export function RecentSubmissions({
  submissions,
  activeInProgress,
  onRowClick,
}: RecentSubmissionsProps) {
  const actionable = useMemo(() => {
    const bannerConvId = activeInProgress?.id ?? null
    return submissions
      .filter(s => s.status === 'unreflected' || s.status === 'in_progress')
      .filter(s => !(bannerConvId && s.conversationId === bannerConvId))
      .sort((a, b) => {
        const ta = a.submittedAt ? Date.parse(a.submittedAt) : -Infinity
        const tb = b.submittedAt ? Date.parse(b.submittedAt) : -Infinity
        return tb - ta
      })
  }, [submissions, activeInProgress])

  const shown = actionable.slice(0, CAP)
  const hasOverflow = actionable.length > CAP

  return (
    <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-900">Recent submissions</h2>
      <p className="text-xs text-gray-500 mb-2 mt-0.5">
        Newest first. Older work lives in Reflect.
      </p>

      {shown.length === 0 ? (
        <p className="text-sm text-gray-500 italic px-3 py-2">
          You&rsquo;re caught up — new work shows up here as you submit it.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {shown.map(item => (
            <li key={item.id}>
              <SubmissionRow item={item} surface="today" onClick={onRowClick} />
            </li>
          ))}
        </ul>
      )}

      {hasOverflow && (
        <Link
          href="/v2/reflect"
          className="block w-full mt-2 pt-2 border-t border-gray-100 text-center text-xs text-gray-600 hover:text-gray-900"
        >
          See all in Reflect →
        </Link>
      )}
    </section>
  )
}
