'use client'

import type { ConversationSkillTag } from '@/lib/types'
import { SkillTagSelector } from './SkillTagSelector'

/**
 * NOTE: This component previously included a "definition evolution"
 * prompt block — two buttons ("Update Definition" / "Not Yet") that
 * rendered when a `currentDefinition` prop was passed but had no
 * onClick handlers and no backing API. The prop was never actually
 * passed by either ConversationFlow caller, so the orphan buttons
 * never appeared in practice. Removed in the clickability audit so
 * the dead code can't accidentally ship visible later. If/when the
 * team wants to ship the definition-update flow, it should be built
 * with real handlers + a backing /api/student-skill-definition endpoint.
 */

interface SynthesisProps {
  synthesisText: string
  skillTags: ConversationSkillTag[]
  onDone: () => void
  onTagsChange?: (tags: ConversationSkillTag[]) => void
  editable?: boolean
}

export function Synthesis({ synthesisText, skillTags, onDone, onTagsChange, editable = true }: SynthesisProps) {
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
