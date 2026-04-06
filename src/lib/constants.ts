// src/lib/constants.ts

export const SDT_LEVELS = {
  1: { name: 'Noticing', emoji: '🌱', color: '#93c5fd', bg: '#eff6ff' },
  2: { name: 'Practicing', emoji: '🌱', color: '#4ade80', bg: '#f0fdf4' },
  3: { name: 'Integrating', emoji: '🌿', color: '#16a34a', bg: '#dcfce7' },
  4: { name: 'Evolving', emoji: '🌸', color: '#166534', bg: '#bbf7d0' },
} as const

export const SDT_LEVEL_MAP: Record<string, number> = {
  noticing: 1,
  practicing: 2,
  integrating: 3,
  evolving: 4,
}

export const PILLAR_COLORS = {
  pillar_creative: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', name: 'Creative & Curious Mindset' },
  pillar_lead: { bg: '#f0fdf4', border: '#86efac', text: '#166534', name: 'Lead Themselves & Others' },
  pillar_thrive: { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', name: 'Thrive in Change' },
} as const

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
