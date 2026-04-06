'use client'

import { useState, useEffect, useRef } from 'react'
import { CONVERSATION } from '@/lib/constants'

interface ConversationPhaseProps {
  phase: 1 | 2 | 3
  prompt: string
  prewrittenResponse?: string
  previousResponse?: string
  onSubmit: (response: string) => void
  isDemoMode?: boolean
}

const PHASE_LABELS = {
  1: 'What Happened',
  2: 'What You Did',
  3: 'What It Means',
}

const PHASE_COLORS = {
  1: CONVERSATION.phase1,
  2: CONVERSATION.phase2,
  3: CONVERSATION.phase3,
}

export function ConversationPhase({
  phase,
  prompt,
  prewrittenResponse,
  previousResponse,
  onSubmit,
  isDemoMode = true,
}: ConversationPhaseProps) {
  const [response, setResponse] = useState('')
  const [displayedChars, setDisplayedChars] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasPrewritten = isDemoMode && !!prewrittenResponse

  // Demo mode: typewriter effect for pre-written responses
  useEffect(() => {
    if (!hasPrewritten || !prewrittenResponse) return

    setDisplayedChars(0)
    const interval = setInterval(() => {
      setDisplayedChars(prev => {
        const next = prev + 2
        if (next >= prewrittenResponse.length) {
          clearInterval(interval)
          return prewrittenResponse.length
        }
        return next
      })
    }, 15)

    return () => clearInterval(interval)
  }, [hasPrewritten, prewrittenResponse])

  // Sync final response when typing completes
  useEffect(() => {
    if (hasPrewritten && prewrittenResponse && displayedChars >= prewrittenResponse.length) {
      setResponse(prewrittenResponse)
    }
  }, [hasPrewritten, prewrittenResponse, displayedChars])

  const displayText = hasPrewritten
    ? prewrittenResponse?.substring(0, displayedChars) || ''
    : response

  const isTypingComplete = !hasPrewritten || displayedChars >= (prewrittenResponse?.length || 0)

  return (
    <div className="space-y-4">
      {/* Previous response (if Phase 2 or 3) */}
      {previousResponse && (
        <blockquote
          className="text-sm text-gray-600 italic border-l-2 pl-3 mb-4"
          style={{ borderColor: PHASE_COLORS[((phase - 1) as 1 | 2 | 3)] || '#ccc' }}
        >
          &ldquo;{previousResponse}&rdquo;
        </blockquote>
      )}

      {/* Phase label */}
      <div
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: PHASE_COLORS[phase] }}
      >
        Phase {phase}: {PHASE_LABELS[phase]}
      </div>

      {/* Question/Prompt */}
      <div className="text-gray-800 leading-relaxed">{prompt}</div>

      {/* Response area */}
      <div>
        {hasPrewritten ? (
          <div className="min-h-[120px] p-4 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700 whitespace-pre-wrap">
            {displayText}
            {!isTypingComplete && <span className="animate-pulse">|</span>}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={response}
            onChange={e => setResponse(e.target.value)}
            placeholder="Share your thoughts..."
            className="w-full min-h-[120px] p-4 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y"
          />
        )}
      </div>

      {/* Continue button */}
      <div className="flex justify-end">
        <button
          onClick={() => onSubmit(response || prewrittenResponse || '')}
          disabled={!isTypingComplete && isDemoMode}
          className="px-5 py-2 bg-green-700 text-white rounded-full text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
