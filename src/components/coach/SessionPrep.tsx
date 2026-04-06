'use client'

import type { SessionPrepData } from '@/lib/types'
import { getStudentWork } from '@/data'
import { NoteCapture } from './NoteCapture'

interface SessionPrepProps {
  data: SessionPrepData
}

export function SessionPrep({ data }: SessionPrepProps) {
  const { student, recentConversations, patterns, currentGoals, lastNote } = data

  return (
    <div className="space-y-6">
      {/* Recent Conversations */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Since your last session{lastNote ? ` (${lastNote.sessionDate})` : ''}:
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          {recentConversations.length} Growth Conversation{recentConversations.length !== 1 ? 's' : ''} completed
        </p>

        <div className="space-y-3">
          {recentConversations.map(conv => {
            const work = conv.workId ? getStudentWork(conv.workId) : null
            const date = new Date(conv.startedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
            return (
              <div key={conv.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">📝</span>
                  <span className="text-sm font-medium text-gray-700">
                    {work?.title || 'Reflection'}
                  </span>
                  <span className="text-xs text-gray-400">({date})</span>
                </div>
                {conv.suggestedInsight && (
                  <p className="text-xs text-gray-600 ml-6">
                    {conv.suggestedInsight}
                  </p>
                )}
                {conv.skillTags.length > 0 && (
                  <p className="text-xs text-gray-400 ml-6 mt-1">
                    → Tagged: {conv.skillTags.map(t => {
                      const name = t.skillId.replace('skill_', '').replace(/_/g, ' ')
                      return name.charAt(0).toUpperCase() + name.slice(1)
                    }).join(', ')}
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
