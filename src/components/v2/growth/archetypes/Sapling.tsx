'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Sapling — the generic fallback archetype.
 *
 * Used for any skill that hasn't been given its own bespoke artwork
 * yet. Still procedural / continuous (not the v1 five-discrete-stages
 * approach) and seeded off skill id so two skills sharing this
 * fallback look distinct from each other.
 *
 * Depth treatment: drop shadow on the swaying body, radial-gradient
 * cast shadow on the ground, form-modeled bloom at the top.
 *
 * Long-term goal: every skill graduates to its own archetype and this
 * fallback only renders for newly-added skills.
 */
export function SaplingVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const tilt = (rand() - 0.5) * 20
  const stemH = lerp(20, 75, g)
  const leafCount = Math.floor(lerp(2, 8, g)) + Math.floor(density * 3)
  const hasBloom = g > 0.5

  const cx = 80
  const baseY = 138

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
      <defs>
        <ArtworkFilters seed={seed} />
        <radialGradient id={`sap-bloom-${seed}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.7" />
          <stop offset="40%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.8" />
        </radialGradient>
      </defs>

      {/* Cast shadow */}
      <ellipse cx={cx} cy={baseY + 4} rx="26" ry="5" fill={`url(#${fid.ground})`} />

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
        <g filter={`url(#${fid.drop})`}>
          <path
            d={`M ${cx} ${baseY} Q ${cx + (rand() - 0.5) * 4} ${baseY - stemH / 2} ${cx} ${baseY - stemH}`}
            stroke={palette.dark}
            strokeWidth={lerp(2, 3.5, g)}
            fill="none"
            strokeLinecap="round"
          />
          {leaves.map((l, i) => (
            <g key={i}>
              <ellipse
                cx={l.x}
                cy={l.y}
                rx={l.size}
                ry={l.size * 0.5}
                fill={i % 3 === 0 ? palette.accent : palette.mid}
                opacity={0.92}
                transform={`rotate(${l.rot} ${l.x} ${l.y})`}
              />
              {/* Subtle highlight on each leaf */}
              <ellipse
                cx={l.x - l.size * 0.2}
                cy={l.y - l.size * 0.2}
                rx={l.size * 0.4}
                ry={l.size * 0.2}
                fill="white"
                opacity="0.35"
                transform={`rotate(${l.rot} ${l.x} ${l.y})`}
              />
            </g>
          ))}
        </g>

        {hasBloom && (
          <g filter={`url(#${fid.drop})`}>
            <circle
              cx={cx}
              cy={baseY - stemH - 2}
              r={lerp(3, 6, g)}
              fill={`url(#sap-bloom-${seed})`}
            />
            <circle
              cx={cx}
              cy={baseY - stemH - 2}
              r={lerp(1.5, 2.5, g)}
              fill={palette.dark}
              opacity="0.7"
            />
          </g>
        )}
      </g>
    </svg>
  )
}
