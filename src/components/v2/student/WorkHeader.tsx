'use client'

import { useEffect, useState } from 'react'

/**
 * Conversation/reflection header box — title + course + optional
 * expandable "show submission" panel.
 *
 * Shared between:
 *   - The in-progress reflection screen (ConversationView).
 *   - The completed-conversation view (ConversationFullView).
 *
 * The expandable panel reveals student_work.content (the text of what
 * the student originally submitted to D2L). Designed to help students
 * remember the assignment when they reflect days or weeks later — a
 * common case once we backfill historical work.
 *
 * Behavior:
 *   - The chevron + "Show submission"/"Hide submission" label only
 *     appears when workContent is non-empty.
 *   - Expand state is persisted per-conversation in sessionStorage so
 *     a page reload (e.g. from the conversation router) keeps the
 *     student's choice for that conversation.
 *   - Long submissions (~8 KB max observed) render in a scrollable
 *     panel — max-h-96, overflow-y-auto, whitespace-pre-wrap.
 */

interface WorkHeaderProps {
  workTitle: string | null
  courseName: string | null
  workContent?: string | null
  /** Conversation id — used as the sessionStorage key for expand-state persistence. */
  conversationId: string
}

const STORAGE_PREFIX = 'submission-expanded:'

export function WorkHeader({
  workTitle,
  courseName,
  workContent,
  conversationId,
}: WorkHeaderProps) {
  const hasContent = !!workContent && workContent.trim().length > 0
  // Mount with expanded=false so server-rendered markup matches client's
  // first paint (sessionStorage isn't available SSR). Then on mount,
  // hydrate from sessionStorage if a stored preference exists.
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!hasContent) return
    try {
      const stored = sessionStorage.getItem(STORAGE_PREFIX + conversationId)
      if (stored === '1') setExpanded(true)
    } catch {
      // sessionStorage can throw in private-browsing edge cases; safe to ignore.
    }
  }, [conversationId, hasContent])

  function toggle() {
    setExpanded(prev => {
      const next = !prev
      try {
        sessionStorage.setItem(STORAGE_PREFIX + conversationId, next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">📄</span>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-gray-900 truncate">
            {workTitle || 'Reflection'}
          </h1>
          {courseName && (
            <p className="text-sm text-gray-500 mt-0.5">{courseName}</p>
          )}
        </div>
      </div>
      {hasContent && (
        <>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            className="mt-3 flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
            <span>{expanded ? 'Hide submission' : 'Show submission'}</span>
          </button>
          {expanded && (
            <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 p-3 max-h-96 overflow-y-auto">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {workContent}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
