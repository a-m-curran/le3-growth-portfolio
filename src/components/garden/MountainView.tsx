'use client'

import type { GardenData, GardenPlant } from '@/lib/types'
import { getPillarColors } from '@/lib/constants'
import { MountainPeak } from './MountainPeak'
import { MountainLegend } from './MountainLegend'

interface Props {
  data: GardenData
  onPlantClick?: (skillId: string) => void
}

/**
 * Mountain view variant of the garden. Shares the same data shape +
 * pillar grouping logic as Garden.tsx — see that file for why we
 * derive groups from plant data rather than the static pillars seed.
 */
export function MountainView({ data, onPlantClick }: Props) {
  const pillarGroups = groupPlantsByPillar(data.plants)

  return (
    <div className="space-y-6">
      {pillarGroups.map(group => {
        const pillarColors = getPillarColors(group.pillarName)
        return (
          <div
            key={group.pillarId}
            className="rounded-2xl border p-5"
            style={{
              backgroundColor: pillarColors.bg,
              borderColor: pillarColors.border,
            }}
          >
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: pillarColors.text }}
            >
              {group.pillarName}
            </h3>
            <div className="flex flex-wrap gap-4 justify-start">
              {group.plants.map(plant => (
                <MountainPeak
                  key={plant.skillId}
                  plant={plant}
                  onClick={() => onPlantClick?.(plant.skillId)}
                />
              ))}
            </div>
          </div>
        )
      })}

      <MountainLegend />
    </div>
  )
}

interface PillarGroup {
  pillarId: string
  pillarName: string
  plants: GardenPlant[]
}

function groupPlantsByPillar(plants: GardenPlant[]): PillarGroup[] {
  const groups = new Map<string, PillarGroup>()
  for (const plant of plants) {
    const existing = groups.get(plant.pillarId)
    if (existing) {
      existing.plants.push(plant)
    } else {
      groups.set(plant.pillarId, {
        pillarId: plant.pillarId,
        pillarName: plant.pillarName,
        plants: [plant],
      })
    }
  }
  return Array.from(groups.values())
}
