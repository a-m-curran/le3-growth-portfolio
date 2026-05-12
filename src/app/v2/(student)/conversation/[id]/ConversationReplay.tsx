'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConversationPhase } from '@/components/conversation/ConversationPhase'
import { Synthesis } from '@/components/conversation/Synthesis'
import type { ConversationSkillTag } from '@/lib/types'

/**
 * Client-side conversation replay. Mirrors the v1 DemoConversationFlow:
 * walks through Phase 1 → 2 → 3 → Synthesis, with ConversationPhase's
 * typewriter effect playing each pre-written response so the demo
 * viewer can SEE what reflecting on this work looks like, not just
 * read a static dump.
 *
 * Data comes from /api/conversations/[id] which is already demo-aware
 * — it returns the static seed in demo mode and the real conversation
 * in DB mode. Either way, this page renders the same flow shape.
 */

interface ConversationDetail {
  id: string
  workTitle: string | null
  courseName: string | null
  promptPhase1: string | null
  responsePhase1: string | null
  promptPhase2: string | null
  responsePhase2: string | null
  promptPhase3: string | null
  responsePhase3: string | null
  synthesisText: string | null
  skillTags: Array<{
    skillId: string
    skillName: string | null
    confidence: number
    studentConfirmed: boolean
    rationale: string | null
  }>
}

type FlowPhase = 'phase1' | 'phase2' | 'phase3' | 'synthesis'

interface Props {
  conversationId: string
}

export function ConversationReplay({ conversationId }: Props) {
  const router = useRouter()
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPhase, setCurrentPhase] = useState<FlowPhase>('phase1')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/conversations/${conversationId}`, { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as ConversationDetail
      })
      .then(j => { if (!cancelled) setConversation(j) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [conversationId])

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-sm text-red-800">
          Couldn&rsquo;t load conversation: {error}
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-4">
        <div className="h-8 w-3/4 rounded bg-gray-200 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
      </div>
    )
  }

  // Convert API skill tags to ConversationSkillTag shape Synthesis expects
  const skillTagsForSynthesis: ConversationSkillTag[] = conversation.skillTags.map(t => ({
    skillId: t.skillId,
    confidence: t.confidence,
    studentConfirmed: t.studentConfirmed,
    rationale: t.rationale ?? undefined,
  }))

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Work header */}
      <div className="mb-6 p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden="true">📄</span>
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 truncate">
              {conversation.workTitle || 'Reflection'}
            </h1>
            {conversation.courseName && (
              <p className="text-sm text-gray-500 mt-0.5">{conversation.courseName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Phase 1 */}
      {currentPhase === 'phase1' && conversation.promptPhase1 && (
        <ConversationPhase
          phase={1}
          prompt={conversation.promptPhase1}
          prewrittenResponse={conversation.responsePhase1 ?? undefined}
          onSubmit={() => setCurrentPhase('phase2')}
        />
      )}

      {/* Phase 2 */}
      {currentPhase === 'phase2' && conversation.promptPhase2 && (
        <ConversationPhase
          phase={2}
          prompt={conversation.promptPhase2}
          prewrittenResponse={conversation.responsePhase2 ?? undefined}
          previousResponse={conversation.responsePhase1 ?? undefined}
          onSubmit={() => setCurrentPhase('phase3')}
        />
      )}

      {/* Phase 3 */}
      {currentPhase === 'phase3' && conversation.promptPhase3 && (
        <ConversationPhase
          phase={3}
          prompt={conversation.promptPhase3}
          prewrittenResponse={conversation.responsePhase3 ?? undefined}
          previousResponse={conversation.responsePhase2 ?? undefined}
          onSubmit={() => setCurrentPhase('synthesis')}
        />
      )}

      {/* Synthesis */}
      {currentPhase === 'synthesis' && conversation.synthesisText && (
        <Synthesis
          synthesisText={conversation.synthesisText}
          skillTags={skillTagsForSynthesis}
          onDone={() => router.push('/v2/reflect')}
          editable={false}
        />
      )}

      <PhaseProgress currentPhase={currentPhase} />
    </div>
  )
}

function PhaseProgress({ currentPhase }: { currentPhase: FlowPhase }) {
  const phases: FlowPhase[] = ['phase1', 'phase2', 'phase3', 'synthesis']
  const currentIdx = phases.indexOf(currentPhase)

  return (
    <div className="mt-8 flex justify-center gap-2">
      {phases.map((phase, i) => (
        <div
          key={phase}
          className={`w-2 h-2 rounded-full transition-colors ${
            i === currentIdx
              ? 'bg-green-600'
              : i < currentIdx
              ? 'bg-green-300'
              : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  )
}
