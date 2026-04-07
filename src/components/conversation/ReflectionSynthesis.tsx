'use client'

import type { ConversationSkillTag } from '@/lib/types'
import { skills } from '@/data'

interface Props {
  synthesisText: string
  skillTags: ConversationSkillTag[]
  onDone: () => void
}

export function ReflectionSynthesis({ synthesisText, skillTags, onDone }: Props) {
  const activeSkills = skills.filter(s => s.isActive)

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
              const skill = activeSkills.find(s => s.id === tag.skillId)
              if (!skill) return null

              return (
                <div
                  key={tag.skillId}
                  className="p-4 rounded-xl bg-green-50 border border-green-200"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs px-2 py-0.5 bg-green-700 text-white rounded-full font-medium">
                      {skill.name}
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
