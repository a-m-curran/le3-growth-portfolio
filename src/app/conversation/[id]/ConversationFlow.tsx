'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { findDemoConversation } from '@/lib/conversation-engine'
import { getStudentWork } from '@/data'
import { ConversationPhase } from '@/components/conversation/ConversationPhase'
import { Synthesis } from '@/components/conversation/Synthesis'
import type { GrowthConversation, ConversationSkillTag } from '@/lib/types'

interface Props {
  workId: string
  studentId: string
}

type FlowPhase = 'phase1' | 'phase2' | 'phase3' | 'synthesis'

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export function ConversationFlow({ workId, studentId }: Props) {
  const router = useRouter()
  const [currentPhase, setCurrentPhase] = useState<FlowPhase>('phase1')
  const [conversation, setConversation] = useState<GrowthConversation | null>(null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState<string | null>(null)

  // Live mode state
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [prompts, setPrompts] = useState<{ phase1?: string; phase2?: string; phase3?: string }>({})
  const [responses, setResponses] = useState<{ phase1?: string; phase2?: string; phase3?: string }>({})
  const [synthesisData, setSynthesisData] = useState<{
    text: string
    skillTags: ConversationSkillTag[]
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const work = getStudentWork(workId)

  // Demo mode: load pre-written conversation
  useEffect(() => {
    if (!isDemoMode) return
    const conv = findDemoConversation(studentId, workId)
    setConversation(conv)
  }, [studentId, workId])

  // Live mode: start conversation via API
  useEffect(() => {
    if (isDemoMode) return

    async function startConversation() {
      try {
        const res = await fetch('/api/conversation/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workId }),
        })

        const data = await res.json()

        if (!res.ok) {
          // If there's an existing in-progress conversation, resume it
          if (res.status === 409 && data.conversationId) {
            setConversationId(data.conversationId)
            // TODO: could fetch existing conversation state to resume
          }
          setError(data.error || 'Failed to start conversation')
          setLoading(false)
          return
        }

        setConversationId(data.conversationId)
        setPrompts(prev => ({ ...prev, phase1: data.firstPrompt }))
        setLoading(false)
      } catch {
        setError('Failed to connect. Please check your internet connection.')
        setLoading(false)
      }
    }

    startConversation()
  }, [workId])

  // Live mode: submit a phase response
  const handleLiveSubmit = async (phase: 1 | 2 | 3, response: string) => {
    if (!conversationId) return

    setSubmitting(true)
    setError(null)

    // Save the response locally
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

  if (!work) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Work item not found.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-pulse text-green-700 text-lg mb-2">Preparing your conversation...</div>
        <p className="text-sm text-gray-500">This may take a few seconds.</p>
      </div>
    )
  }

  if (error && !conversationId && !conversation) {
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

  // Demo mode: show pre-written conversation
  if (isDemoMode) {
    if (!conversation) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p>No conversation available for this work item in demo mode.</p>
        </div>
      )
    }

    return (
      <div>
        <WorkHeader work={work} />
        {error && <ErrorBanner message={error} />}

        {currentPhase === 'phase1' && conversation.promptPhase1 && (
          <ConversationPhase
            phase={1}
            prompt={conversation.promptPhase1}
            prewrittenResponse={conversation.responsePhase1}
            onSubmit={() => setCurrentPhase('phase2')}
          />
        )}

        {currentPhase === 'phase2' && conversation.promptPhase2 && (
          <ConversationPhase
            phase={2}
            prompt={conversation.promptPhase2}
            prewrittenResponse={conversation.responsePhase2}
            previousResponse={conversation.responsePhase1}
            onSubmit={() => setCurrentPhase('phase3')}
          />
        )}

        {currentPhase === 'phase3' && conversation.promptPhase3 && (
          <ConversationPhase
            phase={3}
            prompt={conversation.promptPhase3}
            prewrittenResponse={conversation.responsePhase3}
            previousResponse={conversation.responsePhase2}
            onSubmit={() => setCurrentPhase('synthesis')}
          />
        )}

        {currentPhase === 'synthesis' && conversation.synthesisText && (
          <Synthesis
            synthesisText={conversation.synthesisText}
            skillTags={conversation.skillTags}
            onDone={() => router.push(`/garden?student=${studentId}`)}
          />
        )}

        <PhaseProgress currentPhase={currentPhase} />
      </div>
    )
  }

  // Live mode: use API-driven conversation
  return (
    <div>
      <WorkHeader work={work} />
      {error && <ErrorBanner message={error} />}

      {currentPhase === 'phase1' && prompts.phase1 && (
        <ConversationPhase
          phase={1}
          prompt={prompts.phase1}
          isDemoMode={false}
          onSubmit={(response) => handleLiveSubmit(1, response)}
        />
      )}

      {currentPhase === 'phase2' && prompts.phase2 && (
        <ConversationPhase
          phase={2}
          prompt={prompts.phase2}
          previousResponse={responses.phase1}
          isDemoMode={false}
          onSubmit={(response) => handleLiveSubmit(2, response)}
        />
      )}

      {currentPhase === 'phase3' && prompts.phase3 && (
        <ConversationPhase
          phase={3}
          prompt={prompts.phase3}
          previousResponse={responses.phase2}
          isDemoMode={false}
          onSubmit={(response) => handleLiveSubmit(3, response)}
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
          <div className="animate-pulse text-green-700 text-sm">
            Thinking...
          </div>
        </div>
      )}

      <PhaseProgress currentPhase={currentPhase} />
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────

function WorkHeader({ work }: { work: { title: string; courseName?: string; quarter: string; weekNumber?: number } }) {
  return (
    <div className="mb-6 p-4 rounded-xl bg-white border border-gray-200">
      <div className="flex items-start gap-3">
        <span className="text-xl">📄</span>
        <div>
          <h2 className="font-semibold text-gray-900">{work.title}</h2>
          <p className="text-sm text-gray-500">
            {work.courseName && `${work.courseName} · `}
            {work.quarter}
            {work.weekNumber && ` · Week ${work.weekNumber}`}
          </p>
        </div>
      </div>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
      {message}
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
