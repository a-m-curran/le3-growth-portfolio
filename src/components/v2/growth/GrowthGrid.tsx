'use client'

import { useState } from 'react'
import type { GardenData, GardenPlant } from '@/lib/types'
import { SDT_LEVELS, getPillarPalette } from '@/lib/constants'
import { SkillVisual } from './SkillVisual'
import { SkillPanel } from '@/components/panels/SkillPanel'

/**
 * GrowthGrid — the pillar-grouped skill visualization layout.
 *
 * Used by:
 *   - `/v2/growth` (student) — the student's own page
 *   - Coach `/v2/coach/[studentId]` Portfolio tab — read-only view
 *     of the same student's skills
 *
 * The two surfaces previously rendered different layouts for the
 * same underlying GardenData; this shared component makes the coach
 * portfolio visually coherent with the student growth view, with
 * identical pillar grouping, SDT level treatment, and skill artwork.
 *
 * Click any skill card → opens `SkillPanel` overlay (the existing
 * detail slide-out from v1). Both audiences get the same interaction.
 *
 * Props:
 *   showHeader — when true (the default), renders the count summary
 *                ("11 skills · 24 conversations · 3 quarters active")
 *                above the pillar groups. The coach view may opt out
 *                if it has its own header bar.
 */

interface Props {
  data: GardenData
  showHeader?: boolean
}

export function GrowthGrid({ data, showHeader = true }: Props) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const selected = selectedSkillId
    ? data.plants.find(p => p.skillId === selectedSkillId) ?? null
    : null

  const pillarGroups = groupByPillar(data.plants)

  return (
    <>
      {showHeader && (
        <div className="mb-6 flex items-center gap-4 text-sm text-gray-600">
          <span>
            <strong className="text-gray-900">{data.plants.length}</strong> skill{data.plants.length === 1 ? '' : 's'}
          </span>
          <span className="text-gray-300">·</span>
          <span>
            <strong className="text-gray-900">{data.totalConversations}</strong> conversation{data.totalConversations === 1 ? '' : 's'}
          </span>
          <span className="text-gray-300">·</span>
          <span>
            <strong className="text-gray-900">{data.quartersActive}</strong> quarter{data.quartersActive === 1 ? '' : 's'} active
          </span>
        </div>
      )}

      <div className="space-y-6">
        {pillarGroups.map(group => {
          const p = getPillarPalette(group.pillarName)
          return (
            <section
              key={group.pillarId}
              className="rounded-2xl border p-5"
              style={{ backgroundColor: p.surface, borderColor: `${p.surfaceBorder}88` }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: p.surfaceText }}>
                {group.pillarName}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.plants.map(plant => (
                  <SkillCard
                    key={plant.skillId}
                    plant={plant}
                    onClick={() => setSelectedSkillId(plant.skillId)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {selected && (
        <SkillPanel plant={selected} onClose={() => setSelectedSkillId(null)} />
      )}
    </>
  )
}

function SkillCard({ plant, onClick }: { plant: GardenPlant; onClick: () => void }) {
  const level = plant.sdtLevel as 1 | 2 | 3 | 4 | 5
  const config = SDT_LEVELS[level]
  const palette = getPillarPalette(plant.pillarName)
  const [hovering, setHovering] = useState(false)

  // Apple-HIG-style tint: the card's frame inherits a SUBTLE pillar
  // wash on hover/focus, so the skill's pillar identity is visible
  // not just inside the artwork but on the card itself. Idle state
  // stays neutral so the visual noise level is low when scanning.
  const cardStyle: React.CSSProperties = hovering
    ? {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: palette.surfaceBorder,
        boxShadow: `0 0 0 1px ${palette.surfaceBorder}44, 0 4px 12px ${palette.artworkDark}1a`,
      }
    : {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderColor: 'transparent',
      }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      className="group flex flex-col items-center p-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
      style={{ ...cardStyle, ...{ '--tw-ring-color': palette.surfaceBorder } as React.CSSProperties }}
      aria-label={`${plant.skillName}: ${config.name} level, ${plant.conversationCount} conversation${plant.conversationCount === 1 ? '' : 's'}`}
    >
      <div className="w-28 h-28 sm:w-32 sm:h-32 transition-transform group-hover:scale-105">
        <SkillVisual plant={plant} hovering={hovering} />
      </div>
      <div className="mt-1 text-center min-h-[2.5rem] flex flex-col justify-center">
        <div
          className="text-xs font-semibold leading-tight transition-colors"
          style={{ color: hovering ? palette.surfaceText : '#111827' }}
        >
          {plant.skillName}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: config.color }}>
          {config.name}
          {plant.conversationCount > 0 && (
            <span className="text-gray-400 ml-1">· {plant.conversationCount}</span>
          )}
        </div>
      </div>
    </button>
  )
}

interface PillarGroup {
  pillarId: string
  pillarName: string
  plants: GardenPlant[]
}

function groupByPillar(plants: GardenPlant[]): PillarGroup[] {
  const groups = new Map<string, PillarGroup>()
  for (const p of plants) {
    const existing = groups.get(p.pillarId)
    if (existing) {
      existing.plants.push(p)
    } else {
      groups.set(p.pillarId, { pillarId: p.pillarId, pillarName: p.pillarName, plants: [p] })
    }
  }
  return Array.from(groups.values())
}
