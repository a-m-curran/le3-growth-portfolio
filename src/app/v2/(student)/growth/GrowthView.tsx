'use client'

import { useState } from 'react'
import type { GardenData, GardenPlant } from '@/lib/types'
import { SDT_LEVELS } from '@/lib/constants'
import { SkillVisual } from '@/components/v2/growth/SkillVisual'
import { paletteForPillar } from '@/components/v2/growth/shared'
import { SkillPanel } from '@/components/panels/SkillPanel'

interface Props {
  data: GardenData
}

/**
 * Client view for the v2 Growth page.
 *
 * Groups skills by pillar (same pattern as the v1 garden), but each
 * skill renders through `SkillVisual` instead of the v1 `<Plant>`.
 * Visual mode toggle (garden/mountain/cityscape) is gone — each skill
 * has its own metaphor now, so there's nothing to reskin.
 *
 * Click on any skill card opens the existing SkillPanel slide-out
 * (unchanged from v1 — gives definitions, conversations, levels).
 */
export function GrowthView({ data }: Props) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const selected = selectedSkillId
    ? data.plants.find(p => p.skillId === selectedSkillId) ?? null
    : null

  const pillarGroups = groupByPillar(data.plants)

  return (
    <>
      {/* Stat header */}
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

      <div className="space-y-6">
        {pillarGroups.map(group => {
          const palette = paletteForPillar(group.pillarName)
          return (
            <section
              key={group.pillarId}
              className="rounded-2xl border p-5"
              style={{ backgroundColor: palette.bg, borderColor: `${palette.mid}55` }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: palette.dark }}>
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

      {/* Skill detail panel */}
      {selected && (
        <SkillPanel plant={selected} onClose={() => setSelectedSkillId(null)} />
      )}
    </>
  )
}

function SkillCard({ plant, onClick }: { plant: GardenPlant; onClick: () => void }) {
  const level = plant.sdtLevel as 1 | 2 | 3 | 4 | 5
  const config = SDT_LEVELS[level]
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center p-3 rounded-xl bg-white/70 hover:bg-white border border-transparent hover:border-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
      aria-label={`${plant.skillName}: ${config.name} level, ${plant.conversationCount} conversation${plant.conversationCount === 1 ? '' : 's'}`}
    >
      <div className="w-28 h-28 sm:w-32 sm:h-32 transition-transform group-hover:scale-105">
        <SkillVisual plant={plant} />
      </div>
      <div className="mt-1 text-center min-h-[2.5rem] flex flex-col justify-center">
        <div className="text-xs font-semibold text-gray-900 leading-tight">
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
