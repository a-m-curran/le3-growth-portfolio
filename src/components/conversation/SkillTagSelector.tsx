'use client'

import { useState } from 'react'
import type { ConversationSkillTag } from '@/lib/types'
import { skills } from '@/data'

interface SkillTagSelectorProps {
  tags: ConversationSkillTag[]
  editable?: boolean
  onTagsChange?: (tags: ConversationSkillTag[]) => void
}

export function SkillTagSelector({ tags: initialTags, editable = true, onTagsChange }: SkillTagSelectorProps) {
  const [tags, setTags] = useState(initialTags)
  const [showAddMenu, setShowAddMenu] = useState(false)

  const activeSkills = skills.filter(s => s.isActive)
  const taggedSkillIds = new Set(tags.map(t => t.skillId))
  const availableSkills = activeSkills.filter(s => !taggedSkillIds.has(s.id))

  const updateTags = (newTags: ConversationSkillTag[]) => {
    setTags(newTags)
    onTagsChange?.(newTags)
  }

  const toggleConfirm = (skillId: string) => {
    if (!editable) return
    const updated = tags.map(t =>
      t.skillId === skillId ? { ...t, studentConfirmed: !t.studentConfirmed } : t
    )
    updateTags(updated)
  }

  const removeTag = (skillId: string) => {
    if (!editable) return
    updateTags(tags.filter(t => t.skillId !== skillId))
  }

  const addTag = (skillId: string) => {
    const skill = activeSkills.find(s => s.id === skillId)
    if (!skill) return
    const newTag: ConversationSkillTag = {
      skillId,
      confidence: 1.0,
      studentConfirmed: true,
      rationale: 'Added by student',
    }
    updateTags([...tags, newTag])
    setShowAddMenu(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => {
          const skill = activeSkills.find(s => s.id === tag.skillId)
          const isConfirmed = tag.studentConfirmed
          return (
            <div key={tag.skillId} className="flex items-center gap-0.5">
              <button
                onClick={() => toggleConfirm(tag.skillId)}
                className={`text-sm px-3 py-1.5 rounded-l-full border transition-colors ${
                  isConfirmed
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-green-50 hover:border-green-300'
                } ${editable ? 'cursor-pointer' : 'cursor-default'}`}
                title={editable ? (isConfirmed ? 'Click to unconfirm' : 'Click to confirm this tag') : undefined}
              >
                {isConfirmed ? '✓ ' : ''}
                {skill?.name || tag.skillId}
              </button>
              {editable && (
                <button
                  onClick={() => removeTag(tag.skillId)}
                  className={`text-sm px-2 py-1.5 rounded-r-full border border-l-0 transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-300 ${
                    isConfirmed
                      ? 'bg-green-100 text-green-600 border-green-300'
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                  }`}
                  title="Remove tag"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}

        {/* Add tag button */}
        {editable && (
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="text-sm px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-colors"
          >
            + Add skill
          </button>
        )}
      </div>

      {/* Add menu */}
      {showAddMenu && availableSkills.length > 0 && (
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-xs text-gray-500 mb-2">Which skill did this conversation touch on?</p>
          <div className="flex flex-wrap gap-1.5">
            {availableSkills.map(skill => (
              <button
                key={skill.id}
                onClick={() => addTag(skill.id)}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-700 hover:border-green-400 hover:bg-green-50 transition-colors"
              >
                {skill.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAddMenu && availableSkills.length === 0 && (
        <p className="text-xs text-gray-400">All skills are already tagged.</p>
      )}
    </div>
  )
}
