'use client'

import { useEffect, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { getConversation } from '@/data'
import { getSkill, getStudentWork } from '@/data'
import { CONVERSATION } from '@/lib/constants'
import type { GrowthConversation } from '@/lib/types'

interface ConversationPanelProps {
  conversationId: string
  onClose: () => void
}

export function ConversationPanel({ conversationId, onClose }: ConversationPanelProps) {
  const [conversation, setConversation] = useState<GrowthConversation | null>(null)

  useEffect(() => {
    const conv = getConversation(conversationId)
    setConversation(conv ?? null)
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

  if (!conversation) return null

  const work = conversation.workId ? getStudentWork(conversation.workId) : null
  const date = new Date(conversation.startedAt).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })

  const phases = [
    { q: conversation.promptPhase1, a: conversation.responsePhase1, color: CONVERSATION.phase1, label: 'What Happened' },
    { q: conversation.promptPhase2, a: conversation.responsePhase2, color: CONVERSATION.phase2, label: 'What You Did' },
    { q: conversation.promptPhase3, a: conversation.responsePhase3, color: CONVERSATION.phase3, label: 'What It Means' },
  ]

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
                {work?.title || 'Reflection'}
              </h2>
              <p className="text-sm text-gray-500">
                {work?.courseName && `${work.courseName} · `}{date}
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

          {/* Phases */}
          <div className="space-y-6">
            {phases.map((phase, i) => (
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
                    <blockquote className="text-sm text-gray-600 italic border-l-2 pl-3 ml-1" style={{ borderColor: phase.color }}>
                      &ldquo;{phase.a}&rdquo;
                    </blockquote>
                  )}
                </div>
              )
            ))}
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
                {conversation.skillTags.map(tag => {
                  const skill = getSkill(tag.skillId)
                  return (
                    <span
                      key={tag.skillId}
                      className={`text-xs px-2.5 py-1 rounded-full ${
                        tag.studentConfirmed
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tag.studentConfirmed ? '✓ ' : ''}{skill?.name || tag.skillId}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
