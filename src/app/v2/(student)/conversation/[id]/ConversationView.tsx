'use client'

import { useEffect, useState } from 'react'
import { ConversationReplay } from './ConversationReplay'
import { ConversationFlowView } from './ConversationFlowView'
import { ConversationFullView } from '@/components/v2/student/ConversationFullView'

/**
 * ConversationView — top-level client dispatcher for the
 * /v2/conversation/[id] page.
 *
 * Status routing:
 *   - status === 'in_progress' → ConversationFlowView (live, interactive)
 *   - status === 'completed'   →
 *       - real student (isDemo=false): ConversationFullView (the
 *         non-typewriter "all at once" view — same component used
 *         when a row is clicked from the Reflect tree)
 *       - demo persona (isDemo=true): ConversationReplay (typewriter
 *         walkthrough — preserved for the demo flow only)
 *
 * isDemo is inferred from /api/conversations/[id]: the route already
 * resolves the student id; we extend the response by including
 * `isDemo` on the JSON (added in this task — see route patch below).
 * If the route doesn't yet expose isDemo (older deploy), default to
 * false (treat as real student).
 */

interface ConversationDetail {
  id: string
  workTitle: string | null
  courseName: string | null
  conversationType: 'work_based' | 'open_reflection' | null
  status: 'in_progress' | 'completed'
  isDemo?: boolean
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
  conversationId: string
}

export function ConversationView({ conversationId }: Props) {
  const [data, setData] = useState<ConversationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      .then(j => { if (!cancelled) setData(j) })
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

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-4">
        <div className="h-8 w-3/4 rounded bg-gray-200 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
      </div>
    )
  }

  // Completed path:
  //   - Real students get the new "View" (all at once, no typewriter).
  //   - Demo personas keep the existing typewriter Replay.
  if (data.status === 'completed') {
    const isDemo = data.isDemo === true
    if (isDemo) {
      return <ConversationReplay conversationId={conversationId} />
    }
    return <ConversationFullView conversationId={conversationId} />
  }

  // In-progress path unchanged.
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <WorkHeader workTitle={data.workTitle} courseName={data.courseName} />
      <ConversationFlowView conversation={data} />
    </div>
  )
}

function WorkHeader({
  workTitle,
  courseName,
}: {
  workTitle: string | null
  courseName: string | null
}) {
  return (
    <div className="mb-6 p-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">📄</span>
        <div className="min-w-0">
          <h1 className="font-semibold text-gray-900 truncate">
            {workTitle || 'Reflection'}
          </h1>
          {courseName && (
            <p className="text-sm text-gray-500 mt-0.5">{courseName}</p>
          )}
        </div>
      </div>
    </div>
  )
}
