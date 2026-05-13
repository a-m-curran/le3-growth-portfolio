'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Resilience — a bent-but-growing trunk.
 *
 * Why: resilience isn't smoothness, it's surviving disruption and
 * continuing to grow. A trunk that visibly bends partway up (a "scar"
 * from past stress) then continues vertically — with fresh growth
 * emerging above the bend. Maturity adds more recovered growth, not
 * a straighter trunk.
 *
 * Depth treatment: trunk uses a vertical bark gradient (light highlight
 * on the upper face, darker shadow side), canopy circles get a drop
 * shadow + radial-gradient form modeling, ground gets a cast shadow
 * radial gradient.
 *
 * Animation: very gentle sway on the upper trunk segment only — like
 * a young branch adapting to wind while the established trunk holds
 * firm.
 */
export function ResilienceVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const bendX = 80
  const bendY = 90
  const bendOffset = -10

  const newGrowthH = lerp(8, 55, g)
  const topX = bendX - bendOffset + (rand() - 0.5) * 4
  const topY = bendY - newGrowthH

  const canopyR = lerp(6, 18, g) + density * 4
  const shootCount = Math.floor(density * 5)

  const swayDur = animate ? '5s' : '0s'

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        {/* Trunk bark gradient: darker side / lighter side */}
        <linearGradient id={`res-bark-${seed}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={palette.dark} stopOpacity="1" />
          <stop offset="55%" stopColor={palette.dark} stopOpacity="0.92" />
          <stop offset="100%" stopColor="white" stopOpacity="0.18" />
        </linearGradient>
        {/* Canopy form-model gradient: bright center → darker edge */}
        <radialGradient id={`res-canopy-${seed}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="55%" stopColor={palette.mid} stopOpacity="0.9" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.65" />
        </radialGradient>
      </defs>

      {/* Cast shadow on ground */}
      <ellipse cx={bendX} cy="143" rx="32" ry="6" fill={`url(#${fid.ground})`} />

      {/* Lower trunk — pre-bend, always there */}
      <g filter={`url(#${fid.drop})`}>
        <path
          d={`M ${bendX} 142 Q ${bendX - 2} 120 ${bendX + bendOffset} ${bendY}`}
          stroke={`url(#res-bark-${seed})`}
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Bark highlight stroke — runs along the light side */}
        <path
          d={`M ${bendX + 1.5} 142 Q ${bendX - 0.5} 120 ${bendX + bendOffset + 1.5} ${bendY}`}
          stroke="white"
          strokeOpacity="0.25"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* Scar knot at the bend */}
      <g filter={`url(#${fid.drop})`}>
        <circle
          cx={bendX + bendOffset}
          cy={bendY}
          r="4"
          fill={palette.dark}
          opacity="0.92"
        />
        <circle
          cx={bendX + bendOffset - 1}
          cy={bendY - 1}
          r="1.5"
          fill="white"
          opacity="0.3"
        />
      </g>
      <path
        d={`M ${bendX + bendOffset - 4} ${bendY - 1} Q ${bendX + bendOffset} ${bendY + 2} ${bendX + bendOffset + 4} ${bendY - 1}`}
        stroke={palette.accent}
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Upper trunk + canopy — swaying group */}
      <g style={{ transformOrigin: `${bendX + bendOffset}px ${bendY}px` }}>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`-1.5 ${bendX + bendOffset} ${bendY};1.5 ${bendX + bendOffset} ${bendY};-1.5 ${bendX + bendOffset} ${bendY}`}
            dur={swayDur}
            repeatCount="indefinite"
          />
        )}
        <g filter={`url(#${fid.drop})`}>
          <path
            d={`M ${bendX + bendOffset} ${bendY} Q ${bendX + bendOffset + 3} ${(bendY + topY) / 2} ${topX} ${topY}`}
            stroke={`url(#res-bark-${seed})`}
            strokeWidth={lerp(5, 6.8, g)}
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* Recovery shoots */}
        {Array.from({ length: shootCount }, (_, i) => {
          const t = (i + 0.5) / shootCount
          const sx = bendX + bendOffset + (topX - (bendX + bendOffset)) * t
          const sy = bendY + (topY - bendY) * t
          const dir = i % 2 === 0 ? -1 : 1
          const len = lerp(6, 14, rand())
          const ex = sx + dir * len
          const ey = sy - 2
          return (
            <g key={i} filter={`url(#${fid.drop})`}>
              <path
                d={`M ${sx} ${sy} Q ${sx + dir * 4} ${sy - 4} ${ex} ${ey}`}
                stroke={palette.mid}
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />
              <ellipse
                cx={ex}
                cy={ey}
                rx="3.2"
                ry="1.8"
                fill={palette.accent}
                transform={`rotate(${dir * 30} ${ex} ${ey})`}
              />
            </g>
          )
        })}

        {/* Canopy — form-modeled with radial gradient */}
        <g filter={`url(#${fid.drop})`}>
          <circle cx={topX} cy={topY} r={canopyR} fill={`url(#res-canopy-${seed})`} />
          <circle
            cx={topX - canopyR * 0.5}
            cy={topY - canopyR * 0.4}
            r={canopyR * 0.65}
            fill={palette.accent}
            opacity="0.55"
          />
          <circle
            cx={topX + canopyR * 0.45}
            cy={topY + canopyR * 0.15}
            r={canopyR * 0.55}
            fill={palette.mid}
            opacity="0.85"
          />
          {/* Specular highlight */}
          <circle
            cx={topX - canopyR * 0.45}
            cy={topY - canopyR * 0.45}
            r={canopyR * 0.25}
            fill="white"
            opacity="0.35"
          />
          {/* Top-of-canopy new shoots — the "I came back" signal */}
          {g > 0.25 && (
            <g>
              <circle cx={topX - 3} cy={topY - canopyR - 2} r="2.2" fill={palette.accent} />
              <circle cx={topX + 4} cy={topY - canopyR + 1} r="1.7" fill={palette.accent} opacity="0.9" />
            </g>
          )}
        </g>
      </g>
    </svg>
  )
}
