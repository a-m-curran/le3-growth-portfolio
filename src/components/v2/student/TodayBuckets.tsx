'use client'

import { useMemo, useState } from 'react'
import { SubmissionRow } from '@/components/v2/student/SubmissionRow'
import type { SubmissionItem } from '@/components/v2/student/types'

/**
 * Three date buckets — Today / This week / Earlier — for /v2/today.
 *
 * Bucketing (client-side, user's local timezone):
 *   - Today:    DATE(submittedAt) === DATE(now)
 *   - This week: in the last 7 days, excluding Today
 *   - Earlier:  everything else (incl. submissions with no submittedAt)
 *
 * Empty buckets are not rendered. Today + This week start expanded;
 * Earlier starts collapsed (and is the place a large backlog lives).
 */

interface TodayBucketsProps {
  submissions: SubmissionItem[]
  onRowClick: (item: SubmissionItem) => void
}

interface Buckets {
  today: SubmissionItem[]
  thisWeek: SubmissionItem[]
  earlier: SubmissionItem[]
}

function bucket(submissions: SubmissionItem[]): Buckets {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

  const today: SubmissionItem[] = []
  const thisWeek: SubmissionItem[] = []
  const earlier: SubmissionItem[] = []

  for (const s of submissions) {
    if (!s.submittedAt) {
      earlier.push(s)
      continue
    }
    const d = new Date(s.submittedAt)
    if (d >= todayStart) today.push(s)
    else if (d >= weekAgo) thisWeek.push(s)
    else earlier.push(s)
  }
  return { today, thisWeek, earlier }
}

export function TodayBuckets({ submissions, onRowClick }: TodayBucketsProps) {
  const buckets = useMemo(() => bucket(submissions), [submissions])
  const [earlierOpen, setEarlierOpen] = useState(false)

  const renderList = (items: SubmissionItem[]) => (
    <ul className="space-y-0.5">
      {items.map(item => (
        <li key={item.id}>
          <SubmissionRow item={item} surface="today" onClick={onRowClick} />
        </li>
      ))}
    </ul>
  )

  return (
    <div className="space-y-3">
      {buckets.today.length > 0 && (
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">Today</h2>
            <span className="text-xs text-gray-500">({buckets.today.length})</span>
          </div>
          {renderList(buckets.today)}
        </section>
      )}

      {buckets.thisWeek.length > 0 && (
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">This week</h2>
            <span className="text-xs text-gray-500">({buckets.thisWeek.length})</span>
          </div>
          {renderList(buckets.thisWeek)}
        </section>
      )}

      {buckets.earlier.length > 0 && (
        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
          <button
            type="button"
            onClick={() => setEarlierOpen(o => !o)}
            className="w-full flex items-baseline justify-between"
            aria-expanded={earlierOpen}
          >
            <h2 className="text-sm font-semibold text-gray-600">
              {earlierOpen ? '▾' : '▸'} Earlier
            </h2>
            <span className="text-xs text-gray-500">({buckets.earlier.length})</span>
          </button>
          {earlierOpen && <div className="mt-2">{renderList(buckets.earlier)}</div>}
        </section>
      )}
    </div>
  )
}
