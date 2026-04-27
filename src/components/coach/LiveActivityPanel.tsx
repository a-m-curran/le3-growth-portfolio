'use client'

import { useEffect, useState, useCallback } from 'react'

/**
 * Coach-only "what's happening right now" panel.
 *
 * Shows a feed of recent event_log rows + a counts strip + per-student
 * error rollup. Designed for at-a-glance triage when a student emails
 * their coach saying "this felt weird" or just to keep an eye on
 * pilot health.
 *
 * Auto-refreshes every 30s when expanded so coaches can leave it open
 * during active sessions and see new events appear.
 *
 * Filters:
 *   - Level: all | errors only | warnings+
 *   - Type: all | llm | conversation | work | sync | lti | other
 *
 * Per-event row is collapsed by default (one-line summary); click to
 * expand and see the full context JSON.
 */

interface ActivityResponse {
  counts: {
    last24h_total: number
    last24h_errors: number
    last24h_warnings: number
    last24h_llm_calls: number
    last24h_conversations: number
    last24h_work_uploads: number
  }
  perStudentErrors: Array<{
    student_id: string
    error_count: number
    latest_event_type: string
    latest_message: string | null
    latest_at: string
  }>
  events: Array<{
    id: string
    occurred_at: string
    actor_type: string
    actor_id: string | null
    student_id: string | null
    event_type: string
    level: string
    message: string | null
    context: Record<string, unknown> | null
    request_id: string | null
    duration_ms: number | null
  }>
  totalErrorsLast24h: number
}

type LevelFilter = 'all' | 'error_or_fatal' | 'warn'
type TypePrefix =
  | ''
  | 'llm.'
  | 'conversation.'
  | 'work.'
  | 'sync.'
  | 'lti.'
  | 'auth.'

