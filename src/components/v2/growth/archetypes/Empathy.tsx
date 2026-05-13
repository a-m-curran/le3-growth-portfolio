'use client'

import type { ArchetypeProps } from '../shared'
import { clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Empathy — overlapping concentric ripples.
 *
 * Why: empathy is what happens when one person's interior reaches
 * another's. We draw two (or three, at high confidence) sets of
 * concentric ripples whose outermost rings overlap in the middle.
 * The intersection — the meeting place — is what gets richer with
 * growth.
 *
 * Depth: outer rings get drop shadows for separation; the
 * intersection area is rendered as a separate blended shape with
 * stronger color saturation; ground gets a soft cast shadow.
 *
 * Animation: each ripple set expands continuously from its center,
 * so the meeting place is always being remade.
 */
export function EmpathyVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  // Two ripple centers — left and right. At high growth, a third
  // appears between them (a triangulation).
  const hasThird = g > 0.65
  const centers = hasThird
    ? [
        { x: 50, y: 80 },
        { x: 110, y: 80 },
        { x: 80, y: 110 },
      ]
    : [
        { x: 55, y: 85 },
        { x: 105, y: 85 },
      ]

  // Number of rings per center scales with growth
  const ringCount = Math.max(2, Math.round(lerp(2, 5, g)))
  const maxR = lerp(18, 32, g)

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <radialGradient id={`emp-core-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="60%" stopColor={palette.mid} stopOpacity="0.9" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.7" />
        </radialGradient>
      </defs>

      {/* Cast shadow under the combined form */}
      <ellipse cx="80" cy="140" rx="42" ry="5" fill={`url(#${fid.ground})`} />

      {/* Each ripple set, behind */}
      {centers.map((c, idx) => (
        <g key={idx}>
          {Array.from({ length: ringCount }, (_, i) => {
            const r = ((i + 1) / ringCount) * maxR
            return (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={r}
                fill="none"
                stroke={idx === 0 ? palette.mid : idx === 1 ? palette.accent : palette.dark}
                strokeWidth={lerp(2, 0.8, i / ringCount)}
                strokeOpacity={lerp(0.85, 0.25, i / ringCount) + density * 0.15}
              >
                {animate && (
                  <>
                    <animate
                      attributeName="r"
                      values={`${r * 0.5};${r};${r * 0.5}`}
                      dur={`${3 + idx * 0.5}s`}
                      begin={`${(i / ringCount) * 1.5}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="stroke-opacity"
                      values={`0.1;${lerp(0.85, 0.3, i / ringCount)};0.1`}
                      dur={`${3 + idx * 0.5}s`}
                      begin={`${(i / ringCount) * 1.5}s`}
                      repeatCount="indefinite"
                    />
                  </>
                )}
              </circle>
            )
          })}
        </g>
      ))}

      {/* Ripple centers — solid filled dots with drop shadow */}
      <g filter={`url(#${fid.drop})`}>
        {centers.map((c, idx) => (
          <g key={idx}>
            <circle cx={c.x} cy={c.y} r={lerp(3, 6, g)} fill={`url(#emp-core-${seed})`} />
            <circle
              cx={c.x - 1}
              cy={c.y - 1}
              r={lerp(1, 2, g)}
              fill="white"
              opacity="0.5"
            />
          </g>
        ))}
      </g>
    </svg>
  )
}
