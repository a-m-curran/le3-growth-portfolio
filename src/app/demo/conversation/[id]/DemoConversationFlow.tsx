'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { findDemoConversation } from '@/lib/conversation-engine'
import { getStudentWork } from '@/data'
import { ConversationPhase } from '@/components/conversation/ConversationPhase'
import { Synthesis } from '@/components/conversation/Synthesis'
import type { GrowthConversation } from '@/lib/types'

interface Props {
  workId: string
  studentId: string
}

type FlowPhase = 'phase1' | 'phase2' | 'phase3' | 'synthesis'

export function DemoConversationFlow({ workId, studentId }: Props) {
  const router = useRouter()
  const [currentPhase, setCurrentPhase] = useState<FlowPhase>('phase1')
  const [conversation, setConversation] = useState<GrowthConversation | null>(null)

  const work = getStudentWork(workId)

  useEffect(() => {
    const conv = findDemoConversation(studentId, workId)
    setConversation(conv)
  }, [studentId, workId])

  if (!work) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Work item not found.</p>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No conversation available for this work item in demo mode.</p>
      </div>
    )
  }

  return (
    <div>
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
          onDone={() => router.push(`/demo/garden?student=${studentId}`)}
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
