'use client'

import type { ArchetypeProps } from '../shared'
import { clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Social Awareness — a lighthouse beam.
 *
 * Why: social awareness is paying attention to the room. A lighthouse
 * sweeps a beam across the dark — illuminating what's there, even
 * when nothing's calling attention to itself. Growth widens the beam
 * (more peripheral vision) and brightens it (more attention).
 *
 * Depth: lighthouse tower has form-modeled gradient (light side / dark
 * side); beam is a clipped conic gradient that fades with distance;
 * ground gets the warm light of the beam reflecting back; sea-level
 * background suggests a horizon (depth perception).
 */
export function SocialAwarenessVisual({ growth, palette, seed, animate = true }: ArchetypeProps) {
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const towerX = 80
  const towerBase = 138
  const towerH = 50
  const towerTop = towerBase - towerH
  const beamLength = lerp(40, 90, g)
  const beamWidth = lerp(25, 60, g) // arc width in degrees

  // The beam is a polygon — apex at lantern, two outer points at
  // beamLength radius offset by ±beamWidth/2
  const apexX = towerX
  const apexY = towerTop - 2

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`sa-tower-${seed}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="40%" stopColor={palette.dark} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="1" />
        </linearGradient>
        <radialGradient id={`sa-lantern-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="40%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`sa-beam-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.65" />
          <stop offset="50%" stopColor={palette.accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`sa-horizon-${seed}`} cx="50%" cy="100%" r="100%">
          <stop offset="0%" stopColor={palette.dark} stopOpacity="0.18" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Horizon backing — gives depth */}
      <rect x="0" y="0" width="160" height="160" fill={`url(#sa-horizon-${seed})`} />

      {/* Beam — rotating sector swept from the lantern */}
      <g style={{ transformOrigin: `${apexX}px ${apexY}px` }}>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`-30 ${apexX} ${apexY};30 ${apexX} ${apexY};-30 ${apexX} ${apexY}`}
            dur="6s"
            repeatCount="indefinite"
          />
        )}
        <path
          d={`
            M ${apexX} ${apexY}
            L ${apexX - Math.sin((beamWidth * Math.PI) / 360) * beamLength} ${apexY - Math.cos((beamWidth * Math.PI) / 360) * beamLength}
            A ${beamLength} ${beamLength} 0 0 1 ${apexX + Math.sin((beamWidth * Math.PI) / 360) * beamLength} ${apexY - Math.cos((beamWidth * Math.PI) / 360) * beamLength}
            Z
          `}
          fill={`url(#sa-beam-${seed})`}
        />
      </g>

      {/* Tower body */}
      <g filter={`url(#${fid.drop})`}>
        {/* Trapezoid tower */}
        <path
          d={`M ${towerX - 5} ${towerBase} L ${towerX + 5} ${towerBase} L ${towerX + 3.5} ${towerTop + 6} L ${towerX - 3.5} ${towerTop + 6} Z`}
          fill={`url(#sa-tower-${seed})`}
        />
        {/* Stripes — the classic lighthouse band */}
        <rect x={towerX - 4.5} y={towerBase - 30} width="9" height="6" fill={palette.accent} opacity="0.85" />
        <rect x={towerX - 4} y={towerBase - 14} width="8" height="5" fill={palette.accent} opacity="0.85" />
        {/* Lantern housing */}
        <rect x={towerX - 5} y={towerTop} width="10" height="6" fill={palette.dark} rx="1" />
      </g>

      {/* Lantern glow — fixed, doesn't rotate with the beam */}
      <g filter={`url(#${fid.glow})`}>
        <circle cx={apexX} cy={apexY} r="4.5" fill={`url(#sa-lantern-${seed})`} />
        <circle cx={apexX} cy={apexY} r="1.8" fill="white">
          {animate && (
            <animate
              attributeName="opacity"
              values="1;0.7;1"
              dur="1.6s"
              repeatCount="indefinite"
            />
          )}
        </circle>
      </g>

      {/* Ground / sea — warm reflected glow */}
      <ellipse
        cx={towerX}
        cy={towerBase + 4}
        rx={lerp(20, 35, g)}
        ry="5"
        fill={`url(#${fid.ground})`}
      />
    </svg>
  )
}
