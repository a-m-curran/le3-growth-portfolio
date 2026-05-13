'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Communication — a river/current.
 *
 * Why: communication is what flows between two banks. We draw a
 * flowing curve from left to right (the channel) that widens with
 * confidence and picks up tributaries with conversation density.
 * Surface ripples animate downstream so the river is always moving.
 *
 * Depth: river bed has inset shadow giving it depth (you're looking
 * DOWN at water); surface gradient (light at center, dark at banks);
 * banks have drop shadow against the bed; ground absent — this
 * artwork lives in the surface plane, not standing on ground.
 */
export function CommunicationVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const riverWidth = lerp(8, 22, g)
  const midY = 80

  // River path — flows left to right with some sinuous bends
  const riverPath = `
    M 5 ${midY - 5}
    C 30 ${midY - 12}, 60 ${midY + 8}, 80 ${midY}
    S 130 ${midY - 8}, 155 ${midY - 2}
  `
  const riverWidePath = `
    M 5 ${midY - 5 - riverWidth / 2}
    C 30 ${midY - 12 - riverWidth / 2}, 60 ${midY + 8 - riverWidth / 2}, 80 ${midY - riverWidth / 2}
    S 130 ${midY - 8 - riverWidth / 2}, 155 ${midY - 2 - riverWidth / 2}
    L 155 ${midY - 2 + riverWidth / 2}
    C 130 ${midY - 8 + riverWidth / 2}, 100 ${midY + 4 + riverWidth / 2}, 80 ${midY + riverWidth / 2}
    S 30 ${midY - 12 + riverWidth / 2}, 5 ${midY - 5 + riverWidth / 2}
    Z
  `

  // Surface flow particles
  const flowCount = 3 + Math.floor(density * 4)
  const flows = Array.from({ length: flowCount }, () => ({
    yOffset: (rand() - 0.5) * riverWidth * 0.6,
    delay: rand() * 3,
    speed: lerp(2.5, 4, rand()),
  }))

  // Tributaries (small inflows)
  const tribCount = Math.floor(density * 3)
  const tributaries = Array.from({ length: tribCount }, (_, i) => {
    const fromTop = i % 2 === 0
    const xPos = 35 + i * 30 + rand() * 10
    return { x: xPos, fromTop }
  })

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`com-surface-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.dark} stopOpacity="0.5" />
          <stop offset="50%" stopColor={palette.mid} stopOpacity="0.85" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`com-shimmer-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`com-clip-${seed}`}>
          <path d={riverWidePath} />
        </clipPath>
      </defs>

      {/* River bed — fill with gradient + inset shadow */}
      <path d={riverWidePath} fill={`url(#com-surface-${seed})`} filter={`url(#${fid.inset})`} />

      {/* Tributaries — narrower flows joining the main river */}
      {tributaries.map((t, i) => (
        <g key={i} clipPath={`url(#com-clip-${seed})`}>
          <path
            d={`M ${t.x} ${t.fromTop ? 10 : 150} Q ${t.x + 4} ${midY + (t.fromTop ? -10 : 10)}, ${t.x + 6} ${midY}`}
            stroke={palette.mid}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            opacity="0.75"
          />
        </g>
      ))}

      {/* Surface flow streaks — clipped to river shape */}
      <g clipPath={`url(#com-clip-${seed})`}>
        {flows.map((f, i) => (
          <ellipse
            key={i}
            cx="0"
            cy={midY + f.yOffset}
            rx="14"
            ry="1.4"
            fill="white"
            opacity="0.55"
          >
            {animate && (
              <animate
                attributeName="cx"
                values="-10;170"
                dur={`${f.speed}s`}
                begin={`${f.delay}s`}
                repeatCount="indefinite"
              />
            )}
          </ellipse>
        ))}
      </g>

      {/* Highlight along upper edge — the light catching the surface */}
      <path
        d={riverPath}
        stroke="white"
        strokeOpacity="0.4"
        strokeWidth="0.8"
        fill="none"
      />

      {/* Bank markers — small accent dots at each end */}
      <g filter={`url(#${fid.drop})`}>
        <circle cx="6" cy={midY - 5} r="2.5" fill={palette.dark} opacity="0.8" />
        <circle cx="154" cy={midY - 2} r="2.5" fill={palette.dark} opacity="0.8" />
      </g>
    </svg>
  )
}
