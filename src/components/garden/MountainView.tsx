'use client'

import type { GardenData } from '@/lib/types'
import { PILLAR_COLORS } from '@/lib/constants'
import { pillars } from '@/data'
import { MountainPeak } from './MountainPeak'
import { MountainLegend } from './MountainLegend'

interface Props {
  data: GardenData
  onPlantClick?: (skillId: string) => void
}

export function MountainView({ data, onPlantClick }: Props) {
  const activePillars = pillars.filter(p =>
    data.plants.some(plant => plant.pillarId === p.id)
  )

  return (
    <div className="space-y-6">
      {activePillars.map(pillar => {
        const pillarColors = PILLAR_COLORS[pillar.id as keyof typeof PILLAR_COLORS]
        const pillarPlants = data.plants.filter(p => p.pillarId === pillar.id)

        return (
          <div
            key={pillar.id}
            className="rounded-2xl border p-5"
            style={{
              backgroundColor: pillarColors?.bg || '#f8fafc',
              borderColor: pillarColors?.border || '#e2e8f0',
            }}
          >
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: pillarColors?.text || '#334155' }}
            >
              {pillar.name}
            </h3>
            <div className="flex flex-wrap gap-4 justify-start">
              {pillarPlants.map(plant => (
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
