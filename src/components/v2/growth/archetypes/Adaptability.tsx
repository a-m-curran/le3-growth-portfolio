'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Adaptability — wind-shaped grass.
 *
 * Why: adaptability isn't rigidity. The grass that bends with the
 * wind survives the storm. We render a cluster of grass blades that
 * each bend at a slightly different angle, animating in a coordinated
 * sway like a real patch of windblown grass.
 *
 * Depth: drop shadow on each blade; ground gets a soft cast shadow;
 * front blades render after back blades for visible Z-order; blade
 * tips have a slightly brighter accent (sun-catching).
 *
 * Animation: blades sway in unison with slight phase offsets so the
 * "wind" feels coherent but each blade keeps its individual response.
 */
export function AdaptabilityVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const bladeCount = Math.round(lerp(4, 11, g)) + Math.floor(density * 2)
  const baseY = 140

  const blades = Array.from({ length: bladeCount }, (_, i) => {
    const x = 20 + (i / Math.max(bladeCount - 1, 1)) * 120 + (rand() - 0.5) * 8
    const height = lerp(35, 75, rand()) * lerp(0.6, 1, g)
    const bend = (rand() - 0.5) * 12 + 8  // bias toward right-leaning
    const phase = rand() * 2
    const z = rand() // for Z-order
    return { x, height, bend, phase, z, i }
  }).sort((a, b) => a.z - b.z)

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`ada-blade-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="60%" stopColor={palette.mid} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* Cast shadow under the cluster */}
      <ellipse cx="80" cy={baseY + 4} rx="55" ry="6" fill={`url(#${fid.ground})`} />

      {blades.map((b) => {
        const tipX = b.x + b.bend
        const tipY = baseY - b.height
        const ctrlX = b.x + b.bend * 0.4
        const ctrlY = baseY - b.height * 0.55
        return (
          <g key={b.i} filter={`url(#${fid.drop})`}>
            <g style={{ transformOrigin: `${b.x}px ${baseY}px` }}>
              {animate && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values={`-3 ${b.x} ${baseY};3 ${b.x} ${baseY};-3 ${b.x} ${baseY}`}
                  dur={`${3.5 + b.phase * 0.4}s`}
                  begin={`${b.phase}s`}
                  repeatCount="indefinite"
                />
              )}
              {/* Blade body — a curved triangle path */}
              <path
                d={`
                  M ${b.x - 1.6} ${baseY}
                  Q ${ctrlX - 1} ${ctrlY}, ${tipX} ${tipY}
                  Q ${ctrlX + 1} ${ctrlY}, ${b.x + 1.6} ${baseY}
                  Z
                `}
                fill={`url(#ada-blade-${seed})`}
              />
              {/* Light edge highlight along the bend */}
              <path
                d={`M ${b.x - 1.2} ${baseY} Q ${ctrlX - 0.5} ${ctrlY}, ${tipX} ${tipY}`}
                stroke="white"
                strokeOpacity="0.35"
                strokeWidth="0.7"
                fill="none"
              />
              {/* Tip accent — bright catch */}
              <circle cx={tipX} cy={tipY} r="1.2" fill={palette.accent} opacity="0.9" />
            </g>
          </g>
        )
      })}
    </svg>
  )
}
