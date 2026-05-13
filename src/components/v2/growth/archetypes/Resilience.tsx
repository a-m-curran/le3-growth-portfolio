'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp } from '../shared'

/**
 * Resilience — a bent-but-growing trunk.
 *
 * Why: resilience isn't smoothness, it's surviving disruption and
 * continuing to grow. We render a trunk that visibly bends partway up
 * (a "scar" from a past stress) and then continues vertically — with
 * fresh growth visibly emerging above the bend. Maturity adds more
 * recovered growth, not a straighter trunk.
 *
 * Visual semantics:
 *   growth (sdtLevel)       → length of new growth above the bend +
 *                             leaf canopy size
 *   density (conversations) → small new shoots branching off the
 *                             trunk where conversations "fed" recovery
 *   palette                 → Thrivers pillar warm oranges (transform
 *                             through heat)
 *
 * Animation: very gentle sway on the upper trunk, like a tree
 * adapting to wind.
 */
export function ResilienceVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const g = clamp01(growth)

  // Trunk goes from the soil at (80, 140) up. Below the bend is the
  // "old" growth — same across all levels. Above the bend is "new
  // growth" that scales with maturity.
  const bendX = 80
  const bendY = 90 // The kink point — fixed
  const bendOffset = -10 // The trunk bends left at this point

  // New growth height grows with maturity
  const newGrowthH = lerp(8, 55, g)
  const topX = bendX - bendOffset + (rand() - 0.5) * 4
  const topY = bendY - newGrowthH

  // Leaf radius scales with growth + density
  const canopyR = lerp(6, 18, g) + density * 4

  // Number of small recovery shoots growing off the trunk
  const shootCount = Math.floor(density * 5)

  const swayDur = animate ? '5s' : '0s'

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id={`res-bark-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.dark} stopOpacity={0.9} />
          <stop offset="100%" stopColor={palette.dark} stopOpacity={1} />
        </linearGradient>
      </defs>

      {/* Soft ground */}
      <ellipse cx={bendX} cy="142" rx="32" ry="5" fill={palette.dark} opacity="0.18" />

      {/* The lower trunk — pre-bend. Always there. */}
      <path
        d={`M ${bendX} 142 Q ${bendX - 2} 120 ${bendX + bendOffset} ${bendY}`}
        stroke={`url(#res-bark-${seed})`}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />

      {/* The bend "scar" — a small notch where the trunk recovered */}
      <circle
        cx={bendX + bendOffset}
        cy={bendY}
        r="3.5"
        fill={palette.dark}
        opacity="0.85"
      />
      <path
        d={`M ${bendX + bendOffset - 4} ${bendY - 1} Q ${bendX + bendOffset} ${bendY + 2} ${bendX + bendOffset + 4} ${bendY - 1}`}
        stroke={palette.accent}
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* The upper trunk — new growth — animated to sway gently */}
      <g>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`-1.5 ${bendX + bendOffset} ${bendY}`}
            to={`1.5 ${bendX + bendOffset} ${bendY}`}
            dur={swayDur}
            repeatCount="indefinite"
            additive="sum"
          >
            <animate
              attributeName="from"
              values={`-1.5 ${bendX + bendOffset} ${bendY};1.5 ${bendX + bendOffset} ${bendY};-1.5 ${bendX + bendOffset} ${bendY}`}
              dur={swayDur}
              repeatCount="indefinite"
            />
          </animateTransform>
        )}
        <path
          d={`M ${bendX + bendOffset} ${bendY} Q ${bendX + bendOffset + 3} ${(bendY + topY) / 2} ${topX} ${topY}`}
          stroke={`url(#res-bark-${seed})`}
          strokeWidth={lerp(5, 6.5, g)}
          fill="none"
          strokeLinecap="round"
        />

        {/* Recovery shoots branching off the upper trunk */}
        {Array.from({ length: shootCount }, (_, i) => {
          const t = (i + 0.5) / shootCount
          // Position along the upper trunk
          const sx = bendX + bendOffset + (topX - (bendX + bendOffset)) * t
          const sy = bendY + (topY - bendY) * t
          const dir = i % 2 === 0 ? -1 : 1
          const len = lerp(6, 14, rand())
          const ex = sx + dir * len
          const ey = sy - 2
          return (
            <g key={i}>
              <path
                d={`M ${sx} ${sy} Q ${sx + dir * 4} ${sy - 4} ${ex} ${ey}`}
                stroke={palette.mid}
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
                opacity="0.85"
              />
              {/* Tiny leaf at shoot tip */}
              <ellipse
                cx={ex}
                cy={ey}
                rx="3"
                ry="1.6"
                fill={palette.accent}
                transform={`rotate(${dir * 30} ${ex} ${ey})`}
                opacity="0.9"
              />
            </g>
          )
        })}

        {/* New-growth canopy at the top */}
        <g>
          <circle cx={topX} cy={topY} r={canopyR} fill={palette.mid} opacity="0.75" />
          <circle
            cx={topX - canopyR * 0.4}
            cy={topY - canopyR * 0.3}
            r={canopyR * 0.7}
            fill={palette.accent}
            opacity="0.6"
          />
          <circle
            cx={topX + canopyR * 0.5}
            cy={topY + canopyR * 0.1}
            r={canopyR * 0.6}
            fill={palette.mid}
            opacity="0.85"
          />
          {/* A few bright new shoots — the "I came back" signal */}
          {g > 0.25 && (
            <g>
              <circle cx={topX - 3} cy={topY - canopyR - 2} r="2" fill={palette.accent} />
              <circle cx={topX + 4} cy={topY - canopyR + 1} r="1.5" fill={palette.accent} opacity="0.85" />
            </g>
          )}
        </g>
      </g>
    </svg>
  )
}
