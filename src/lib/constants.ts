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
 * Visual styling per pillar.
 *
 * Keyed by both static slug (legacy demo data uses
 * "pillar_creative" etc.) AND by canonical pillar NAME so DB-sourced
 * pillarIds (which are UUIDs) can resolve via name. Use
 * `getPillarColors(pillarNameOrSlug)` rather than indexing this
 * object directly to get the dual-keyed lookup behavior.
 */
const PILLAR_COLORS_BY_KEY = {
  // Demo / static-seed slug keys
  pillar_creative: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', name: 'Creative & Curious Thinkers' },
  pillar_lead: { bg: '#faf5ff', border: '#c4b5fd', text: '#5b21b6', name: 'Leaders with Purpose & Agency' },
  pillar_thrive: { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', name: 'Thrivers in Change' },
  pillar_network: { bg: '#f0fdf4', border: '#86efac', text: '#166534', name: 'Network Builders' },
  // Canonical name keys — what DB-sourced data resolves to
  'Creative & Curious Thinkers': { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', name: 'Creative & Curious Thinkers' },
  'Leaders with Purpose & Agency': { bg: '#faf5ff', border: '#c4b5fd', text: '#5b21b6', name: 'Leaders with Purpose & Agency' },
  'Thrivers in Change': { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', name: 'Thrivers in Change' },
  'Network Builders': { bg: '#f0fdf4', border: '#86efac', text: '#166534', name: 'Network Builders' },
} as const

export type PillarColorKey = keyof typeof PILLAR_COLORS_BY_KEY

/**
 * Look up pillar colors by either static slug or canonical name.
 * Returns a safe gray fallback when the key matches neither (rather
 * than `undefined`, which callers tend to forget to guard against).
 */
export function getPillarColors(key: string | null | undefined) {
  if (key && key in PILLAR_COLORS_BY_KEY) {
    return PILLAR_COLORS_BY_KEY[key as PillarColorKey]
  }
  return { bg: '#f8fafc', border: '#e2e8f0', text: '#334155', name: key || 'Pillar' }
}

/** @deprecated use getPillarColors() — direct indexing breaks for DB UUIDs */
export const PILLAR_COLORS = PILLAR_COLORS_BY_KEY

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
