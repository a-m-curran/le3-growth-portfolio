'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ConversationPanel } from '@/components/panels/ConversationPanel'
import { ReflectForm } from '@/app/reflect/ReflectForm'

/**
 * v2 Journal view — open standalone reflections.
 *
 * Top: composer (reuses v1 ReflectForm, which posts to
 * /api/reflect/start and then routes the user to /conversation/[id]
 * for the actual three-phase flow). When we eventually build a v2
 * conversation flow we'll swap this hand-off.
 *
 * Middle: in-progress entries → resume to v1 /conversation/[id]
 * Bottom: completed entries → open in ConversationPanel slide-out
 */

interface JournalResponse {
  inProgress: Array<{
    id: string
    startedAt: string
    description: string | null
    currentPhase: 1 | 2 | 3
  }>
  completed: Array<{
    id: string
    startedAt: string
    completedAt: string | null
    description: string | null
    synthesisExcerpt: string | null
  }>
}

export function JournalView() {
  const [data, setData] = useState<JournalResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/journal', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as JournalResponse
      })
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-5">
      {/* Composer */}
      <Card>
        <ReflectForm />
      </Card>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
          Couldn&rsquo;t load past entries: {error}
        </div>
      )}

      {/* Lists */}
      {data === null && !error ? (
        <>
          <div className="h-24 rounded-2xl bg-white border border-gray-200 animate-pulse" />
          <div className="h-24 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        </>
      ) : data && (
        <>
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
                      className="w-full text-left p-3 rounded-lg bg-amber-50/50 border border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition-colors"
                    >
                      <p className="text-sm text-gray-900 line-clamp-2">
                        {c.description || 'Reflection'}
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Phase {c.currentPhase} · Started {formatRelative(c.startedAt)} · View →
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Past */}
          {data.completed.length > 0 && (
            <Card>
              <SectionHeader
                title="Past entries"
                meta={`${data.completed.length} reflection${data.completed.length === 1 ? '' : 's'}`}
              />
              <ul className="space-y-2">
                {data.completed.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setOpenConversationId(c.id)}
                      className="w-full text-left p-3 rounded-lg bg-gray-50 border border-gray-100 hover:border-green-300 hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1 flex-1">
                          {c.description || 'Reflection'}
                        </p>
                        <span className="text-xs text-gray-400 shrink-0">
                          {c.completedAt && formatRelative(c.completedAt)}
                        </span>
                      </div>
                      {c.synthesisExcerpt && (
                        <p className="text-xs text-gray-600 italic line-clamp-2">
                          {c.synthesisExcerpt}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.inProgress.length === 0 && data.completed.length === 0 && (
            <p className="text-xs text-gray-500 italic text-center py-2">
              Your journal entries will appear here.
            </p>
          )}
        </>
      )}

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

function SectionHeader({ title, meta }: { title: string; meta?: string }) {
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
