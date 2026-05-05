'use client'

import { useEffect, useState } from 'react'
import type { SessionPrepData } from '@/lib/types'
import { NoteCapture } from './NoteCapture'

/**
 * Coach session prep panel.
 *
 * Previously imported `getStudentWork` from the static seed (always
 * missed for DB UUIDs → "Reflection" fallback always shown) and used
 * `t.skillId.replace('skill_', '')` to derive a tag label (a regex
 * that no-ops on UUIDs, producing capitalized hex labels like
 * "F449d9a4-9ac0-9e41-1d7f-8466780eef96").
 *
 * Now resolves skill names via /api/skills (cached at the API layer).
 * Work titles are sourced from data.recentConversations[i].workTitle
 * if the parent query populates it; otherwise falls back to "Reflection".
 *
 * NOTE: queries.ts may not yet populate workTitle on the conversation
 * shape — that's a small follow-up in the data layer. Until then,
 * work titles will read "Reflection" but at minimum nothing renders
 * UUIDs anymore.
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
            // Work title may be populated by the query layer in DB mode.
            // Fallback to "Reflection" rather than ever showing a UUID.
            const workTitle =
              (conv as unknown as { workTitle?: string }).workTitle || 'Reflection'
            const date = new Date(conv.startedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
            return (
              <div key={conv.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">📝</span>
                  <span className="text-sm font-medium text-gray-700">{workTitle}</span>
                  <span className="text-xs text-gray-400">({date})</span>
                </div>
                {conv.suggestedInsight && (
                  <p className="text-xs text-gray-600 ml-6">{conv.suggestedInsight}</p>
                )}
                {conv.skillTags.length > 0 && (
                  <p className="text-xs text-gray-400 ml-6 mt-1">
                    → Tagged:{' '}
                    {conv.skillTags
                      .map(t => skillNameById.get(t.skillId) || '…')
                      .filter(s => s !== '…' || skillNameById.size > 0)
                      .join(', ')}
                  </p>
                )}
              </div>
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
    </div>
  )
}
