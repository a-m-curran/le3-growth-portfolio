'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp } from '../shared'

/**
 * Sapling — the generic fallback archetype.
 *
 * Used for any skill that hasn't been given its own bespoke artwork
 * yet. Still procedural / continuous (not the v1 five-discrete-stages
 * approach) and seeded off skill id so two skills sharing this
 * fallback look distinct from each other. Each "sapling" gets:
 *   - a unique tilt angle
 *   - a hash-determined leaf count and arrangement
 *   - a small bloom that appears past the midpoint of growth
 *
 * Long-term goal: every skill graduates to its own archetype and this
 * fallback only renders for newly-added skills before they get
 * dedicated artwork.
 */
export function SaplingVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const g = clamp01(growth)

  // Tilt: -10 to +10 degrees, deterministic per skill
  const tilt = (rand() - 0.5) * 20
  // Stem height scales with growth
  const stemH = lerp(20, 75, g)
  // Leaf count grows with conversations
  const leafCount = Math.floor(lerp(2, 8, g)) + Math.floor(density * 3)
  // Bloom appears past 0.5 growth
  const hasBloom = g > 0.5

  const cx = 80
  const baseY = 138

  // Pre-compute leaf positions along the stem
  const leaves = Array.from({ length: leafCount }, (_, i) => {
    const t = (i + 1) / (leafCount + 1)
    const side = i % 2 === 0 ? -1 : 1
    const wobble = (rand() - 0.5) * 4
    const y = baseY - stemH * t
    const x = cx + side * (lerp(3, 10, t) + wobble)
    const size = lerp(3, 6, rand()) * lerp(0.7, 1.1, g)
    const rot = side * (20 + rand() * 25)
    return { x, y, size, rot, side }
  })

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      {/* Soft ground */}
      <ellipse cx={cx} cy={baseY + 4} rx="28" ry="4" fill={palette.dark} opacity="0.15" />

      <g transform={`rotate(${tilt} ${cx} ${baseY})`}>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`${tilt - 1} ${cx} ${baseY};${tilt + 1} ${cx} ${baseY};${tilt - 1} ${cx} ${baseY}`}
            dur="6s"
            repeatCount="indefinite"
          />
        )}
        {/* Stem */}
        <path
          d={`M ${cx} ${baseY} Q ${cx + (rand() - 0.5) * 4} ${baseY - stemH / 2} ${cx} ${baseY - stemH}`}
          stroke={palette.dark}
          strokeWidth={lerp(2, 3.5, g)}
          fill="none"
          strokeLinecap="round"
        />

        {/* Leaves */}
        {leaves.map((l, i) => (
          <ellipse
            key={i}
            cx={l.x}
            cy={l.y}
            rx={l.size}
            ry={l.size * 0.5}
            fill={i % 3 === 0 ? palette.accent : palette.mid}
            opacity={0.85}
            transform={`rotate(${l.rot} ${l.x} ${l.y})`}
          />
        ))}

        {/* Bloom at the top if grown enough */}
        {hasBloom && (
          <g>
            <circle cx={cx} cy={baseY - stemH - 2} r={lerp(3, 6, g)} fill={palette.accent} opacity="0.95" />
            <circle cx={cx} cy={baseY - stemH - 2} r={lerp(1.5, 2.5, g)} fill={palette.dark} opacity="0.7" />
          </g>
        )}
      </g>
    </svg>
  )
}
