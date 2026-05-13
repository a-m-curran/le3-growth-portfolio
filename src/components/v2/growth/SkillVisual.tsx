'use client'

import type { GardenPlant } from '@/lib/types'
import { signalFromPlant, paletteForPillar } from './shared'
import { CriticalThinkingVisual } from './archetypes/CriticalThinking'
import { ResilienceVisual } from './archetypes/Resilience'
import { SaplingVisual } from './archetypes/Sapling'

/**
 * SkillVisual — dispatcher that picks the right archetype per skill.
 *
 * Each skill has its own bespoke artwork (a lattice for Critical
 * Thinking, a bent-trunk for Resilience, …). Skills without dedicated
 * artwork fall back to `SaplingVisual` which is still procedural and
 * deterministically varied by skill id.
 *
 * The mapping lives in `ARCHETYPE_BY_SKILL_ID` below. To add a new
 * archetype: drop a new component under `./archetypes/`, import it
 * here, register it in the map.
 *
 * The component is intentionally pure visual — no interaction wiring,
 * no labels. The parent supplies the surrounding card (label, click
 * handler to open SkillPanel, hover treatment).
 */

interface SkillVisualProps {
  plant: GardenPlant
  animate?: boolean
}

type Renderer = (typeof CriticalThinkingVisual)

const ARCHETYPE_BY_SKILL_ID: Record<string, Renderer> = {
  skill_critical_thinking: CriticalThinkingVisual,
  skill_resilience: ResilienceVisual,
  // The remaining 10 skills will get bespoke archetypes; for now they
  // fall through to SaplingVisual which still seeds off skill id so
  // each looks distinct.
}

export function SkillVisual({ plant, animate = true }: SkillVisualProps) {
  const { growth, density } = signalFromPlant(plant)
  const palette = paletteForPillar(plant.pillarName)
  const Renderer = ARCHETYPE_BY_SKILL_ID[plant.skillId] ?? SaplingVisual

  return (
    <Renderer
      growth={growth}
      density={density}
      palette={palette}
      seed={plant.skillId}
      animate={animate}
    />
  )
}
