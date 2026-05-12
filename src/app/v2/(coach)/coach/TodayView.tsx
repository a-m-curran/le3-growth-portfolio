'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * v2 Coach Today — client view.
 *
 * Composes data from two existing endpoints:
 *   /api/coach/students  → caseload with needsAttention + lastActivityAt
 *   /api/admin/activity  → compressed event feed for "what's been happening"
 *
 * Renders four sections:
 *   - Attention list (the "what should I handle right now" anchor)
 *   - Today's sessions (placeholder until session scheduling is wired)
 *   - Recent activity (last 24h notable events, filtered for noise)
 *   - Quick actions
 *
 * Section-level loading states so the page progressively reveals
 * rather than blocking on the slowest call.
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

interface ActivityEvent {
  id: string
  occurred_at: string
  event_type: string
  level: string
  message: string | null
  student_id: string | null
  user_email: string | null
}

interface ActivityResponse {
  events?: ActivityEvent[]
  perStudentErrors?: Array<{
    student_id: string
    error_count: number
    latest_event_type: string
    latest_message: string | null
    latest_at: string
  }>
}

export function CoachTodayView() {
  const router = useRouter()
  const [students, setStudents] = useState<CaseloadStudent[] | null>(null)
  const [activity, setActivity] = useState<ActivityResponse | null>(null)
  const [studentsErr, setStudentsErr] = useState<string | null>(null)
  const [activityErr, setActivityErr] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/coach/students', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { students: CaseloadStudent[] }) => {
        if (!cancelled) setStudents(j.students)
      })
      .catch(e => { if (!cancelled) setStudentsErr(String(e)) })

    fetch('/api/admin/activity?limit=20', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: ActivityResponse) => {
        if (!cancelled) setActivity(j)
      })
      .catch(e => { if (!cancelled) setActivityErr(String(e)) })

    return () => { cancelled = true }
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/admin/sync-le3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'incremental', source: 'd2l_valence_manual' }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        status?: string
        error?: string
      }
      if (!res.ok) {
        setSyncMessage(`Error: ${data.error || res.status}`)
      } else if (data.status === 'enqueued') {
        setSyncMessage('Sync started in background — refresh in a minute to see results.')
      } else if (data.status === 'completed') {
        setSyncMessage('Sync completed.')
      } else {
        setSyncMessage('Sync dispatched.')
      }
    } catch (e) {
      setSyncMessage(`Error: ${String(e)}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <AttentionSection students={students} error={studentsErr} onSelect={id => router.push(`/v2/coach/${id}`)} />
        <SessionsSection />
        <RecentActivitySection activity={activity} error={activityErr} />
      </div>

      <div className="space-y-6">
        <QuickActions
          syncing={syncing}
          syncMessage={syncMessage}
          onSync={handleSync}
          onViewCaseload={() => router.push('/v2/coach/caseload')}
        />
        <CaseloadSummary students={students} />
      </div>
    </div>
  )
}

// ─── Sections ────────────────────────────────────

function AttentionSection({
  students,
  error,
  onSelect,
}: {
  students: CaseloadStudent[] | null
  error: string | null
  onSelect: (id: string) => void
}) {
  if (error) {
    return (
      <Card>
        <SectionHeader title="Needs attention" />
        <ErrorState message={error} />
      </Card>
    )
  }
  if (students === null) {
    return (
      <Card>
        <SectionHeader title="Needs attention" />
        <SkeletonRow />
        <SkeletonRow />
      </Card>
    )
  }
  const flagged = students.filter(s => s.needsAttention)
  return (
    <Card>
      <SectionHeader
        title="Needs attention"
        meta={flagged.length === 0 ? 'All clear' : `${flagged.length} student${flagged.length === 1 ? '' : 's'}`}
      />
      {flagged.length === 0 ? (
        <EmptyState message="Every student on your caseload has been active in the last three weeks." />
      ) : (
        <ul className="space-y-2">
          {flagged.map(s => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-amber-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-semibold shrink-0">
                  {initials(s.firstName, s.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">{reasonFor(s)}</p>
                </div>
                <span className="text-gray-400 shrink-0">→</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function reasonFor(s: CaseloadStudent): string {
  if (!s.lastActivityAt) {
    return s.conversationCount === 0
      ? 'No reflections yet — could use a check-in'
      : 'No recent activity tracked'
  }
  const days = Math.floor(
    (Date.now() - new Date(s.lastActivityAt).getTime()) / (24 * 60 * 60 * 1000)
  )
  if (days < 30) return `No activity in ${days} days`
  return `Inactive for ${Math.floor(days / 30)}+ month${days >= 60 ? 's' : ''}`
}

function SessionsSection() {
  return (
    <Card>
      <SectionHeader
        title="Today's sessions"
        meta={<span className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Stub</span>}
      />
      <div className="text-sm text-gray-600 leading-relaxed">
        Session scheduling isn&rsquo;t wired up yet — once we know what NLU uses
        for coach-student session calendars (Outlook, Google Calendar,
        Brightspace Calendar, manual entry), this surfaces today&rsquo;s upcoming
        sessions with one-click jump to that student&rsquo;s Prep view.
      </div>
    </Card>
  )
}

function RecentActivitySection({
  activity,
  error,
}: {
  activity: ActivityResponse | null
  error: string | null
}) {
  if (error) {
    return (
      <Card>
        <SectionHeader title="Recent activity" />
        <ErrorState message={error} />
      </Card>
    )
  }
  if (activity === null) {
    return (
      <Card>
        <SectionHeader title="Recent activity" />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </Card>
    )
  }

  // Filter to "coach-meaningful" events: conversation lifecycle,
  // work uploads, auth events, errors. Skip llm.* internals (too noisy
  // for a daily summary view; they live in /tools instead).
  const meaningful = (activity.events || []).filter(e =>
    e.event_type.startsWith('conversation.') ||
    e.event_type === 'work.uploaded' ||
    e.event_type === 'consent.acknowledged' ||
    e.event_type === 'auth.signed_in' ||
    e.level === 'error' ||
    e.level === 'fatal'
  ).slice(0, 8)

  if (meaningful.length === 0) {
    return (
      <Card>
        <SectionHeader title="Recent activity" />
        <EmptyState message="No notable events in the last 24 hours." />
      </Card>
    )
  }

  return (
    <Card>
      <SectionHeader title="Recent activity" meta="Last 24h" />
      <ul className="space-y-2">
        {meaningful.map(e => (
          <li key={e.id} className="flex items-baseline gap-3 text-sm">
            <span className="text-[11px] text-gray-400 font-mono whitespace-nowrap w-12">
              {new Date(e.occurred_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="flex-1 min-w-0">
              <span className="font-mono text-[11px] text-gray-500 mr-2">
                {e.event_type}
              </span>
              <span className="text-gray-700">{e.message || '—'}</span>
            </span>
            {(e.level === 'error' || e.level === 'fatal') && (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5 shrink-0">
                {e.level}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function QuickActions({
  syncing,
  syncMessage,
  onSync,
  onViewCaseload,
}: {
  syncing: boolean
  syncMessage: string | null
  onSync: () => void
  onViewCaseload: () => void
}) {
  return (
    <Card>
      <SectionHeader title="Quick actions" />
      <div className="space-y-2">
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {syncing ? 'Syncing…' : 'Sync from D2L'}
        </button>
        <button
          type="button"
          onClick={onViewCaseload}
          className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-white text-gray-700 border border-gray-200 hover:border-gray-400 transition-colors"
        >
          View full caseload
        </button>
      </div>
      {syncMessage && (
        <div className="mt-3 p-2 rounded-md bg-gray-50 border border-gray-200 text-xs text-gray-700">
          {syncMessage}
        </div>
      )}
    </Card>
  )
}

function CaseloadSummary({ students }: { students: CaseloadStudent[] | null }) {
  if (students === null) return null
  if (students.length === 0) return null
  const active = students.filter(s => !s.needsAttention).length
  const flagged = students.length - active
  return (
    <Card>
      <SectionHeader title="Caseload" />
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Total" value={students.length} />
        <Stat label="Active" value={active} color="green" />
        <Stat label="Flagged" value={flagged} color={flagged > 0 ? 'amber' : undefined} />
      </div>
    </Card>
  )
}

// ─── Primitives ─────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">{children}</div>
}

function SectionHeader({
  title,
  meta,
}: {
  title: string
  meta?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {meta && <span className="text-xs text-gray-500">{meta}</span>}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-gray-500 italic py-2">{message}</p>
}

function ErrorState({ message }: { message: string }) {
  return (
    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
      {message}
    </p>
  )
}

function SkeletonRow() {
  return <div className="h-10 mb-2 rounded bg-gray-100 animate-pulse" />
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: 'green' | 'amber'
}) {
  const colorClass =
    color === 'green' ? 'text-green-700' : color === 'amber' ? 'text-amber-700' : 'text-gray-900'
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
      <div className={`text-lg font-semibold ${colorClass}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
    </div>
  )
}

function initials(first: string, last: string): string {
  return ((first[0] || '') + (last[0] || '')).toUpperCase()
}
