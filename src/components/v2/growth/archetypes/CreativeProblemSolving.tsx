'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Creative Problem Solving — divergent-then-convergent branching.
 *
 * Why: creative problem solving fans out (generate many options),
 * then converges (find the one that works). We draw multiple paths
 * from a single starting node at the bottom, diverging outward as
 * they rise, then bending back toward a common apex at the top. The
 * apex glows brighter as ideas accumulate (density) and the paths
 * lengthen as confidence grows.
 *
 * Depth: paths get drop shadows so they read as ribbon-like;
 * convergence node and origin node have radial-gradient form
 * modeling; ground gets a soft cast shadow.
 */
export function CreativeProblemSolvingVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  // 3 to 6 paths
  const pathCount = Math.max(2, Math.round(lerp(3, 6, g)))
  const cx = 80
  const originY = lerp(140, 130, g)
  const apexY = lerp(80, 35, g)
  const fanWidth = lerp(20, 45, g)

  const paths = Array.from({ length: pathCount }, (_, i) => {
    const t = (i - (pathCount - 1) / 2) / Math.max((pathCount - 1) / 2, 1)
    const midX = cx + t * fanWidth
    const midY = (originY + apexY) / 2 + (rand() - 0.5) * 6
    // Path bows outward through the middle, then converges at apex
    return { midX, midY, side: t }
  })

  const apexGlow = lerp(2, 7, g) + density * 2

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <radialGradient id={`cps-apex-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
          <stop offset="30%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.6" />
        </radialGradient>
        <radialGradient id={`cps-origin-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.85" />
        </radialGradient>
      </defs>

      {/* Cast shadow */}
      <ellipse cx={cx} cy={originY + 6} rx="22" ry="5" fill={`url(#${fid.ground})`} />

      {/* Paths — each ribbon goes origin → bulge → apex */}
      <g filter={`url(#${fid.drop})`} fill="none" strokeLinecap="round">
        {paths.map((p, i) => (
          <g key={i}>
            <path
              d={`M ${cx} ${originY} Q ${p.midX} ${p.midY}, ${cx} ${apexY}`}
              stroke={i % 2 === 0 ? palette.mid : palette.accent}
              strokeWidth="2.6"
              opacity={lerp(0.7, 1, Math.abs(p.side))}
            >
              {/* Animated dash so each path feels like it's flowing
                  upward toward the apex */}
              {animate && (
                <animate
                  attributeName="stroke-dasharray"
                  values="0 80;80 0;0 80"
                  dur={`${3 + i * 0.4}s`}
                  repeatCount="indefinite"
                />
              )}
            </path>
          </g>
        ))}
      </g>

      {/* Origin node — bottom */}
      <g filter={`url(#${fid.drop})`}>
        <circle cx={cx} cy={originY} r="4.5" fill={`url(#cps-origin-${seed})`} />
      </g>

      {/* Apex — convergence point, glows */}
      <g filter={`url(#${fid.glow})`}>
        <circle
          cx={cx}
          cy={apexY}
          r={apexGlow}
          fill={`url(#cps-apex-${seed})`}
        >
          {animate && (
            <animate
              attributeName="r"
              values={`${apexGlow * 0.85};${apexGlow * 1.1};${apexGlow * 0.85}`}
              dur="2.4s"
              repeatCount="indefinite"
            />
          )}
        </circle>
        <circle cx={cx} cy={apexY} r={apexGlow * 0.4} fill="white" opacity="0.85" />
      </g>
    </svg>
  )
}
