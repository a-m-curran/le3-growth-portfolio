'use client'

import { useState } from 'react'
import type { GardenData } from '@/lib/types'
import { Garden } from '@/components/garden/Garden'
import { SkillPanel } from '@/components/panels/SkillPanel'

interface Props {
  data: GardenData
}

export function GardenClient({ data }: Props) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)

  const selectedPlant = selectedSkillId
    ? data.plants.find(p => p.skillId === selectedSkillId)
    : null

  return (
    <>
      <Garden data={data} onPlantClick={setSelectedSkillId} />
      {selectedPlant && (
        <SkillPanel
          plant={selectedPlant}
          onClose={() => setSelectedSkillId(null)}
        />
      )}
    </>
  )
}
