'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { ConversationPanel } from '@/components/panels/ConversationPanel'

/**
 * v2 Reflect view — work-tied reflections list.
 *
 * Three sections: in progress (resume), featured work (start new),
 * completed (read past). Each navigates to the right surface:
 *   - in progress  → v1 /conversation/[id] (resume the active flow)
 *   - featured     → v1 /reflect?work=<id> (start a new reflection)
 *                    Eventually we'll build a v2 conversation flow,
 *                    but until then v1's flow is the canonical path.
 *   - completed    → ConversationPanel slide-out (read-only display)
 */

interface ReflectResponse {
  inProgress: Array<{
    id: string
    workId: string | null
    workTitle: string | null
    startedAt: string
    currentPhase: 1 | 2 | 3
  }>
  completed: Array<{
    id: string
    workId: string | null
    workTitle: string | null
    completedAt: string | null
    synthesisExcerpt: string | null
    skillTagCount: number
  }>
  featuredWork: Array<{
    id: string
    title: string
    courseName: string | null
    submittedAt: string | null
    workType: string | null
  }>
}

export function ReflectView() {
  const router = useRouter()
  const [data, setData] = useState<ReflectResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)

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
  }, [])

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

  const hasAny =
    data.inProgress.length > 0 ||
    data.completed.length > 0 ||
    data.featuredWork.length > 0

  if (!hasAny) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
        <p className="text-gray-600">Nothing to reflect on yet.</p>
        <p className="text-xs text-gray-500 mt-2">
          When you submit work to D2L, it&rsquo;ll show up here ready for
          reflection.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* In progress */}
      {data.inProgress.length > 0 && (
        <Card>
          <SectionHeader title="In progress" meta="Pick up where you left off" />
          <ul className="space-y-2">
            {data.inProgress.map(c => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpenConversationId(c.id)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-amber-50/50 border border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {c.workTitle || 'Reflection'}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Phase {c.currentPhase} · Started {formatRelative(c.startedAt)}
                    </p>
                  </div>
                  <span className="text-amber-600 text-sm shrink-0">View →</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Featured work */}
      {data.featuredWork.length > 0 && (
        <Card>
          <SectionHeader
            title="Ready to reflect on"
            meta={`${data.featuredWork.length} submission${data.featuredWork.length === 1 ? '' : 's'}`}
          />
          <ul className="space-y-2">
            {data.featuredWork.map(w => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/v2/reflect/start?work=${w.id}`)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{w.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {w.courseName && `${w.courseName} · `}
                      {w.submittedAt ? `Submitted ${formatRelative(w.submittedAt)}` : 'Recently added'}
                    </p>
                  </div>
                  <span className="text-green-700 text-sm shrink-0">Start →</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Completed */}
      {data.completed.length > 0 && (
        <Card>
          <SectionHeader
            title="Past reflections"
            meta={`${data.completed.length} completed · click to replay`}
          />
          <ul className="space-y-2">
            {data.completed.map(c => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/v2/conversation/${c.id}`)}
                  className="w-full text-left p-3 rounded-lg bg-gray-50 border border-gray-100 hover:border-green-300 hover:bg-white transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate flex-1">
                      {c.workTitle || 'Reflection'}
                    </p>
                    <span className="text-xs text-gray-400 shrink-0">
                      {c.completedAt && formatRelative(c.completedAt)}
                    </span>
                    <span className="text-gray-400 text-sm">→</span>
                  </div>
                  {c.synthesisExcerpt && (
                    <p className="text-xs text-gray-600 italic line-clamp-2">
                      {c.synthesisExcerpt}
                    </p>
                  )}
                  {c.skillTagCount > 0 && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      {c.skillTagCount} skill{c.skillTagCount === 1 ? '' : 's'} tagged
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Conversation slide-out for completed reflections */}
      <AnimatePresence>
        {openConversationId && (
          <ConversationPanel
            conversationId={openConversationId}
            onClose={() => setOpenConversationId(null)}
          />
        )}
      </AnimatePresence>
    </div>
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
  meta?: string
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {meta && <span className="text-xs text-gray-500">{meta}</span>}
    </div>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const days = Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000))
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}
