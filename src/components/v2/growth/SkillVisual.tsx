'use client'

import { useEffect, useRef, useState } from 'react'
import type { GardenPlant } from '@/lib/types'
import { signalFromPlant, paletteForPillar } from './shared'
import { CriticalThinkingVisual } from './archetypes/CriticalThinking'
import { ResilienceVisual } from './archetypes/Resilience'
import { SaplingVisual } from './archetypes/Sapling'
import { CreativeProblemSolvingVisual } from './archetypes/CreativeProblemSolving'
import { CuriosityVisual } from './archetypes/Curiosity'
import { InitiativeVisual } from './archetypes/Initiative'
import { EmpathyVisual } from './archetypes/Empathy'
import { CommunicationVisual } from './archetypes/Communication'
import { AdaptabilityVisual } from './archetypes/Adaptability'
import { CollaborationVisual } from './archetypes/Collaboration'
import { NetworkingVisual } from './archetypes/Networking'
import { RelationshipBuildingVisual } from './archetypes/RelationshipBuilding'
import { SocialAwarenessVisual } from './archetypes/SocialAwareness'

/**
 * SkillVisual — dispatcher that picks the right archetype per skill.
 *
 * Each skill has its own bespoke artwork (a crystal for Critical
 * Thinking, a campfire for Initiative, a castle for Resilience, …).
 * Skills without dedicated artwork fall back to `SaplingVisual`.
 *
 * Animation model:
 *
 * **Idle (no hover)**: artwork is static. Renders at the student's
 * current growth/density values; no SVG `<animate>` tags play. The
 * `animate` prop passed to each archetype is `false`, so flickers,
 * sways, pulses are all frozen.
 *
 * **Hover (or focus)**: a linear ramp drives growth 0 → 1 over
 * HOVER_PERIOD seconds, then snaps back to 0 and replays. This reads
 * as a clear "watch it grow from seedling" trailer, NOT a breathing
 * oscillation. `animate={true}` is passed down so the archetype's
 * own idle motions (flicker, sway, sweep) also play during the
 * trailer.
 *
 * When hover ends, both the growth value and idle motion snap back
 * to static.
 */

interface SkillVisualProps {
  plant: GardenPlant
  /** Whether the parent is currently hovering / focusing this skill. */
  hovering?: boolean
}

type Renderer = (typeof CriticalThinkingVisual)

const ARCHETYPE_BY_SKILL_ID: Record<string, Renderer> = {
  // Creative & Curious Thinkers
  skill_creative_problem_solving: CreativeProblemSolvingVisual,
  skill_critical_thinking: CriticalThinkingVisual,
  skill_curiosity: CuriosityVisual,
  // Leaders with Purpose & Agency
  skill_initiative: InitiativeVisual,
  skill_empathy: EmpathyVisual,
  skill_communication: CommunicationVisual,
  // Thrivers in Change
  skill_adaptability: AdaptabilityVisual,
  skill_resilience: ResilienceVisual,
  // Network Builders
  skill_collaboration: CollaborationVisual,
  skill_networking: NetworkingVisual,
  skill_relationship_building: RelationshipBuildingVisual,
  skill_social_awareness: SocialAwarenessVisual,
}

/** Seconds for the hover trailer to ramp 0 → 1. Then snaps and replays. */
const HOVER_PERIOD = 3.5

export function SkillVisual({ plant, hovering = false }: SkillVisualProps) {
  const base = signalFromPlant(plant)
  const palette = paletteForPillar(plant.pillarName)
  const Renderer = ARCHETYPE_BY_SKILL_ID[plant.skillId] ?? SaplingVisual

  const [signal, setSignal] = useState<{ growth: number; density: number }>(base)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!hovering) {
      setSignal(base)
      return
    }
    const startTs = performance.now()
    const tick = (now: number) => {
      const elapsed = (now - startTs) / 1000
      // Linear ramp 0 → 1, then modulo back to 0 and replay. The
      // discontinuity at 1 → 0 is deliberate: feels like the trailer
      // restarting, not a smooth breath.
      const t = (elapsed % HOVER_PERIOD) / HOVER_PERIOD
      // Gentle ease-in so growth doesn't feel mechanical at the start
      const eased = t * t * (3 - 2 * t) // smoothstep
      // Density tracks slightly ahead of growth so leaves/sparks/etc
      // hit their peaks just before the main form does — gives a
      // subtle anticipation feel.
      const d = Math.min(1, eased * 1.15)
      setSignal({ growth: eased, density: d })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    // Intentional: don't re-run on base changes, the early-return
    // branch handles that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovering])

  return (
    <Renderer
      growth={signal.growth}
      density={signal.density}
      palette={palette}
      seed={plant.skillId}
      animate={hovering}
    />
  )
}
