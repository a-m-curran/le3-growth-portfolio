'use client'

import { useState, useEffect } from 'react'
import type { GardenData } from '@/lib/types'
import { Garden } from '@/components/garden/Garden'
import { MountainView } from '@/components/garden/MountainView'
import { CityscapeView } from '@/components/garden/CityscapeView'
import { VisualizationToggle, type VisualizationType } from '@/components/garden/VisualizationToggle'
import { SkillPanel } from '@/components/panels/SkillPanel'

interface Props {
  data: GardenData
}

export function GardenClient({ data }: Props) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [vizType, setVizType] = useState<VisualizationType>('garden')

  // Persist preference to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('le3-viz-type') as VisualizationType | null
    if (saved && ['garden', 'mountain', 'cityscape'].includes(saved)) {
      setVizType(saved)
    }
  }, [])

  const handleVizChange = (type: VisualizationType) => {
    setVizType(type)
    localStorage.setItem('le3-viz-type', type)
  }

  const selectedPlant = selectedSkillId
    ? data.plants.find(p => p.skillId === selectedSkillId)
    : null

  const vizProps = { data, onPlantClick: setSelectedSkillId }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-green-700">
          {data.plants.length} skills &middot; {data.totalConversations} conversations &middot; {data.quartersActive} quarter{data.quartersActive !== 1 ? 's' : ''}
        </div>
        <VisualizationToggle value={vizType} onChange={handleVizChange} />
      </div>

      {vizType === 'garden' && <Garden {...vizProps} />}
      {vizType === 'mountain' && <MountainView {...vizProps} />}
      {vizType === 'cityscape' && <CityscapeView {...vizProps} />}

      {selectedPlant && (
        <SkillPanel
          plant={selectedPlant}
          onClose={() => setSelectedSkillId(null)}
        />
      )}
    </>
  )
}
