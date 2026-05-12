'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { SessionPrepData } from '@/lib/types'
import { NoteCapture } from './NoteCapture'
import { ConversationPanel } from '@/components/panels/ConversationPanel'

/**
 * Coach session prep panel.
 *
 * Surfaces the last few conversations a student had since the coach's
 * previous session. Each conversation card is clickable and opens the
 * full ConversationPanel slide-out so the coach can read the actual
 * prompts + responses + synthesis — not just the one-line suggested
 * insight summary. The previous version rendered cards as static divs
 * with no affordance to drill in; coaches were left with summaries
 * but no way to read the full conversation.
 *
 * Skill names are resolved via /api/skills (which is demo-mode aware:
 * returns static seed in demo, durable_skill rows in prod). Tags that
 * can't resolve are quietly omitted rather than rendered as "…", which
 * was confusing — "..., ..." looked like missing data when it really
 * meant "this tag references an ID we don't recognize."
 */

interface AvailableSkill {
  id: string
  name: string
  pillarName: string
}

interface SessionPrepProps {
  data: SessionPrepData
}

export function SessionPrep({ data }: SessionPrepProps) {
  const { student, recentConversations, patterns, currentGoals, lastNote } = data
  const [skillNameById, setSkillNameById] = useState<Map<string, string>>(new Map())
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/skills', { cache: 'force-cache' })
      .then(r => r.json())
      .then((j: { skills?: AvailableSkill[] }) => {
        if (cancelled) return
        setSkillNameById(new Map((j.skills ?? []).map(s => [s.id, s.name])))
      })
      .catch(err => {
        console.warn('Failed to load /api/skills:', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Recent Conversations */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Since your last session{lastNote ? ` (${lastNote.sessionDate})` : ''}:
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          {recentConversations.length} Growth Conversation
          {recentConversations.length !== 1 ? 's' : ''} completed
        </p>

        <div className="space-y-3">
          {recentConversations.map(conv => {
            const workTitle =
              (conv as unknown as { workTitle?: string }).workTitle || 'Reflection'
            const date = new Date(conv.startedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })

            // Resolve tag names. Tags that don't resolve are omitted —
            // showing "…, …" was more confusing than helpful.
            const tagNames = conv.skillTags
              .map(t => skillNameById.get(t.skillId))
              .filter((s): s is string => !!s)

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => setOpenConversationId(conv.id)}
                className="w-full text-left p-3 rounded-lg bg-gray-50 border border-gray-100 hover:border-green-400 hover:bg-white hover:shadow-sm transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">📝</span>
                  <span className="text-sm font-medium text-gray-700">{workTitle}</span>
                  <span className="text-xs text-gray-400">({date})</span>
                  <span className="ml-auto text-xs text-gray-400">Read →</span>
                </div>
                {conv.suggestedInsight && (
                  <p className="text-xs text-gray-600 ml-6">{conv.suggestedInsight}</p>
                )}
                {tagNames.length > 0 && (
                  <p className="text-xs text-gray-400 ml-6 mt-1">
                    → Tagged: {tagNames.join(', ')}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Patterns */}
      {patterns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 border-t pt-4">
            Patterns to Explore
          </h3>
          <ul className="space-y-2">
            {patterns.map((p, i) => (
              <li key={i} className="text-sm text-gray-600 flex gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Current Goals */}
      {currentGoals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 border-t pt-4">
            Active Goals
          </h3>
          <ul className="space-y-2">
            {currentGoals.map(goal => (
              <li key={goal.id} className="text-sm text-gray-600">
                {goal.goalText}
                {goal.progressNotes && (
                  <p className="text-xs text-gray-400 mt-0.5">{goal.progressNotes}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Note Capture */}
      <div className="border-t pt-4">
        <NoteCapture studentName={student.firstName} />
      </div>

      {/* Drill-in panel */}
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