export function LiveActivityPanel() {
  const [data, setData] = useState<ActivityResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypePrefix>('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [autoRefresh, setAutoRefresh] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (levelFilter !== 'all') params.set('level', levelFilter)
      if (typeFilter) params.set('event_type', typeFilter)
      params.set('limit', '50')
      const res = await fetch(`/api/admin/activity?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      setData((await res.json()) as ActivityResponse)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [levelFilter, typeFilter])

  // Re-fetch whenever filters change
  useEffect(() => {
    load()
  }, [load])

  // Auto-refresh every 30s when enabled
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [autoRefresh, load])

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mb-6 p-4 rounded-xl bg-white border border-gray-200">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
            Live Activity
          </h3>
          <p className="text-xs text-gray-500">
            Real-time feed of LLM calls, conversation lifecycle, work
            uploads, and any errors. Auto-refreshes every 30s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-gray-600 flex items-center gap-1">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
            />
            Auto
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-2 p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Counts strip — last 24h */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
            <Count label="Events / 24h" value={data.counts.last24h_total} />
            <Count
              label="Errors"
              value={data.counts.last24h_errors}
              highlight={data.counts.last24h_errors > 0 ? 'bad' : 'good'}
            />
            <Count
              label="Warnings"
              value={data.counts.last24h_warnings}
              highlight={data.counts.last24h_warnings > 0 ? 'warn' : undefined}
            />
            <Count label="LLM Calls" value={data.counts.last24h_llm_calls} />
            <Count
              label="Conversations"
              value={data.counts.last24h_conversations}
            />
            <Count label="Work Uploads" value={data.counts.last24h_work_uploads} />
          </div>

          {/* Per-student error rollup */}
          {data.perStudentErrors.length > 0 && (
            <div className="mb-3 p-2 rounded border border-amber-200 bg-amber-50">
              <div className="text-[11px] font-semibold text-amber-900 mb-1 uppercase tracking-wide">
                Students with errors in the last 24h
              </div>
              <ul className="space-y-1 text-xs text-amber-900">
                {data.perStudentErrors.map(s => (
                  <li key={s.student_id} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-mono text-[10px]">
                        {s.student_id.slice(0, 8)}…
                      </span>{' '}
                      <span className="font-semibold">
                        {s.error_count} error{s.error_count === 1 ? '' : 's'}
                      </span>{' '}
                      <span className="text-gray-700">
                        — last: {s.latest_event_type}{' '}
                        {s.latest_message && (
                          <span className="italic">"{s.latest_message.slice(0, 60)}"</span>
                        )}
                      </span>
                    </span>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">
                      {new Date(s.latest_at).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 mb-3 text-[11px] flex-wrap">
            <span className="text-gray-500">Filter:</span>
            <FilterBtn
              label="all levels"
              active={levelFilter === 'all'}
              onClick={() => setLevelFilter('all')}
            />
            <FilterBtn
              label="errors"
              active={levelFilter === 'error_or_fatal'}
              onClick={() => setLevelFilter('error_or_fatal')}
            />
            <FilterBtn
              label="warnings"
              active={levelFilter === 'warn'}
              onClick={() => setLevelFilter('warn')}
            />
            <span className="ml-2 text-gray-500">/</span>
            <FilterBtn
              label="all types"
              active={typeFilter === ''}
              onClick={() => setTypeFilter('')}
            />
            <FilterBtn
              label="llm"
              active={typeFilter === 'llm.'}
              onClick={() => setTypeFilter('llm.')}
            />
            <FilterBtn
              label="conv"
              active={typeFilter === 'conversation.'}
              onClick={() => setTypeFilter('conversation.')}
            />
            <FilterBtn
              label="work"
              active={typeFilter === 'work.'}
              onClick={() => setTypeFilter('work.')}
            />
            <FilterBtn
              label="lti"
              active={typeFilter === 'lti.'}
              onClick={() => setTypeFilter('lti.')}
            />
            <FilterBtn
              label="auth"
              active={typeFilter === 'auth.'}
              onClick={() => setTypeFilter('auth.')}
            />
          </div>

          {/* Event feed */}
          {data.events.length === 0 ? (
            <div className="italic text-gray-500 py-4 text-center text-xs">
              No events match the current filters.
            </div>
          ) : (
            <div className="space-y-1">
              {data.events.map(e => (
                <EventRow
                  key={e.id}
                  event={e}
                  expanded={expanded.has(e.id)}
                  onToggle={() => toggleExpand(e.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EventRow({
  event,
  expanded,
  onToggle,
}: {
  event: ActivityResponse['events'][number]
  expanded: boolean
  onToggle: () => void
}) {
  const levelClass =
    event.level === 'fatal' || event.level === 'error'
      ? 'border-l-red-500'
      : event.level === 'warn'
      ? 'border-l-amber-500'
      : 'border-l-gray-300'
  const levelBadge =
    event.level === 'fatal'
      ? 'bg-red-700 text-white'
      : event.level === 'error'
      ? 'bg-red-100 text-red-800 border border-red-200'
      : event.level === 'warn'
      ? 'bg-amber-100 text-amber-800 border border-amber-200'
      : 'bg-gray-100 text-gray-700 border border-gray-200'

  return (
    <div className={`p-2 rounded border border-gray-100 border-l-2 ${levelClass} bg-gray-50`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-center gap-2 text-[11px]"
      >
        <span className="font-mono text-gray-500 whitespace-nowrap text-[10px]">
          {new Date(event.occurred_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${levelBadge}`}>
          {event.level}
        </span>
        <span className="font-mono text-gray-800">{event.event_type}</span>
        {event.duration_ms != null && (
          <span className="text-gray-500 text-[10px]">{event.duration_ms}ms</span>
        )}
        {event.student_id && (
          <span className="font-mono text-[9px] text-gray-500">
            stu:{event.student_id.slice(0, 8)}
          </span>
        )}
        {event.message && (
          <span className="text-gray-700 truncate flex-1">
            {event.message}
          </span>
        )}
        <span className="text-gray-400 text-[10px]">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="mt-2 pl-2 border-l border-gray-200 text-[10px] text-gray-700">
          <div className="grid grid-cols-2 gap-x-3 mb-2">
            <div>
              <span className="text-gray-500">actor:</span>{' '}
              <span className="font-mono">
                {event.actor_type}
                {event.actor_id && `:${event.actor_id.slice(0, 12)}`}
              </span>
            </div>
            {event.request_id && (
              <div>
                <span className="text-gray-500">request:</span>{' '}
                <span className="font-mono">{event.request_id}</span>
              </div>
            )}
          </div>
          {event.context && Object.keys(event.context).length > 0 && (
            <pre className="p-2 rounded bg-white border border-gray-200 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(event.context, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function Count({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: 'good' | 'bad' | 'warn'
}) {
  const color =
    highlight === 'good'
      ? 'text-green-700'
      : highlight === 'bad'
      ? 'text-red-700'
      : highlight === 'warn'
      ? 'text-amber-700'
      : 'text-gray-900'
  return (
    <div className="p-2 rounded bg-gray-50 border border-gray-100 text-center">
      <div className={`text-base font-semibold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  )
}

function FilterBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-[10px] ${
        active
          ? 'bg-green-700 text-white'
          : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-400'
      }`}
    >
      {label}
    </button>
  )
}
