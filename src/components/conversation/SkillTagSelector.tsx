'use client'

import type { ConversationSkillTag } from '@/lib/types'
import { getSkill } from '@/data'

interface SkillTagSelectorProps {
  tags: ConversationSkillTag[]
}

export function SkillTagSelector({ tags }: SkillTagSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map(tag => {
        const skill = getSkill(tag.skillId)
        return (
          <button
            key={tag.skillId}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              tag.studentConfirmed
                ? 'bg-green-100 text-green-800 border-green-300'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-green-50 hover:border-green-300'
            }`}
          >
            {tag.studentConfirmed ? '✓ ' : ''}
            {skill?.name || tag.skillId}
          </button>
        )
      })}
    </div>
  )
}
