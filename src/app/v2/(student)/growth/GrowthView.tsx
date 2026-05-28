'use client'

import type { GardenData } from '@/lib/types'
import { GrowthGrid } from '@/components/v2/growth/GrowthGrid'

interface Props {
  data: GardenData
}

/**
 * Student Growth view — pillar-grouped skill visualizations.
 *
 * Thin wrapper around the shared `<GrowthGrid>` component, which is
 * also used by the coach's Portfolio tab so both surfaces render
 * the same beautiful layout from the same code.
 */
export function GrowthView({ data }: Props) {
  return <GrowthGrid data={data} editable />
}
