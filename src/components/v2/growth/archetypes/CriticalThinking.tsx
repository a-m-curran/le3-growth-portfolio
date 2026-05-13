'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Critical Thinking — crystalline lattice.
 *
 * Why: critical thinking is precise, structured, refines itself
 * through examination. A crystal grows by accreting facets — each
 * conversation adds another face, each level of confidence sharpens
 * the geometry.
 *
 * Depth treatment: the central spire uses a vertical gradient (light
 * facet face → dark base), facets share a subtle drop shadow so the
 * whole form lifts off the pillar background, and a ground-shadow
 * radial gradient sits under the base of the spire for contact.
 *
 * Animation: subtle inner shimmer — light pass across the central
 * facet on a slow loop.
 */
export function CriticalThinkingVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)

  // Facet count grows from 3 to 7 with maturity
  const facetCount = Math.round(lerp(3, 7, clamp01(growth)))
  const spireH = lerp(20, 55, clamp01(growth))
  const satellites = Math.floor(density * 4)

  const cx = 80
  const cy = 90

  const baseRadius = lerp(18, 26, clamp01(growth))
  const facets = generateFacets(facetCount, cx, cy, baseRadius, spireH, rand)

  const shimmerDur = animate ? '3.2s' : '0s'

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`ct-spire-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.accent} stopOpacity={0.95} />
          <stop offset="55%" stopColor={palette.mid} stopOpacity={0.9} />
          <stop offset="100%" stopColor={palette.dark} stopOpacity={0.95} />
        </linearGradient>
        <linearGradient id={`ct-facet-light-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`ct-shimmer-${seed}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.7" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`ct-clip-${seed}`}>
          <polygon
            points={`${cx},${cy - spireH} ${cx - baseRadius * 0.6},${cy} ${cx},${cy + 10} ${cx + baseRadius * 0.6},${cy}`}
          />
        </clipPath>
      </defs>

      {/* Ground-contact shadow — radial fade where the crystal meets
          the surface. Sized off growth so a small crystal has a
          small shadow. */}
      <ellipse
        cx={cx}
        cy={cy + 32}
        rx={lerp(22, 38, clamp01(growth))}
        ry="7"
        fill={`url(#${fid.ground})`}
      />

      {/* Satellite crystals — drop-shadowed too for depth */}
      <g filter={`url(#${fid.drop})`}>
        {Array.from({ length: satellites }, (_, i) => {
          const angle = (i / Math.max(satellites, 1)) * Math.PI * 2 + rand() * 0.6
          const dist = lerp(28, 40, rand())
          const sx = cx + Math.cos(angle) * dist
          const sy = cy + Math.sin(angle) * dist * 0.5 + 10
          const h = lerp(6, 14, rand())
          return (
            <g key={i}>
              <polygon
                points={`${sx},${sy - h} ${sx - 4},${sy} ${sx},${sy + 2} ${sx + 4},${sy}`}
                fill={palette.mid}
                opacity={0.7}
              />
              {/* Specular highlight */}
              <line
                x1={sx}
                y1={sy - h}
                x2={sx - 3}
                y2={sy - 1}
                stroke="white"
                strokeOpacity={0.5}
                strokeWidth="0.8"
                strokeLinecap="round"
              />
            </g>
          )
        })}
      </g>

      {/* Main crystal mass — drop shadow lifts it off the canvas */}
      <g filter={`url(#${fid.drop})`}>
        {facets.map((f, i) => (
          <polygon
            key={i}
            points={f.points}
            fill={f.tone === 'dark' ? palette.dark : f.tone === 'mid' ? palette.mid : palette.accent}
            fillOpacity={f.opacity}
            stroke={palette.dark}
            strokeWidth="0.6"
            strokeOpacity="0.65"
          />
        ))}

        {/* Central spire over the facets — clean edge */}
        <polygon
          points={`${cx},${cy - spireH} ${cx - baseRadius * 0.6},${cy} ${cx},${cy + 10} ${cx + baseRadius * 0.6},${cy}`}
          fill={`url(#ct-spire-${seed})`}
          fillOpacity={0.62}
        />

        {/* Light-facet overlay — adds the upper-face highlight */}
        <polygon
          points={`${cx},${cy - spireH} ${cx - baseRadius * 0.6},${cy} ${cx},${cy + 10}`}
          fill={`url(#ct-facet-light-${seed})`}
        />
      </g>

      {/* Animated shimmer pass — clipped to the spire silhouette */}
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

      {/* Sharp highlight edges */}
      <line
        x1={cx}
        y1={cy - spireH}
        x2={cx - baseRadius * 0.6}
        y2={cy}
        stroke="white"
        strokeOpacity={0.85}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <line
        x1={cx}
        y1={cy - spireH}
        x2={cx}
        y2={cy + 10}
        stroke="white"
        strokeOpacity={0.45}
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
  for (let i = 0; i < count; i++) {
    const t0 = (i / count) * Math.PI * 2 - Math.PI / 2
    const t1 = ((i + 1) / count) * Math.PI * 2 - Math.PI / 2
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
      opacity: 0.62 + rand() * 0.25,
    })
    facets.push({
      points: `${x0},${y0} ${x1},${y1} ${cx},${baseY}`,
      tone: 'dark',
      opacity: 0.5,
    })
  }
  return facets
}
