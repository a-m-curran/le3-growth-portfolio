'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PhasePanel } from './PhasePanel'
import { Synthesis } from '@/components/conversation/Synthesis'
import { ReflectionSynthesis } from '@/components/conversation/ReflectionSynthesis'
import type { ConversationSkillTag } from '@/lib/types'

/**
 * ConversationFlowView — the v2 interactive 3-phase conversation
 * flow. Renders the live, type-it-yourself experience for an
 * in-progress conversation: phase 1 prompt → response → phase 2
 * prompt → response → phase 3 prompt → response → synthesis.
 *
 * Reuses the v1 conversation API endpoints unchanged:
 *   POST /api/conversation/[id]/next-phase   (submit + get next)
 *   PUT  /api/conversation/[id]/tags         (confirm skill tags)
 *
 * The state machine and API contract are deliberately identical to
 * v1's ConversationFlow component — only the UI layer is rebuilt
 * in v2 design language. That keeps the migration low-risk: the
 * battle-tested backend stays exactly as-is.
 *
 * For the synthesis step we reuse v1's `Synthesis` (work-based) and
 * `ReflectionSynthesis` (open reflection) components for now. They
 * can be re-skinned in a follow-up pass without affecting flow.
 *
 * On completion, routes back to /v2/today (for work-based) or
 * /v2/journal (for open reflection) — the v2 surfaces, not v1.
 */

type FlowPhase = 'phase1' | 'phase2' | 'phase3' | 'synthesis'

interface InitialConversation {
  id: string
  conversationType: 'work_based' | 'open_reflection' | null
  status: 'in_progress' | 'completed'
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

interface Props {
  conversation: InitialConversation
}

export function ConversationFlowView({ conversation }: Props) {
  const router = useRouter()
  const isReflection = conversation.conversationType === 'open_reflection'

  // Derive starting phase from which fields are populated.
  const [currentPhase, setCurrentPhase] = useState<FlowPhase>(() =>
    derivePhase(conversation)
  )
  const [prompts, setPrompts] = useState({
    phase1: conversation.promptPhase1 ?? undefined,
    phase2: conversation.promptPhase2 ?? undefined,
    phase3: conversation.promptPhase3 ?? undefined,
  })
  const [responses, setResponses] = useState({
    phase1: conversation.responsePhase1 ?? undefined,
    phase2: conversation.responsePhase2 ?? undefined,
    phase3: conversation.responsePhase3 ?? undefined,
  })
  const [synthesisData, setSynthesisData] = useState<{
    text: string
    skillTags: ConversationSkillTag[]
  } | null>(
    conversation.synthesisText
      ? {
          text: conversation.synthesisText,
          skillTags: conversation.skillTags.map(t => ({
            skillId: t.skillId,
            confidence: t.confidence,
            studentConfirmed: t.studentConfirmed,
            rationale: t.rationale ?? undefined,
          })),
        }
      : null
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If we landed on phase 1 but somehow have no prompt, surface a
  // recoverable error rather than a silent blank screen.
  useEffect(() => {
    if (currentPhase === 'phase1' && !prompts.phase1) {
      setError('No starting prompt — this conversation may not have been created cleanly.')
    }
  }, [currentPhase, prompts.phase1])

  const handleSubmit = async (phase: 1 | 2 | 3, response: string) => {
    setSubmitting(true)
    setError(null)

    // Optimistic local update — show the response immediately even
    // while the LLM is generating the next phase.
    if (phase === 1) setResponses(prev => ({ ...prev, phase1: response }))
    if (phase === 2) setResponses(prev => ({ ...prev, phase2: response }))
    if (phase === 3) setResponses(prev => ({ ...prev, phase3: response }))

    try {
      const res = await fetch(`/api/conversation/${conversation.id}/next-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentResponse: response, currentPhase: phase }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Couldn’t get the next question. Try again?')
        setSubmitting(false)
        return
      }

      if (data.nextPhase === 'synthesis') {
        setSynthesisData({
          text: data.synthesis,
          skillTags: data.skillTags || [],
        })
        setCurrentPhase('synthesis')
      } else {
        const next = data.nextPhase as 1 | 2 | 3
        const key = `phase${next}` as 'phase1' | 'phase2' | 'phase3'
        setPrompts(prev => ({ ...prev, [key]: data.nextPrompt }))
        setCurrentPhase(`phase${next}` as FlowPhase)
      }
    } catch {
      setError('Network hiccup. Your response is still there — try the button again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTagsChange = (tags: ConversationSkillTag[]) => {
    fetch(`/api/conversation/${conversation.id}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    }).catch(err => {
      console.error('Failed to save tag changes:', err)
    })
  }

  const handleDone = () => {
    router.push(isReflection ? '/v2/journal' : '/v2/today')
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {currentPhase === 'phase1' && prompts.phase1 && (
        <PhasePanel
          phase={1}
          prompt={prompts.phase1}
          submitting={submitting}
          onSubmit={r => handleSubmit(1, r)}
        />
      )}

      {currentPhase === 'phase2' && prompts.phase2 && (
        <PhasePanel
          phase={2}
          prompt={prompts.phase2}
          previousResponse={responses.phase1}
          submitting={submitting}
          onSubmit={r => handleSubmit(2, r)}
        />
      )}

      {currentPhase === 'phase3' && prompts.phase3 && (
        <PhasePanel
          phase={3}
          prompt={prompts.phase3}
          previousResponse={responses.phase2}
          submitting={submitting}
          onSubmit={r => handleSubmit(3, r)}
        />
      )}

      {currentPhase === 'synthesis' && synthesisData && (
        isReflection ? (
          <ReflectionSynthesis
            synthesisText={synthesisData.text}
            skillTags={synthesisData.skillTags}
            onDone={handleDone}
          />
        ) : (
          <Synthesis
            synthesisText={synthesisData.text}
            skillTags={synthesisData.skillTags}
            onDone={handleDone}
            onTagsChange={handleTagsChange}
          />
        )
      )}

      <PhaseProgress currentPhase={currentPhase} />
    </div>
  )
}

function PhaseProgress({ currentPhase }: { currentPhase: FlowPhase }) {
  const phases: FlowPhase[] = ['phase1', 'phase2', 'phase3', 'synthesis']
  const currentIdx = phases.indexOf(currentPhase)
  return (
    <div className="pt-2 flex justify-center gap-2">
      {phases.map((p, i) => (
        <div
          key={p}
          className={`h-1.5 rounded-full transition-all ${
            i === currentIdx
              ? 'w-8 bg-green-600'
              : i < currentIdx
              ? 'w-4 bg-green-300'
              : 'w-4 bg-gray-200'
          }`}
        />
      ))}
    </div>
  )
}

/**
 * Derive which phase a conversation is "currently on" from the
 * pattern of populated prompt/response fields. Matches v1's
 * derivePhase logic from /api/student/reflect.
 */
function derivePhase(c: InitialConversation): FlowPhase {
  if (c.synthesisText) return 'synthesis'
  if (c.responsePhase2 && c.promptPhase3) return 'phase3'
  if (c.responsePhase1 && c.promptPhase2) return 'phase2'
  return 'phase1'
}
