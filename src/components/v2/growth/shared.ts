/**
 * Shared types + helpers for the v2 Growth visualizations.
 *
 * Each skill renders its own bespoke "growth artwork." Every archetype
 * implements the same `ArchetypeProps` contract so the dispatcher
 * (`SkillVisual`) can hand the same data to each one and let the
 * archetype interpret it however its metaphor calls for.
 *
 * Naming convention: the file in archetypes/ is named after the skill
 * (CriticalThinking.tsx, Resilience.tsx, …) so the mapping from skill
 * id → renderer stays grep-friendly.
 */

import type { GardenPlant } from '@/lib/types'
import { getPillarPalette } from '@/lib/constants'

export interface ArchetypeProps {
  /**
   * Continuous growth value in [0, 1].
   *
   * Derived from sdtLevel: (level - 1) / 4 so level 1 → 0, level 5 → 1.
   * Archetypes scale their primary "maturity" axis off this (stem
   * height for plant-like forms, beam width for the lighthouse, etc.).
   */
  growth: number

  /**
   * Conversation richness in [0, 1].
   *
   * `min(1, conversationCount / 6)`. Drives secondary fill — leaves on
   * a tree, nodes lit up on the network, beam intensity on the
   * lighthouse. Allows a low-confidence skill with many reflections to
   * still feel "lived in" without overstating the SDT level.
   */
  density: number

  /**
   * Pillar palette inherited from the skill's pillar. Lets the
   * archetype tint without each component re-hardcoding 4 color
   * schemes. The dispatcher resolves this from the plant's pillarName.
   */
  palette: {
    /** Light bg behind the artwork */
    bg: string
    /** Mid tone for main strokes / fills */
    mid: string
    /** Darker accent for emphasis */
    dark: string
    /** Bright accent for highlights / blooms */
    accent: string
  }

  /**
   * Deterministic per-skill seed (typically the skill id). Archetypes
   * can use it to vary tilt, hue offset, decoration count etc so two
   * cohorts of the same skill don't look pixel-identical.
   */
  seed: string

  /**
   * Whether to play idle animation. Default true; the v2 page sets
   * this. Tests / static export disable it to avoid jitter.
   */
  animate?: boolean
}

/** Compute the signal envelope from a GardenPlant. */
export function signalFromPlant(plant: GardenPlant) {
  const growth = Math.max(0, Math.min(1, (plant.sdtLevel - 1) / 4))
  const density = Math.min(1, plant.conversationCount / 6)
  return { growth, density }
}

/**
 * Tiny seeded RNG (Mulberry32) so archetypes can derive per-skill
 * variation deterministically. Always returns floats in [0, 1).
 */
export function seededRandom(seed: string): () => number {
  // Hash the string to a 32-bit integer
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Clamp 0..1. */
export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t))
}

/**
 * Filter ids each archetype can reference (after including
 * `<ArtworkFilters seed={seed} />` inside its `<defs>`):
 *
 *   `drop-${seed}`    — soft drop shadow, gives shapes physicality
 *   `inset-${seed}`   — subtle inner shadow, for "cupped" forms
 *   `glow-${seed}`    — soft outer glow, for light sources / blooms
 *   `ground-${seed}`  — radial gradient for the ground-contact shadow
 *
 * The filter ids are scoped by `seed` so two archetypes rendered on
 * the same page can't collide (SVG filter ids are document-global).
 */
export function artworkFilterIds(seed: string) {
  return {
    drop: `drop-${seed}`,
    inset: `inset-${seed}`,
    glow: `glow-${seed}`,
    ground: `ground-${seed}`,
  }
}

/**
 * Pillar palette for archetype rendering. Reads from the canonical
 * `getPillarPalette` source in `@/lib/constants` so the saturated
 * mid/dark/accent tones used inside the SVG artworks stay coherent
 * with the surface tints used elsewhere (section bg, tinted card
 * borders, surface text color).
 *
 * The shape returned matches `ArchetypeProps['palette']`:
 *   bg     — surface tone for the section / card
 *   mid    — primary stroke/fill in artwork
 *   dark   — accent/shadow in artwork
 *   accent — highlight/bloom in artwork
 */
export function paletteForPillar(pillarName: string | null | undefined): ArchetypeProps['palette'] {
  const p = getPillarPalette(pillarName)
  return {
    bg: p.surface,
    mid: p.artworkMid,
    dark: p.artworkDark,
    accent: p.artworkAccent,
  }
}
