'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ConversationPhase } from '@/components/conversation/ConversationPhase'
import { Synthesis } from '@/components/conversation/Synthesis'
import type { ConversationSkillTag } from '@/lib/types'

interface Props {
  workId: string
  studentId?: string
}

type FlowPhase = 'phase1' | 'phase2' | 'phase3' | 'synthesis'

export function ConversationFlow({ workId }: Props) {
  const router = useRouter()
  const [currentPhase, setCurrentPhase] = useState<FlowPhase>('phase1')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [prompts, setPrompts] = useState<{ phase1?: string; phase2?: string; phase3?: string }>({})
  const [responses, setResponses] = useState<{ phase1?: string; phase2?: string; phase3?: string }>({})
  const [synthesisData, setSynthesisData] = useState<{
    text: string
    skillTags: ConversationSkillTag[]
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [workContext, setWorkContext] = useState<string>('')

  // Start conversation via API
  useEffect(() => {
    async function startConversation() {
      try {
        const res = await fetch('/api/conversation/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workId }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Failed to start conversation')
          setLoading(false)
          return
        }

        setConversationId(data.conversationId)
        setWorkContext(data.workContext || '')

        if (data.resuming) {
          // Resume an existing in-progress conversation
          if (data.prompts) setPrompts(data.prompts)
          if (data.responses) setResponses(data.responses)
          setCurrentPhase(`phase${data.currentPhase}` as FlowPhase)
        } else {
          // Fresh conversation
          setPrompts(prev => ({ ...prev, phase1: data.firstPrompt }))
        }

        setLoading(false)
      } catch {
        setError('Failed to connect. Please check your internet connection.')
        setLoading(false)
      }
    }

    startConversation()
  }, [workId])

  const handleSubmit = async (phase: 1 | 2 | 3, response: string) => {
    if (!conversationId) return

    setSubmitting(true)
    setError(null)

    if (phase === 1) setResponses(prev => ({ ...prev, phase1: response }))
    if (phase === 2) setResponses(prev => ({ ...prev, phase2: response }))
    if (phase === 3) setResponses(prev => ({ ...prev, phase3: response }))

    try {
      const res = await fetch(`/api/conversation/${conversationId}/next-phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentResponse: response, currentPhase: phase }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to get next question')
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
        const phaseKey = `phase${data.nextPhase}` as 'phase1' | 'phase2' | 'phase3'
        setPrompts(prev => ({ ...prev, [phaseKey]: data.nextPrompt }))
        setCurrentPhase(`phase${data.nextPhase}` as FlowPhase)
      }

      setSubmitting(false)
    } catch {
      setError('Failed to connect. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-pulse text-green-700 text-lg mb-2">Preparing your conversation...</div>
        <p className="text-sm text-gray-500">This may take a few seconds.</p>
      </div>
    )
  }

  if (error && !conversationId) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-red-600 mb-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-green-700 hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div>
      {workContext && (
        <div className="mb-6 p-4 rounded-xl bg-white border border-gray-200">
          <div className="flex items-start gap-3">
            <span className="text-xl">📄</span>
            <p className="text-sm text-gray-700">{workContext}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {currentPhase === 'phase1' && prompts.phase1 && (
        <ConversationPhase
          phase={1}
          prompt={prompts.phase1}
          isDemoMode={false}
          onSubmit={(response) => handleSubmit(1, response)}
        />
      )}

      {currentPhase === 'phase2' && prompts.phase2 && (
        <ConversationPhase
          phase={2}
          prompt={prompts.phase2}
          previousResponse={responses.phase1}
          isDemoMode={false}
          onSubmit={(response) => handleSubmit(2, response)}
        />
      )}

      {currentPhase === 'phase3' && prompts.phase3 && (
        <ConversationPhase
          phase={3}
          prompt={prompts.phase3}
          previousResponse={responses.phase2}
          isDemoMode={false}
          onSubmit={(response) => handleSubmit(3, response)}
        />
      )}

      {currentPhase === 'synthesis' && synthesisData && (
        <Synthesis
          synthesisText={synthesisData.text}
          skillTags={synthesisData.skillTags}
          onDone={() => router.push('/garden')}
        />
      )}

      {submitting && (
        <div className="mt-4 text-center">
          <div className="animate-pulse text-green-700 text-sm">Thinking...</div>
        </div>
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
