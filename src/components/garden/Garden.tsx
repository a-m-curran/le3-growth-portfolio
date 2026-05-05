'use client'

import type { GardenData, GardenPlant } from '@/lib/types'
import { getPillarColors } from '@/lib/constants'
import { Plant } from './Plant'
import { GardenLegend } from './GardenLegend'
import Link from 'next/link'

interface GardenProps {
  data: GardenData
  onPlantClick?: (skillId: string) => void
}

/**
 * Renders the student's garden grouped by pillar.
 *
 * Previously imported a static `pillars` seed and tried to filter it
 * by `plant.pillarId === p.id`. That worked in demo mode (string
 * pillarIds match string seed IDs) but failed in DB mode where
 * pillarId is a UUID — every comparison missed and the page rendered
 * empty. Fixed by deriving pillar groups directly from the plant data
 * (which already carries pillarId + pillarName) and looking up colors
 * by the canonical pillar name (works for both demo and DB-sourced data).
 */
export function Garden({ data, onPlantClick }: GardenProps) {
  const pillarGroups = groupPlantsByPillar(data.plants)

  return (
    <div className="space-y-6">
      {/* Pillar groups */}
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
                <Plant
                  key={plant.skillId}
                  plant={plant}
                  onClick={() => onPlantClick?.(plant.skillId)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Legend */}
      <GardenLegend />

      {/* CTA */}
      <div className="text-center pt-2">
        <Link
          href={`/conversation?student=${data.student.id}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-full text-sm font-medium hover:bg-green-800 transition-colors"
        >
          Start a Growth Conversation
        </Link>
      </div>
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
