'use client'

import { useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { GardenPlant } from '@/lib/types'
import { SDT_LEVELS } from '@/lib/constants'
import { ConversationPanel } from './ConversationPanel'
import { useState } from 'react'

interface SkillPanelProps {
  plant: GardenPlant
  onClose: () => void
}

export function SkillPanel({ plant, onClose }: SkillPanelProps) {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const level = plant.sdtLevel as 1 | 2 | 3 | 4
  const config = SDT_LEVELS[level]

  useEffect(() => {
    // Delay enabling backdrop close to prevent the opening click from closing
    const timer = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(timer)
  }, [])

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

  const selfLevelName = plant.selfLevel
    ? SDT_LEVELS[plant.selfLevel as 1 | 2 | 3 | 4].name
    : null
  const aligned = plant.selfLevel === plant.sdtLevel

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/30"
          onClick={() => { if (ready) onClose() }}
        />

        {/* Panel */}
        <motion.div
          className="relative w-full max-w-md bg-white shadow-xl overflow-y-auto"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
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
                  ← Back
                </button>
                <h2 className="text-xl font-bold text-green-900">{plant.skillName}</h2>
                <p className="text-sm text-gray-500">{plant.pillarName}</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl"
                aria-label="Close panel"
              >
                ×
              </button>
            </div>

            {/* SDT Level */}
            <div className="mb-6 p-3 rounded-lg" style={{ backgroundColor: config.bg }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{config.emoji}</span>
                <span className="font-semibold" style={{ color: config.color }}>
                  {config.name}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                Coach: {config.name}
                {selfLevelName && ` · Self: ${selfLevelName}`}
                {selfLevelName && (
                  <span className={aligned ? ' text-green-600' : ' text-amber-600'}>
                    {aligned ? ' ✓ Aligned' : ' — Gap worth discussing'}
                  </span>
                )}
              </div>
            </div>

            {/* Definition Journey */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">
                Definition Journey
              </h3>

              {plant.previousDefinition && (
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1">Earlier definition</p>
                  <p className="text-sm text-gray-600 italic">
                    &ldquo;{plant.previousDefinition}&rdquo;
                  </p>
                </div>
              )}

              {plant.previousDefinition && plant.currentDefinition && (
                <div className="text-center text-xs text-green-600 my-2">
                  ↓ across {plant.conversationCount} conversations ↓
                </div>
              )}

              {plant.currentDefinition && (
                <div>
                  {plant.definitionRevised && (
                    <p className="text-xs text-gray-400 mb-1">Current definition</p>
                  )}
                  <p className="text-sm text-gray-800 italic font-medium">
                    &ldquo;{plant.currentDefinition}&rdquo;
                  </p>
                </div>
              )}

              {!plant.currentDefinition && (
                <p className="text-sm text-gray-400 italic">No definition on file yet.</p>
              )}
            </div>

            {/* Conversations */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">
                Conversations ({plant.conversations.length})
              </h3>
              <div className="space-y-2">
                {plant.conversations.map(conv => {
                  const date = new Date(conv.date)
                  const dateStr = date.toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConvId(conv.id)}
                      className="w-full text-left p-3 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs">🍃</span>
                        <span className="text-xs font-medium text-gray-700">{dateStr}</span>
                        <span className="text-xs text-gray-400">—</span>
                        <span className="text-xs text-gray-600">{conv.workTitle}</span>
                      </div>
                      <p className="text-xs text-gray-500 italic ml-5">
                        &ldquo;{conv.pullQuote}&rdquo;
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Nested conversation panel */}
      {selectedConvId && (
        <ConversationPanel
          conversationId={selectedConvId}
          onClose={() => setSelectedConvId(null)}
        />
      )}
    </>
  )
}
