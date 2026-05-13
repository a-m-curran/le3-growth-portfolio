/**
 * Helpers for resolving the "primary pillar" of a conversation or
 * work item — i.e. which of the four LE3 pillars its dominant skill
 * belongs to. Used to tint cards in the v2 IA (Today's recent
 * journal, Reflect's past, Journal's history, Coach Prep's recent
 * conversations) so each row visually carries its skill-area
 * identity.
 *
 * Two flavors:
 *   - `primaryPillarFromTags()`  — client-side from skill-tag array
 *     already attached to the conversation
 *   - `primaryPillarFromSkillId()` — for cases where we only have a
 *     single skill id (e.g. work tagged with one anchor skill)
 *
 * Demo mode uses the static seed; DB mode needs the API route to
 * have already joined skill→pillar and pass the pillar name string.
 * For demo paths the helpers do the lookup directly off the static
 * `skills` + `pillars` exports.
 */

import { skills, pillars } from '@/data'
import type { ConversationSkillTag } from '@/lib/types'

/**
 * Resolve the pillar NAME (canonical, e.g. "Creative & Curious
 * Thinkers") of the highest-confidence skill tag on a conversation.
 * Returns null if there are no tags or the skill/pillar can't be
 * found in the static seed.
 *
 * Confidence ties: prefer student-confirmed tags, then alphabetical
 * by skillId so the result is stable across renders.
 */
export function primaryPillarFromTags(
  tags: ConversationSkillTag[] | null | undefined
): string | null {
  if (!tags || tags.length === 0) return null
  const sorted = [...tags].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    if (a.studentConfirmed !== b.studentConfirmed) {
      return a.studentConfirmed ? -1 : 1
    }
    return a.skillId.localeCompare(b.skillId)
  })
  return primaryPillarFromSkillId(sorted[0].skillId)
}

/**
 * Resolve the pillar NAME of a single skill id via the static seed.
 * Returns null when the skill or its pillar can't be found (e.g. a
 * DB-only skill that isn't in the demo data).
 */
export function primaryPillarFromSkillId(skillId: string | null | undefined): string | null {
  if (!skillId) return null
  const skill = skills.find(s => s.id === skillId)
  if (!skill) return null
  const pillar = pillars.find(p => p.id === skill.pillarId)
  return pillar?.name ?? null
}
