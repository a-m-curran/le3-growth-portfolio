'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Initiative — a flame.
 *
 * Why: initiative is the spark that didn't have to happen. A small
 * ember at low confidence becomes a steady-burning flame at mid,
 * roars and throws sparks at high. It's a single thing, getting more
 * itself.
 *
 * Depth: flame shapes use vertical gradients (hot core → cool edge),
 * outer glow filter so the flame "radiates," sparks have their own
 * micro-glow, ground gets a warm reflected-light gradient (not just
 * a shadow — flame casts light, not shadow).
 *
 * Animation: flame flickers via animateTransform scaleY + slight
 * x-wobble; sparks rise and fade independently.
 */
export function InitiativeVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const flameH = lerp(20, 75, g)
  const flameW = lerp(10, 22, g)
  const cx = 80
  const baseY = 138

  const sparkCount = Math.floor(density * 6)
  const sparks = Array.from({ length: sparkCount }, () => ({
    x: cx + (rand() - 0.5) * flameW * 1.4,
    yOffset: rand() * flameH,
    delay: rand() * 2,
    size: lerp(0.8, 1.8, rand()),
  }))

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <radialGradient id={`init-flame-${seed}`} cx="50%" cy="80%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
          <stop offset="30%" stopColor={palette.accent} stopOpacity="0.98" />
          <stop offset="80%" stopColor={palette.mid} stopOpacity="0.85" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.55" />
        </radialGradient>
        <radialGradient id={`init-base-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.9" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.5" />
        </radialGradient>
        <radialGradient id={`init-light-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Warm ground light (flame's reflection, not a shadow) */}
      <ellipse cx={cx} cy={baseY + 5} rx={flameW * 2.2} ry="8" fill={`url(#init-light-${seed})`} />

      {/* Outer flame halo */}
      <g filter={`url(#${fid.glow})`}>
        <ellipse
          cx={cx}
          cy={baseY - flameH * 0.5}
          rx={flameW * 1.4}
          ry={flameH * 0.55}
          fill={palette.accent}
          opacity="0.32"
        />
      </g>

      {/* Main flame body — teardrop shape, flickers */}
      <g style={{ transformOrigin: `${cx}px ${baseY}px` }}>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1.04 0.96;0.97 1.05;1 1"
            dur="0.7s"
            additive="sum"
            repeatCount="indefinite"
          />
        )}
        <path
          d={`
            M ${cx} ${baseY}
            C ${cx - flameW} ${baseY - flameH * 0.3} ${cx - flameW * 0.8} ${baseY - flameH * 0.7} ${cx - flameW * 0.2} ${baseY - flameH}
            C ${cx - flameW * 0.05} ${baseY - flameH * 1.02} ${cx + flameW * 0.1} ${baseY - flameH * 1.02} ${cx + flameW * 0.3} ${baseY - flameH}
            C ${cx + flameW * 0.9} ${baseY - flameH * 0.7} ${cx + flameW} ${baseY - flameH * 0.3} ${cx} ${baseY}
            Z
          `}
          fill={`url(#init-flame-${seed})`}
        />

        {/* Inner hot core */}
        <ellipse
          cx={cx}
          cy={baseY - flameH * 0.55}
          rx={flameW * 0.4}
          ry={flameH * 0.35}
          fill="white"
          opacity="0.55"
        />
      </g>

      {/* Ember base */}
      <g filter={`url(#${fid.glow})`}>
        <ellipse cx={cx} cy={baseY} rx={flameW * 0.6} ry="3" fill={`url(#init-base-${seed})`} />
      </g>

      {/* Rising sparks */}
      {sparks.map((s, i) => (
        <g key={i} filter={`url(#${fid.glow})`}>
          <circle cx={s.x} cy={baseY - s.yOffset} r={s.size} fill={palette.accent}>
            {animate && (
              <>
                <animate
                  attributeName="cy"
                  values={`${baseY - s.yOffset};${baseY - flameH - 20}`}
                  dur="2.4s"
                  begin={`${s.delay}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="1;0"
                  dur="2.4s"
                  begin={`${s.delay}s`}
                  repeatCount="indefinite"
                />
              </>
            )}
          </circle>
        </g>
      ))}
    </svg>
  )
}
