'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp } from '../shared'

/**
 * Critical Thinking — crystalline lattice.
 *
 * Why: critical thinking is precise, structured, refines itself
 * through examination. A crystal grows by accreting facets — each
 * conversation adds another face, each level of confidence sharpens
 * the geometry.
 *
 * Visual semantics:
 *   growth (sdtLevel)       → number of major facets + clarity of
 *                             the central spire
 *   density (conversations) → secondary facets that fill in around
 *                             the main shape
 *   palette                 → cool pillar tones (Creative pillar's
 *                             blues read as "cerebral")
 *
 * Animation: subtle inner shimmer — light pass across the central
 * facet on a slow loop. Hover scales up gently and brightens the
 * accent edges (handled by parent wrapper, not in here).
 */
export function CriticalThinkingVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  // Facet count grows from 3 (sapling crystal) to 7 (full polyhedron)
  const facetCount = Math.round(lerp(3, 7, clamp01(growth)))
  // Spire height grows with maturity
  const spireH = lerp(20, 55, clamp01(growth))
  // Secondary "satellite" crystals appear as conversations accrue
  const satellites = Math.floor(density * 4)

  // Center of the canvas
  const cx = 80
  const cy = 90

  // Generate facet polygon: a vertical hexagonal prism, viewed slightly
  // from above. Each "facet" is a quad on the face of the prism.
  const baseRadius = lerp(18, 26, clamp01(growth))
  const facets = generateFacets(facetCount, cx, cy, baseRadius, spireH, rand)

  // Light pass overlay — animated stripe sweeping across spire
  const shimmerDur = animate ? '3.2s' : '0s'

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id={`ct-spire-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.accent} stopOpacity={0.9} />
          <stop offset="60%" stopColor={palette.mid} stopOpacity={0.85} />
          <stop offset="100%" stopColor={palette.dark} stopOpacity={0.9} />
        </linearGradient>
        <linearGradient id={`ct-shimmer-${seed}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.7" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`ct-clip-${seed}`}>
          {/* Clip the shimmer to the spire silhouette */}
          <polygon
            points={`${cx},${cy - spireH} ${cx - baseRadius * 0.6},${cy} ${cx},${cy + 10} ${cx + baseRadius * 0.6},${cy}`}
          />
        </clipPath>
      </defs>

      {/* Soft ground glow */}
      <ellipse
        cx={cx}
        cy={cy + 30}
        rx={lerp(28, 42, clamp01(growth))}
        ry="6"
        fill={palette.mid}
        opacity="0.15"
      />

      {/* Satellite crystals — small fragments around the main spire */}
      {Array.from({ length: satellites }, (_, i) => {
        const angle = (i / Math.max(satellites, 1)) * Math.PI * 2 + rand() * 0.6
        const dist = lerp(28, 40, rand())
        const sx = cx + Math.cos(angle) * dist
        const sy = cy + Math.sin(angle) * dist * 0.5 + 10
        const h = lerp(6, 14, rand())
        return (
          <polygon
            key={i}
            points={`${sx},${sy - h} ${sx - 4},${sy} ${sx},${sy + 2} ${sx + 4},${sy}`}
            fill={palette.mid}
            opacity={0.55}
          />
        )
      })}

      {/* Main crystal — central spire (drawn back-first via facets) */}
      {facets.map((f, i) => (
        <polygon
          key={i}
          points={f.points}
          fill={f.tone === 'dark' ? palette.dark : f.tone === 'mid' ? palette.mid : palette.accent}
          fillOpacity={f.opacity}
          stroke={palette.dark}
          strokeWidth="0.6"
          strokeOpacity="0.6"
        />
      ))}

      {/* Central spire silhouette over the facets for a clean edge */}
      <polygon
        points={`${cx},${cy - spireH} ${cx - baseRadius * 0.6},${cy} ${cx},${cy + 10} ${cx + baseRadius * 0.6},${cy}`}
        fill={`url(#ct-spire-${seed})`}
        fillOpacity={0.55}
      />

      {/* Animated shimmer pass across spire */}
      <g clipPath={`url(#ct-clip-${seed})`}>
        <rect
          x={cx - baseRadius - 30}
          y={cy - spireH - 5}
          width="20"
          height={spireH + 20}
          fill={`url(#ct-shimmer-${seed})`}
          opacity="0.65"
        >
          {animate && (
            <animate
              attributeName="x"
              from={cx - baseRadius - 30}
              to={cx + baseRadius + 10}
              dur={shimmerDur}
              repeatCount="indefinite"
            />
          )}
        </rect>
      </g>

      {/* Highlight edge on the spire — adds the "sharpness" */}
      <line
        x1={cx}
        y1={cy - spireH}
        x2={cx - baseRadius * 0.6}
        y2={cy}
        stroke="white"
        strokeOpacity={0.75}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <line
        x1={cx}
        y1={cy - spireH}
        x2={cx}
        y2={cy + 10}
        stroke="white"
        strokeOpacity={0.4}
        strokeWidth="0.8"
      />
    </svg>
  )
}

interface Facet {
  points: string
  tone: 'dark' | 'mid' | 'accent'
  opacity: number
}

function generateFacets(
  count: number,
  cx: number,
  cy: number,
  r: number,
  h: number,
  rand: () => number
): Facet[] {
  const facets: Facet[] = []
  // Build a fan of triangular facets around the spire's base
  for (let i = 0; i < count; i++) {
    const t0 = (i / count) * Math.PI * 2 - Math.PI / 2
    const t1 = ((i + 1) / count) * Math.PI * 2 - Math.PI / 2
    // Slight outward jitter per facet so the crystal doesn't read as a
    // perfect hexagon — feels handcrafted
    const r0 = r * (0.85 + rand() * 0.25)
    const r1 = r * (0.85 + rand() * 0.25)
    const x0 = cx + Math.cos(t0) * r0
    const y0 = cy + Math.sin(t0) * r0 * 0.35
    const x1 = cx + Math.cos(t1) * r1
    const y1 = cy + Math.sin(t1) * r1 * 0.35
    const apexX = cx
    const apexY = cy - h
    const baseY = cy + 10
    facets.push({
      points: `${x0},${y0} ${x1},${y1} ${apexX},${apexY}`,
      tone: i % 3 === 0 ? 'accent' : i % 2 === 0 ? 'mid' : 'dark',
      opacity: 0.6 + rand() * 0.25,
    })
    // Lower band — connects each facet down to the soft base
    facets.push({
      points: `${x0},${y0} ${x1},${y1} ${cx},${baseY}`,
      tone: 'dark',
      opacity: 0.45,
    })
  }
  return facets
}
