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
 * Each skill has its own bespoke artwork (a lattice for Critical
 * Thinking, a bent-trunk for Resilience, …). Skills without dedicated
 * artwork fall back to `SaplingVisual` which is still procedural and
 * deterministically varied by skill id.
 *
 * The mapping lives in `ARCHETYPE_BY_SKILL_ID` below. To add a new
 * archetype: drop a new component under `./archetypes/`, import it
 * here, register it in the map.
 *
 * Hover/focus animation: when `hovering` is true (parent tracks it),
 * the dispatcher drives a sinusoidal loop of growth & density values
 * so the artwork visibly cycles from "seedling" to "fully mature" and
 * back. Each archetype is parameterized off these two numbers, so the
 * loop renders a tiny "trailer" of what growth in this skill looks
 * like — without each archetype having to wire its own animation.
 * When `hovering` flips back off, growth/density snap to the
 * student's actual current values.
 */

interface SkillVisualProps {
  plant: GardenPlant
  /** Idle micro-animations baked into the archetype (sway, shimmer). */
  animate?: boolean
  /**
   * Whether the parent is currently hovering / focusing this skill.
   * Drives the cycle animation through the growth spectrum.
   */
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
  // Legacy / not currently rendered — falls through to SaplingVisual:
  //   skill_self_directed_learning
}

/** Period (seconds) of one full 0 → 1 → 0 cycle on hover. */
const HOVER_PERIOD = 4.5

export function SkillVisual({ plant, animate = true, hovering = false }: SkillVisualProps) {
  const base = signalFromPlant(plant)
  const palette = paletteForPillar(plant.pillarName)
  const Renderer = ARCHETYPE_BY_SKILL_ID[plant.skillId] ?? SaplingVisual

  const [signal, setSignal] = useState<{ growth: number; density: number }>(base)
  const rafRef = useRef<number | null>(null)

  // Drive the hover cycle. Uses requestAnimationFrame so the rate
  // matches the display refresh; cancels on unhover or unmount.
  useEffect(() => {
    if (!hovering) {
      setSignal(base)
      return
    }
    const startTs = performance.now()
    const tick = (now: number) => {
      const elapsed = (now - startTs) / 1000
      // Smooth sinusoidal 0 → 1 → 0 loop. Cosine-based so the curve
      // is gentle at the endpoints (the artwork dwells briefly at
      // seed-state and full-grown rather than blowing past them).
      const phase = (2 * Math.PI * elapsed) / HOVER_PERIOD
      const g = (1 - Math.cos(phase)) / 2
      // Offset density by a quarter-cycle so leaves don't pulse
      // perfectly in lockstep with the main growth — feels more
      // like a living system, less like a slider.
      const dPhase = phase + Math.PI / 2
      const d = (1 - Math.cos(dPhase)) / 2
      setSignal({ growth: g, density: d })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    // We intentionally don't depend on base.* — when hover toggles
    // off the early-return branch resets to base, and when it
    // toggles on we restart the loop from t=0 regardless of base.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovering])

  return (
    <Renderer
      growth={signal.growth}
      density={signal.density}
      palette={palette}
      seed={plant.skillId}
      animate={animate}
    />
  )
}
