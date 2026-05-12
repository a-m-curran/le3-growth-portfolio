'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Client component that fetches /api/coach/students and renders the
 * caseload list. Lives in its own file (vs inlined in page.tsx) so
 * page.tsx stays a server component — Next.js complains if a server
 * component contains both 'use client' children and async data
 * fetching above them.
 *
 * Filters in Phase 1C: "All", "Needs attention". Sorting always
 * alphabetical by last name. We can layer in more filters once we
 * see real cohort behavior.
 */

interface CaseloadStudent {
  id: string
  firstName: string
  lastName: string
  email: string
  cohort: string | null
  conversationCount: number
  lastActivityAt: string | null
  needsAttention: boolean
}

type FilterMode = 'all' | 'attention'

export function CaseloadView() {
  const router = useRouter()
  const [students, setStudents] = useState<CaseloadStudent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')

  useEffect(() => {
    let cancelled = false
    fetch('/api/coach/students', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as { students: CaseloadStudent[] }
      })
      .then(j => {
        if (cancelled) return
        setStudents(j.students)
      })
      .catch(e => {
        if (cancelled) return
        setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!students) return []
    if (filter === 'attention') return students.filter(s => s.needsAttention)
    return students
  }, [students, filter])

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
        Couldn&rsquo;t load caseload: {error}
      </div>
    )
  }

  if (students === null) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="h-20 rounded-xl bg-white border border-gray-200 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (students.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-gray-200 p-8 text-center">
        <p className="text-gray-600">No students assigned to you yet.</p>
        <p className="text-xs text-gray-500 mt-2">
          Students appear after Valence sync, or when one launches the tool
          via Brightspace LTI for the first time.
        </p>
      </div>
    )
  }

  const attentionCount = students.filter(s => s.needsAttention).length

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex items-center gap-2 text-xs">
        <FilterPill
          label={`All (${students.length})`}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterPill
          label={`Needs attention (${attentionCount})`}
          active={filter === 'attention'}
          onClick={() => setFilter('attention')}
          accent={attentionCount > 0 ? 'amber' : undefined}
        />
      </div>

      {/* Caseload list */}
      <ul className="space-y-2">
        {filtered.map(s => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => router.push(`/v2/coach/${s.id}`)}
              className="w-full text-left p-4 rounded-xl bg-white border border-gray-200 hover:border-green-400 hover:shadow-sm transition-colors flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-sm font-semibold shrink-0">
                {initials(s.firstName, s.lastName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {s.firstName} {s.lastName}
                  </h3>
                  {s.needsAttention && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      Needs attention
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {s.cohort ? `${s.cohort} · ` : ''}
                  {s.conversationCount} conversation
                  {s.conversationCount === 1 ? '' : 's'}
                  {s.lastActivityAt && ` · last ${formatRelative(s.lastActivityAt)}`}
                  {!s.lastActivityAt && ' · no activity yet'}
                </p>
              </div>
              <span className="text-gray-400 text-sm shrink-0">→</span>
            </button>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <div className="text-center text-sm text-gray-500 italic py-8">
          No students match this filter.
        </div>
      )}
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
  accent,
}: {
  label: string
  active: boolean
  onClick: () => void
  accent?: 'amber'
}) {
  const activeClass = accent === 'amber'
    ? 'bg-amber-700 text-white border-amber-700'
    : 'bg-gray-900 text-white border-gray-900'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? activeClass
          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
      }`}
    >
      {label}
    </button>
  )
}

function initials(first: string, last: string): string {
  return ((first[0] || '') + (last[0] || '')).toUpperCase()
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const days = Math.floor((now - then) / (24 * 60 * 60 * 1000))
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}
