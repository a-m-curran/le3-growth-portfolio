'use client'

import type { ArchetypeProps } from '../shared'
import { clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'
import { CelebrationGlow, CelebrationSparkles } from '../CelebrationLayer'

/**
 * Relationship Building — two trees with intertwined branches.
 *
 * Why: relationships are sustained, parallel growth. Two trees, one
 * on each side, with their canopies growing toward each other over
 * time until their branches and leaves merge in the middle.
 *
 * Composition stages (continuous):
 *   g 0.00–0.25  two saplings, leaning slightly toward each other
 *   g 0.25–0.55  short trees with separate canopies
 *   g 0.55–0.85  canopies reach toward each other
 *   g 0.85–1.00  canopies overlap; branches intertwine; mixed leaves
 *
 * Depth: each tree's trunk has a bark gradient (light/shadow side);
 * each canopy uses radial gradient form modeling; the overlap zone
 * has a small bloom indicating shared flowering; ground gets a cast
 * shadow uniting them.
 */
export function RelationshipBuildingVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const baseY = 138
  // Tree 1 — left. Taller, fuller canopy at peak.
  const t1Base = 45
  const t1H = lerp(22, 88, g)
  const t1Lean = lerp(0, 6, g)
  const t1Top = baseY - t1H

  // Tree 2 — right
  const t2Base = 115
  const t2H = lerp(22, 88, g)
  const t2Lean = lerp(0, -6, g)
  const t2Top = baseY - t2H

  // Bigger canopies at peak
  const canopyR1 = lerp(8, 26, g)
  const canopyR2 = lerp(8, 26, g)
  // Canopy x positions — converge with growth
  const cnp1X = t1Base + t1Lean
  const cnp2X = t2Base + t2Lean

  const overlapping = g > 0.55
  const bloomOpacity = fadeIn(g, 0.85, 1)

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`rb-trunk-${seed}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#5a3920" />
          <stop offset="50%" stopColor="#7d5230" />
          <stop offset="100%" stopColor="#3a2412" />
        </linearGradient>
        <radialGradient id={`rb-canopy1-${seed}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="60%" stopColor={palette.mid} stopOpacity="0.9" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.7" />
        </radialGradient>
        <radialGradient id={`rb-canopy2-${seed}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.4" />
          <stop offset="40%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.75" />
        </radialGradient>
        <radialGradient id={`rb-bloom-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
          <stop offset="50%" stopColor={palette.accent} stopOpacity="0.85" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Peak-glow halo */}
      <CelebrationGlow growth={growth} palette={palette} seed={seed} />

      {/* Cast shadow uniting both trees */}
      <ellipse cx="80" cy={baseY + 5} rx={lerp(40, 65, g)} ry="6" fill={`url(#${fid.ground})`} />

      {/* Trunk 1 + branches */}
      <g style={{ transformOrigin: `${t1Base}px ${baseY}px` }}>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`-0.6 ${t1Base} ${baseY};0.6 ${t1Base} ${baseY};-0.6 ${t1Base} ${baseY}`}
            dur="6s"
            repeatCount="indefinite"
          />
        )}
        <g filter={`url(#${fid.drop})`}>
          <path
            d={`M ${t1Base} ${baseY} Q ${t1Base + t1Lean * 0.4} ${(baseY + t1Top) / 2}, ${cnp1X} ${t1Top}`}
            stroke={`url(#rb-trunk-${seed})`}
            strokeWidth={lerp(3, 4.5, g)}
            fill="none"
            strokeLinecap="round"
          />
          {/* Side branch reaching toward the other tree */}
          {g > 0.45 && (
            <path
              d={`M ${cnp1X} ${t1Top + 8} Q ${cnp1X + 8} ${t1Top + 4}, ${cnp1X + 14} ${t1Top + 6}`}
              stroke={`url(#rb-trunk-${seed})`}
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              opacity={fadeIn(g, 0.45, 0.7)}
            />
          )}
        </g>
      </g>

      {/* Trunk 2 + branches — mirror */}
      <g style={{ transformOrigin: `${t2Base}px ${baseY}px` }}>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0.6 ${t2Base} ${baseY};-0.6 ${t2Base} ${baseY};0.6 ${t2Base} ${baseY}`}
            dur="6s"
            repeatCount="indefinite"
          />
        )}
        <g filter={`url(#${fid.drop})`}>
          <path
            d={`M ${t2Base} ${baseY} Q ${t2Base + t2Lean * 0.4} ${(baseY + t2Top) / 2}, ${cnp2X} ${t2Top}`}
            stroke={`url(#rb-trunk-${seed})`}
            strokeWidth={lerp(3, 4.5, g)}
            fill="none"
            strokeLinecap="round"
          />
          {g > 0.45 && (
            <path
              d={`M ${cnp2X} ${t2Top + 8} Q ${cnp2X - 8} ${t2Top + 4}, ${cnp2X - 14} ${t2Top + 6}`}
              stroke={`url(#rb-trunk-${seed})`}
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              opacity={fadeIn(g, 0.45, 0.7)}
            />
          )}
        </g>
      </g>

      {/* Canopy 1 (back) */}
      <g filter={`url(#${fid.drop})`}>
        <circle cx={cnp1X} cy={t1Top} r={canopyR1} fill={`url(#rb-canopy1-${seed})`} />
        <circle cx={cnp1X - canopyR1 * 0.4} cy={t1Top - canopyR1 * 0.3} r={canopyR1 * 0.55} fill={palette.accent} opacity="0.65" />
        <circle cx={cnp1X + canopyR1 * 0.45} cy={t1Top + canopyR1 * 0.2} r={canopyR1 * 0.5} fill={palette.mid} opacity="0.85" />
        {/* Specular */}
        <circle cx={cnp1X - canopyR1 * 0.45} cy={t1Top - canopyR1 * 0.45} r={canopyR1 * 0.22} fill="white" opacity="0.45" />
      </g>

      {/* Canopy 2 — overlapping when grown */}
      <g filter={`url(#${fid.drop})`}>
        <circle cx={cnp2X} cy={t2Top} r={canopyR2} fill={`url(#rb-canopy2-${seed})`} />
        <circle cx={cnp2X - canopyR2 * 0.4} cy={t2Top - canopyR2 * 0.3} r={canopyR2 * 0.5} fill={palette.accent} opacity="0.65" />
        <circle cx={cnp2X + canopyR2 * 0.45} cy={t2Top + canopyR2 * 0.2} r={canopyR2 * 0.5} fill={palette.mid} opacity="0.85" />
        <circle cx={cnp2X - canopyR2 * 0.45} cy={t2Top - canopyR2 * 0.45} r={canopyR2 * 0.22} fill="white" opacity="0.4" />
      </g>

      {/* Overlap zone — small mixed leaves where canopies meet */}
      {overlapping && (
        <g opacity={fadeIn(g, 0.55, 0.85)}>
          <circle
            cx={(cnp1X + cnp2X) / 2}
            cy={(t1Top + t2Top) / 2}
            r={lerp(6, 10, g)}
            fill={palette.mid}
            opacity="0.7"
          />
          <circle
            cx={(cnp1X + cnp2X) / 2 + 2}
            cy={(t1Top + t2Top) / 2 - 2}
            r={lerp(4, 7, g)}
            fill={palette.accent}
            opacity="0.55"
          />
        </g>
      )}

      {/* Shared bloom in the overlap — appears at full growth */}
      {bloomOpacity > 0.01 && (
        <g
          opacity={bloomOpacity}
          filter={`url(#${fid.glow})`}
          style={{ transformOrigin: `${(cnp1X + cnp2X) / 2}px ${(t1Top + t2Top) / 2}px` }}
        >
          {animate && (
            <animate
              attributeName="opacity"
              values={`${bloomOpacity * 0.7};${bloomOpacity};${bloomOpacity * 0.7}`}
              dur="2.5s"
              repeatCount="indefinite"
            />
          )}
          <circle
            cx={(cnp1X + cnp2X) / 2}
            cy={(t1Top + t2Top) / 2}
            r="5.5"
            fill={`url(#rb-bloom-${seed})`}
          />
          <circle
            cx={(cnp1X + cnp2X) / 2}
            cy={(t1Top + t2Top) / 2}
            r="2"
            fill="white"
            opacity="0.9"
          />
          {/* Extra petals/blooms scattered in the overlap at peak */}
          <circle cx={(cnp1X + cnp2X) / 2 - 8} cy={(t1Top + t2Top) / 2 + 4} r="2.5" fill={palette.accent} opacity="0.8" />
          <circle cx={(cnp1X + cnp2X) / 2 + 7} cy={(t1Top + t2Top) / 2 - 5} r="2" fill={palette.accent} opacity="0.85" />
          <circle cx={(cnp1X + cnp2X) / 2 + 2} cy={(t1Top + t2Top) / 2 + 6} r="1.6" fill="white" opacity="0.75" />
        </g>
      )}

      {/* Celebration sparkles around the joined canopies at peak */}
      <CelebrationSparkles
        growth={growth}
        density={density}
        palette={palette}
        seed={seed}
        animate={animate}
        innerExclude={48}
      />
    </svg>
  )
}

function fadeIn(g: number, start: number, end: number): number {
  if (g <= start) return 0
  if (g >= end) return 1
  const t = (g - start) / (end - start)
  return t * t * (3 - 2 * t)
}
