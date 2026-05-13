'use client'

import type { ArchetypeProps } from '../shared'
import { clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Networking — your network of people, branching outward.
 *
 * Why: networking is the act of building a structured web of
 * connections. We render YOU in the center (head + shoulders
 * silhouette) with branching connection lines to other people you've
 * met. Each new connection is another person silhouette appearing at
 * the end of a fresh line.
 *
 * Distinct from Social Awareness (passive sensing of mood) by the
 * *explicit connection lines* between figures and the *branching tree
 * structure* rather than concentric rings.
 *
 * Composition stages (continuous):
 *   g 0.00–0.20  just you
 *   g 0.20–0.55  first ring of close connections (3 people)
 *   g 0.55–0.85  second ring appears, branching from the first
 *   g 0.85–1.00  full network — extended connections, light pulses
 *                travel along the lines
 *
 * Depth: each person silhouette has a drop shadow; lines have a
 * subtle width gradient (thicker near you, thinner outward).
 */
export function NetworkingVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const cx = 80
  const cy = 90

  // First-ring connections — three people around you
  const ring1 = [
    { x: 30, y: 65, angle: 0 },
    { x: 130, y: 60, angle: 1 },
    { x: 80, y: 38, angle: 2 },
  ]
  // Second-ring connections — branches off first ring
  const ring2 = [
    { parentIdx: 0, x: 15, y: 110 },
    { parentIdx: 1, x: 142, y: 105 },
    { parentIdx: 0, x: 38, y: 30 },
    { parentIdx: 2, x: 120, y: 20 },
  ]

  const ring1Visible = Math.floor(lerp(0, ring1.length, fadeIn(g, 0.15, 0.55)))
  const ring2Visible = Math.floor(lerp(0, ring2.length, fadeIn(g, 0.55, 0.95)))

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`net-you-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.accent} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
        <linearGradient id={`net-contact-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
        <radialGradient id={`net-pulse-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="50%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx={cx} cy="148" rx="65" ry="6" fill={`url(#${fid.ground})`} />

      {/* Lines from you to first-ring connections */}
      <g stroke={palette.dark} fill="none" strokeLinecap="round" opacity="0.7">
        {ring1.slice(0, ring1Visible).map((p, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy - 6}
            x2={p.x}
            y2={p.y}
            strokeWidth={lerp(1.2, 2, fadeIn(g, 0.15 + i * 0.1, 0.4 + i * 0.1))}
            opacity={fadeIn(g, 0.15 + i * 0.1, 0.4 + i * 0.1)}
          />
        ))}
      </g>

      {/* Lines from first-ring → second-ring */}
      <g stroke={palette.mid} fill="none" strokeLinecap="round" opacity="0.6">
        {ring2.slice(0, ring2Visible).map((p, i) => {
          const parent = ring1[p.parentIdx]
          return (
            <line
              key={i}
              x1={parent.x}
              y1={parent.y}
              x2={p.x}
              y2={p.y}
              strokeWidth="1.2"
              opacity={fadeIn(g, 0.55 + i * 0.08, 0.8 + i * 0.05)}
            />
          )
        })}
      </g>

      {/* Light pulses travelling outward along the lines (full growth) */}
      {animate &&
        g > 0.6 &&
        ring1.slice(0, ring1Visible).map((p, i) => (
          <circle key={i} r="2" fill={`url(#net-pulse-${seed})`} filter={`url(#${fid.glow})`}>
            <animate
              attributeName="cx"
              values={`${cx};${p.x}`}
              dur="2.4s"
              begin={`${i * 0.5}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values={`${cy - 6};${p.y}`}
              dur="2.4s"
              begin={`${i * 0.5}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              dur="2.4s"
              begin={`${i * 0.5}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}

      {/* Second-ring people (drawn before first-ring so first overlaps if needed) */}
      {ring2.slice(0, ring2Visible).map((p, i) => (
        <g key={i} opacity={fadeIn(g, 0.55 + i * 0.08, 0.85)} filter={`url(#${fid.drop})`}>
          <NetworkPerson cx={p.x} cy={p.y} fill={`url(#net-contact-${seed})`} size="small" />
        </g>
      ))}

      {/* First-ring people */}
      {ring1.slice(0, ring1Visible).map((p, i) => (
        <g key={i} opacity={fadeIn(g, 0.15 + i * 0.1, 0.45 + i * 0.1)} filter={`url(#${fid.drop})`}>
          <NetworkPerson cx={p.x} cy={p.y} fill={`url(#net-contact-${seed})`} size="medium" />
        </g>
      ))}

      {/* You — central figure */}
      <g filter={`url(#${fid.drop})`}>
        <NetworkPerson cx={cx} cy={cy} fill={`url(#net-you-${seed})`} size="large" />
        {/* Density indicator: small highlight on head */}
        {density > 0.3 && (
          <circle cx={cx - 3} cy={cy - 14} r="2" fill="white" opacity={lerp(0.3, 0.7, density)} />
        )}
      </g>
    </svg>
  )
}

function NetworkPerson({
  cx,
  cy,
  fill,
  size,
}: {
  cx: number
  cy: number
  fill: string
  size: 'small' | 'medium' | 'large'
}) {
  const headR = size === 'large' ? 9 : size === 'medium' ? 6 : 4.5
  const shoulderW = size === 'large' ? 16 : size === 'medium' ? 11 : 8
  const shoulderH = size === 'large' ? 14 : size === 'medium' ? 10 : 7
  const headY = cy - headR - 1
  return (
    <g>
      <circle cx={cx} cy={headY} r={headR} fill={fill} />
      {/* Shoulders / torso — half-pill */}
      <path
        d={`
          M ${cx - shoulderW} ${cy + shoulderH}
          Q ${cx - shoulderW} ${cy + 2} ${cx - shoulderW * 0.4} ${cy}
          L ${cx + shoulderW * 0.4} ${cy}
          Q ${cx + shoulderW} ${cy + 2} ${cx + shoulderW} ${cy + shoulderH}
          Z
        `}
        fill={fill}
      />
    </g>
  )
}

function fadeIn(g: number, start: number, end: number): number {
  if (g <= start) return 0
  if (g >= end) return 1
  const t = (g - start) / (end - start)
  return t * t * (3 - 2 * t)
}
