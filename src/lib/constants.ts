// src/lib/constants.ts

export const SDT_LEVELS = {
  1: { name: 'External', emoji: '🌰', color: '#94a3b8', bg: '#f1f5f9' },
  2: { name: 'Introjected', emoji: '🌱', color: '#93c5fd', bg: '#eff6ff' },
  3: { name: 'Identified', emoji: '🌿', color: '#4ade80', bg: '#f0fdf4' },
  4: { name: 'Integrated', emoji: '🌳', color: '#16a34a', bg: '#dcfce7' },
  5: { name: 'Intrinsic', emoji: '🌸', color: '#166534', bg: '#bbf7d0' },
} as const

export const SDT_LEVEL_MAP: Record<string, number> = {
  external: 1,
  introjected: 2,
  identified: 3,
  integrated: 4,
  intrinsic: 5,
}

/**
 * Canonical pillar palettes.
 *
 * Each pillar has ONE definition with all the tones we use anywhere
 * — surface/card tones (the pale tints that show up as section
 * backgrounds and tinted cards) AND artwork/accent tones (the
 * saturated mid/dark/accent colors that drive the growth-view SVG
 * artworks). Previously these were two separate palettes in
 * different files that drifted out of sync; now they share a source.
 *
 * Helpers downstream re-shape this into legacy `{bg, border, text}`
 * for back-compat with v1 callers, or into the `{bg, mid, dark,
 * accent}` shape the v2 growth artworks want.
 *
 * Lookup accepts either the static slug (`pillar_creative`) used by
 * the demo seed data OR the canonical pillar name (DB rows store the
 * name string in `pillarName` columns since pillarId in DB is a
 * UUID). Both resolve to the same palette.
 */
interface PillarPalette {
  /** Display name, used for section headers. */
  name: string
  /** Very pale surface tint for section backgrounds & tinted cards. */
  surface: string
  /** Slightly stronger border for surface containers. */
  surfaceBorder: string
  /** Saturated, readable color for text on the surface tint. */
  surfaceText: string
  /** Mid tone for primary strokes / fills in artworks. */
  artworkMid: string
  /** Dark tone for accents / shadows in artworks. */
  artworkDark: string
  /** Bright accent for highlights / blooms in artworks. */
  artworkAccent: string
}

const PILLAR_DEFINITIONS: Record<string, PillarPalette> = {
  'Creative & Curious Thinkers': {
    name: 'Creative & Curious Thinkers',
    surface: '#eff6ff',
    surfaceBorder: '#93c5fd',
    surfaceText: '#1e40af',
    artworkMid: '#60a5fa',
    artworkDark: '#1e40af',
    artworkAccent: '#a855f7',
  },
  'Leaders with Purpose & Agency': {
    name: 'Leaders with Purpose & Agency',
    surface: '#faf5ff',
    surfaceBorder: '#c4b5fd',
    surfaceText: '#5b21b6',
    artworkMid: '#a78bfa',
    artworkDark: '#5b21b6',
    artworkAccent: '#f472b6',
  },
  'Thrivers in Change': {
    name: 'Thrivers in Change',
    surface: '#fff7ed',
    surfaceBorder: '#fdba74',
    surfaceText: '#9a3412',
    artworkMid: '#fb923c',
    artworkDark: '#9a3412',
    artworkAccent: '#facc15',
  },
  'Network Builders': {
    name: 'Network Builders',
    surface: '#f0fdf4',
    surfaceBorder: '#86efac',
    surfaceText: '#166534',
    artworkMid: '#4ade80',
    artworkDark: '#166534',
    artworkAccent: '#22d3ee',
  },
}

// Slug → canonical name aliases (legacy demo seed uses these slugs)
const PILLAR_SLUG_ALIASES: Record<string, string> = {
  pillar_creative: 'Creative & Curious Thinkers',
  pillar_lead: 'Leaders with Purpose & Agency',
  pillar_thrive: 'Thrivers in Change',
  pillar_network: 'Network Builders',
}

const FALLBACK: PillarPalette = {
  name: 'Pillar',
  surface: '#f8fafc',
  surfaceBorder: '#e2e8f0',
  surfaceText: '#334155',
  artworkMid: '#94a3b8',
  artworkDark: '#334155',
  artworkAccent: '#fbbf24',
}

/**
 * Resolve a key (slug or canonical name) to the full pillar palette.
 * Falls back to a neutral gray palette if the key matches neither.
 */
export function getPillarPalette(key: string | null | undefined): PillarPalette {
  if (!key) return FALLBACK
  if (key in PILLAR_DEFINITIONS) return PILLAR_DEFINITIONS[key]
  const aliased = PILLAR_SLUG_ALIASES[key]
  if (aliased && aliased in PILLAR_DEFINITIONS) return PILLAR_DEFINITIONS[aliased]
  return { ...FALLBACK, name: key }
}

/**
 * Legacy `{bg, border, text, name}` shape. Reads from the canonical
 * `PILLAR_DEFINITIONS` under the hood — same source of truth as the
 * growth-view artwork palette.
 *
 * Use for v1-era card containers and section headers. New v2 code
 * should prefer `getPillarPalette()` directly so it can pull artwork
 * tones too.
 */
export function getPillarColors(key: string | null | undefined) {
  const p = getPillarPalette(key)
  return {
    bg: p.surface,
    border: p.surfaceBorder,
    text: p.surfaceText,
    name: p.name,
  }
}


export const GARDEN = {
  dark: '#166534',
  mid: '#16a34a',
  light: '#dcfce7',
  bg: '#f0fdf4',
  soil: '#7c5d3a',
} as const

export const CONVERSATION = {
  phase1: '#3b82f6', // Blue — What Happened
  phase2: '#8b5cf6', // Purple — What You Did
  phase3: '#16a34a', // Green — What It Means
  synthesis: '#f59e0b', // Amber — Synthesis
} as const

export const CURRENT_QUARTER = 'Spring 2026'
