'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ConversationPanel } from '@/components/panels/ConversationPanel'
import type { GrowthConversation } from '@/lib/types'

/**
 * Client-side wrapper for the "Past Reflections" section of /reflect.
 *
 * Renders each completed reflection as a clickable card; clicking
 * opens the same ConversationPanel slide-out used elsewhere in the
 * app (garden plant detail, coach views). No new read-only page —
 * the panel is the canonical "view a past conversation" surface.
 *
 * Previously these cards used `href="#"` so they appeared clickable
 * but did nothing. This fixes that without changing the in-progress
 * reflection flow (those still navigate to /conversation/[id] to
 * resume).
 */
interface PastReflectionsListProps {
  reflections: GrowthConversation[]
}

export function PastReflectionsList({ reflections }: PastReflectionsListProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (reflections.length === 0) return null

  return (
    <>
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Past Reflections ({reflections.length})
        </h2>
        <div className="space-y-3">
          {reflections.map(r => (
            <PastReflectionCard
              key={r.id}
              reflection={r}
              onClick={() => setOpenId(r.id)}
            />
          ))}
        </div>
      </section>

      <AnimatePresence>
        {openId && (
          <ConversationPanel
            conversationId={openId}
            onClose={() => setOpenId(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function PastReflectionCard({
  reflection,
  onClick,
}: {
  reflection: GrowthConversation
  onClick: () => void
}) {
  const description =
    reflection.reflectionDescription || reflection.workContext || 'Reflection'
  const date = new Date(reflection.startedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left block p-4 rounded-xl bg-white border border-gray-200 hover:border-green-400 hover:shadow-sm transition-colors"
    >
      <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{description}</h3>
      <p className="text-xs text-gray-500 mt-1">
        {date}
        <span className="ml-2 text-green-600">Completed</span>
      </p>
      {reflection.synthesisText && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-2 italic">
          {reflection.synthesisText.substring(0, 120)}…
        </p>
      )}
    </button>
  )
}
