'use client'

import type { GardenData } from '@/lib/types'
import { PILLAR_COLORS } from '@/lib/constants'
import { pillars } from '@/data'
import { Plant } from './Plant'
import { GardenLegend } from './GardenLegend'
import Link from 'next/link'

interface GardenProps {
  data: GardenData
  onPlantClick?: (skillId: string) => void
}

export function Garden({ data, onPlantClick }: GardenProps) {
  const activePillars = pillars.filter(p =>
    data.plants.some(plant => plant.pillarId === p.id)
  )

  return (
    <div className="space-y-6">
      {/* Pillar groups */}
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
