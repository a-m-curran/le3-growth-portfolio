'use client'

import type { ConversationSkillTag } from '@/lib/types'
import { SkillTagSelector } from './SkillTagSelector'

interface SynthesisProps {
  synthesisText: string
  skillTags: ConversationSkillTag[]
  currentDefinition?: string | null
  onDone: () => void
  onTagsChange?: (tags: ConversationSkillTag[]) => void
  editable?: boolean
}

export function Synthesis({ synthesisText, skillTags, currentDefinition, onDone, onTagsChange, editable = true }: SynthesisProps) {
  return (
    <div className="space-y-6">
      {/* Synthesis */}
      <div>
        <p className="text-sm text-gray-500 mb-2">Here&apos;s what I&apos;m hearing:</p>
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-900 leading-relaxed">{synthesisText}</p>
        </div>
      </div>

      {/* Skill Tags */}
      <div>
        <p className="text-sm text-gray-500 mb-2">This conversation touched on:</p>
        <SkillTagSelector
          tags={skillTags}
          editable={editable}
          onTagsChange={onTagsChange}
        />
        {editable && (
          <p className="text-xs text-gray-400 mt-2">
            Confirm, remove, or add skill tags. Your input helps track your growth accurately.
          </p>
        )}
      </div>

      {/* Definition evolution prompt (if applicable) */}
      {currentDefinition && (
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
          <p className="text-xs text-purple-600 font-medium mb-1">Your current definition:</p>
          <p className="text-sm text-purple-900 italic mb-3">
            &ldquo;{currentDefinition}&rdquo;
          </p>
          <p className="text-sm text-purple-800 mb-3">
            Your reflections sound different now. Would you like to update your definition?
          </p>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors">
              Update Definition
            </button>
            <button className="px-3 py-1.5 bg-white text-purple-600 rounded-lg text-xs font-medium border border-purple-300 hover:bg-purple-50 transition-colors">
              Not Yet
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      <div className="text-center pt-2">
        <button
          onClick={onDone}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-full text-sm font-medium hover:bg-green-800 transition-colors"
        >
          Done — See Your Portfolio
        </button>
      </div>
    </div>
  )
}
