'use client'

import { useEffect, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { CONVERSATION } from '@/lib/constants'

/**
 * Slide-out panel showing a single past growth conversation.
 *
 * Fetches the conversation from /api/conversations/[id], which
 * returns the full prompts/responses + work title + skill tags
 * (with names already joined from durable_skill so this component
 * doesn't need a second round-trip). Replaces the previous
 * static-seed lookup that silently rendered nothing in DB mode.
 */

interface ConversationDetail {
  id: string
  studentId: string
  workId: string | null
  status: string
  startedAt: string
  completedAt: string | null
  durationSeconds: number | null
  workTitle: string | null
  courseName: string | null
  courseCode: string | null
  promptPhase1: string | null
  responsePhase1: string | null
  promptPhase2: string | null
  responsePhase2: string | null
  promptPhase3: string | null
  responsePhase3: string | null
  synthesisText: string | null
  suggestedInsight: string | null
  skillTags: Array<{
    skillId: string
    skillName: string | null
    confidence: number
    studentConfirmed: boolean
    rationale: string | null
  }>
}

interface ConversationPanelProps {
  conversationId: string
  onClose: () => void
}

export function ConversationPanel({ conversationId, onClose }: ConversationPanelProps) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/conversations/${conversationId}`, { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as ConversationDetail
      })
      .then(data => {
        if (cancelled) return
        setConversation(data)
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        console.warn('Failed to load conversation:', err)
        setError(String(err))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [conversationId])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const phases = conversation
    ? [
        {
          q: conversation.promptPhase1,
          a: conversation.responsePhase1,
          color: CONVERSATION.phase1,
          label: 'What Happened',
        },
        {
          q: conversation.promptPhase2,
          a: conversation.responsePhase2,
          color: CONVERSATION.phase2,
          label: 'What You Did',
        },
        {
          q: conversation.promptPhase3,
          a: conversation.responsePhase3,
          color: CONVERSATION.phase3,
          label: 'What It Means',
        },
      ]
    : []

  const date = conversation
    ? new Date(conversation.startedAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : ''

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <button
                onClick={onClose}
                className="text-sm text-gray-500 hover:text-gray-700 mb-1"
              >
                ← Conversation
              </button>
              <h2 className="text-lg font-bold text-gray-900">
                {conversation?.workTitle || (loading ? 'Loading…' : 'Reflection')}
              </h2>
              <p className="text-sm text-gray-500">
                {conversation?.courseName ? `${conversation.courseName} · ` : ''}
                {date}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
              aria-label="Close panel"
            >
              ×
            </button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2 animate-pulse">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-4 w-full bg-gray-100 rounded" />
                  <div className="h-4 w-3/4 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              Couldn&rsquo;t load this conversation: {error}
            </div>
          )}

          {/* Phases */}
          {conversation && !loading && !error && (
            <>
              <div className="space-y-6">
                {phases.map(
                  (phase, i) =>
                    phase.q && (
                      <div key={i}>
                        <div
                          className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                          style={{ color: phase.color }}
                        >
                          Phase {i + 1}: {phase.label}
                        </div>
                        <div className="mb-2">
                          <p className="text-sm text-gray-700">{phase.q}</p>
                        </div>
                        {phase.a && (
                          <blockquote
                            className="text-sm text-gray-600 italic border-l-2 pl-3 ml-1"
                            style={{ borderColor: phase.color }}
                          >
                            &ldquo;{phase.a}&rdquo;
                          </blockquote>
                        )}
                      </div>
                    )
                )}
              </div>

              {/* Synthesis */}
              {conversation.synthesisText && (
                <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Synthesis</p>
                  <p className="text-sm text-amber-900">{conversation.synthesisText}</p>
                </div>
              )}

              {/* Skill Tags */}
              {conversation.skillTags.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {conversation.skillTags.map(tag => (
                      <span
                        key={tag.skillId}
                        className={`text-xs px-2.5 py-1 rounded-full ${
                          tag.studentConfirmed
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                        title={tag.rationale ?? undefined}
                      >
                        {tag.studentConfirmed ? '✓ ' : ''}
                        {tag.skillName ?? tag.skillId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
