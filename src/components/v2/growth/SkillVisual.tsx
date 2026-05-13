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
 * **Hover (or focus)**: growth ramps from 0 → 1 over HOVER_RAMP_S
 * seconds and then DWELLS at 1 for as long as the cursor stays on
 * the card. This reads as a "watch it grow, then linger at peak"
 * trailer — once the ramp finishes, the celebration layer (sparkles,
 * halo pulse) carries the energy while the artwork's primary motion
 * keeps running. No looping back to 0.
 *
 * When hover ends, both the growth value and the archetype's idle
 * motion snap back to the student's actual current state.
 */

interface SkillVisualProps {
  plant: GardenPlant
  /** Whether the parent is currently hovering / focusing this skill. */
  hovering?: boolean
}

type Renderer = (typeof CriticalThinkingVisual)

/**
 * Dispatcher keyed on the skill's canonical NAME. The static seed
 * used to use slug ids ('skill_critical_thinking') but those don't
 * exist in the DB — skill rows have UUID primary keys, so a plant's
 * `skillId` is a UUID at runtime. Looking up by name is stable
 * across both worlds (the names are identical in seed and DB).
 */
const ARCHETYPE_BY_SKILL_NAME: Record<string, Renderer> = {
  // Creative & Curious Thinkers
  'Creative Problem Solving': CreativeProblemSolvingVisual,
  'Critical Thinking': CriticalThinkingVisual,
  'Curiosity': CuriosityVisual,
  // Leaders with Purpose & Agency
  'Initiative': InitiativeVisual,
  'Empathy': EmpathyVisual,
  'Communication': CommunicationVisual,
  // Thrivers in Change
  'Adaptability': AdaptabilityVisual,
  'Resilience': ResilienceVisual,
  // Network Builders
  'Collaboration': CollaborationVisual,
  'Networking': NetworkingVisual,
  'Relationship Building': RelationshipBuildingVisual,
  'Social Awareness': SocialAwarenessVisual,
}

/** Seconds for the hover trailer to ramp 0 → 1. After this, growth
 * stays clamped at 1 until the cursor leaves the card. */
const HOVER_RAMP_S = 2.8

export function SkillVisual({ plant, hovering = false }: SkillVisualProps) {
  const base = signalFromPlant(plant)
  const palette = paletteForPillar(plant.pillarName)
  const Renderer = ARCHETYPE_BY_SKILL_NAME[plant.skillName] ?? SaplingVisual

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
      // Ramp 0 → 1 over HOVER_RAMP_S, then clamp at 1 and stop the
      // rAF loop. After the ramp the artwork sits at its peak; the
      // celebration layer (sparkles + halo pulse) handles ambient
      // motion from there.
      const t = Math.min(1, elapsed / HOVER_RAMP_S)
      // Gentle ease so growth doesn't feel mechanical at the start
      const eased = t * t * (3 - 2 * t) // smoothstep
      // Density tracks slightly ahead of growth so leaves/sparks/etc
      // hit their peaks just before the main form does — gives a
      // subtle anticipation feel during the ramp.
      const d = Math.min(1, eased * 1.15)
      setSignal({ growth: eased, density: d })
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
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
