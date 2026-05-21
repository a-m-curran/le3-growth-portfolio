'use client'

import { useEffect, useState } from 'react'
import { WorkHeader } from './WorkHeader'

/**
 * Non-typewriter, all-at-once render of a completed conversation.
 *
 * Replaces ConversationReplay (which animated phases character-by-
 * character) for real students. The shape mirrors ConversationPanel
 * (the existing side-modal used for in-progress on Reflect): work
 * header + phase 1/2/3 prompt+response + synthesis + skill tags.
 *
 * Fetches /api/conversations/[id] — the existing endpoint that
 * returns the full conversation in one round-trip.
 */

interface ConversationDetail {
  id: string
  workTitle: string | null
  courseName: string | null
  workContent: string | null
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

interface ConversationFullViewProps {
  conversationId: string
}

export function ConversationFullView({ conversationId }: ConversationFullViewProps) {
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

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
      <WorkHeader
        workTitle={data.workTitle}
        courseName={data.courseName}
        workContent={data.workContent}
        conversationId={data.id}
      />

      <PhaseSection
        n={1}
        prompt={data.promptPhase1}
        response={data.responsePhase1}
      />
      <PhaseSection
        n={2}
        prompt={data.promptPhase2}
        response={data.responsePhase2}
      />
      <PhaseSection
        n={3}
        prompt={data.promptPhase3}
        response={data.responsePhase3}
      />

      {data.synthesisText && (
        <section className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-emerald-800 mb-2">
            Synthesis
          </h2>
          <p className="text-sm text-emerald-950 whitespace-pre-wrap">{data.synthesisText}</p>
        </section>
      )}

      {data.skillTags.length > 0 && (
        <section className="rounded-2xl bg-white border border-gray-200 p-4">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">
            Skills
          </h2>
          <ul className="flex flex-wrap gap-2">
            {data.skillTags.map(t => (
              <li
                key={t.skillId}
                className="px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-800"
              >
                {t.skillName || t.skillId}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function PhaseSection({
  n,
  prompt,
  response,
}: {
  n: 1 | 2 | 3
  prompt: string | null
  response: string | null
}) {
  if (!prompt && !response) return null
  return (
    <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 space-y-2">
      <h2 className="text-xs uppercase tracking-wider font-semibold text-gray-500">
        Phase {n}
      </h2>
      {prompt && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Prompt</p>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{prompt}</p>
        </div>
      )}
      {response && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Your response</p>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{response}</p>
        </div>
      )}
    </section>
  )
}
