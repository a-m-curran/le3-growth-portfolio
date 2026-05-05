'use client'

import { useEffect, useState } from 'react'
import type { ConversationSkillTag } from '@/lib/types'

/**
 * Synthesis view shown at the end of a standalone reflection
 * (not work-tied). Renders one card per skill the LLM tagged.
 *
 * Previously imported a static `skills` seed and looked up each tag's
 * skill by id; in DB mode the lookup always missed (UUID vs slug
 * mismatch) and `if (!skill) return null` made the entire skill
 * insight block disappear silently. Now fetches /api/skills which
 * returns live durable_skill rows.
 */

interface AvailableSkill {
  id: string
  name: string
  pillarName: string
}

interface Props {
  synthesisText: string
  skillTags: ConversationSkillTag[]
  onDone: () => void
}

export function ReflectionSynthesis({ synthesisText, skillTags, onDone }: Props) {
  const [skillNameById, setSkillNameById] = useState<Map<string, string>>(new Map())
  const [skillsLoaded, setSkillsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/skills', { cache: 'force-cache' })
      .then(r => r.json())
      .then((j: { skills?: AvailableSkill[] }) => {
        if (cancelled) return
        setSkillNameById(new Map((j.skills ?? []).map(s => [s.id, s.name])))
        setSkillsLoaded(true)
      })
      .catch(err => {
        console.warn('Failed to load /api/skills:', err)
        setSkillsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Synthesis */}
      <div>
        <p className="text-sm text-gray-500 mb-2">Here&apos;s what I&apos;m hearing:</p>
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-900 leading-relaxed">{synthesisText}</p>
        </div>
      </div>

      {/* Skill insights — conversational, not clinical */}
      {skillTags.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-3">I noticed something in what you shared:</p>
          <div className="space-y-3">
            {skillTags.map(tag => {
              // Resolve name from live data; while still loading, show a
              // gentle placeholder rather than the raw UUID. After load,
              // if a tag references an unknown skill, fall back to the
              // raw id so the block still appears (debuggable, not silent).
              const skillName =
                skillNameById.get(tag.skillId) ??
                (skillsLoaded ? tag.skillId : null)

              if (!skillName) {
                // Skills still loading — render a skeleton card.
                return (
                  <div
                    key={tag.skillId}
                    className="p-4 rounded-xl bg-gray-50 border border-gray-200 animate-pulse"
                  >
                    <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-3/4 bg-gray-200 rounded" />
                  </div>
                )
              }

              return (
                <div
                  key={tag.skillId}
                  className="p-4 rounded-xl bg-green-50 border border-green-200"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs px-2 py-0.5 bg-green-700 text-white rounded-full font-medium">
                      {skillName}
                    </span>
                  </div>
                  {tag.rationale && (
                    <p className="text-sm text-green-900 leading-relaxed">
                      {tag.rationale}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            These connections are tracked in your portfolio over time.
          </p>
        </div>
      )}

      {/* Done */}
      <div className="text-center pt-2">
        <button
          onClick={onDone}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-full text-sm font-medium hover:bg-green-800 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}
