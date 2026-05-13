'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Curiosity — a constellation being mapped.
 *
 * Why: curiosity is the act of noticing points worth connecting.
 * Stars exist whether you look or not — what changes with growth is
 * how many you've noticed and how many connections you've drawn
 * between them. A few twinkling points become a recognized pattern.
 *
 * Depth: stars glow (no drop shadow — they emit light); connection
 * lines fade into deeper space behind them; a hint of dark "sky"
 * gradient on the canvas to read as depth, not as flat plane.
 *
 * Animation: each star twinkles on its own offset; connection lines
 * draw in on a dasharray cycle.
 */
export function CuriosityVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  // Star positions — fixed per seed, but only some are "lit"
  const totalStars = 12
  const allStars = Array.from({ length: totalStars }, () => ({
    x: 20 + rand() * 120,
    y: 25 + rand() * 105,
    size: lerp(1.3, 2.8, rand()),
    twinkleOffset: rand() * 4,
  }))
  // Lit stars scale with growth
  const litCount = Math.max(3, Math.round(lerp(3, totalStars, g)))
  const lit = allStars.slice(0, litCount)

  // Connections between lit stars — pairs adjacent in array order
  const connectionCount = Math.floor(lerp(0, lit.length - 1, g + density * 0.3))
  const connections: Array<{ a: typeof lit[0]; b: typeof lit[0] }> = []
  for (let i = 0; i < connectionCount && i < lit.length - 1; i++) {
    connections.push({ a: lit[i], b: lit[i + 1] })
  }

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <radialGradient id={`cur-bg-${seed}`} cx="50%" cy="40%" r="80%">
          <stop offset="0%" stopColor={palette.dark} stopOpacity="0.12" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`cur-star-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="40%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft "deep space" backing — depth via background gradient */}
      <rect x="0" y="0" width="160" height="160" fill={`url(#cur-bg-${seed})`} />

      {/* Connection lines — fade in, animated dasharray */}
      <g stroke={palette.mid} strokeWidth="0.85" fill="none" strokeLinecap="round">
        {connections.map((c, i) => (
          <line
            key={i}
            x1={c.a.x}
            y1={c.a.y}
            x2={c.b.x}
            y2={c.b.y}
            opacity={lerp(0.45, 0.75, g)}
          >
            {animate && (
              <animate
                attributeName="stroke-dasharray"
                values="0 100;30 100;0 100"
                dur={`${2.5 + i * 0.3}s`}
                repeatCount="indefinite"
              />
            )}
          </line>
        ))}
      </g>

      {/* Unlit / dim stars (the unfound ones, drawn small + dim) */}
      <g>
        {allStars.slice(litCount).map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.size * 0.5}
            fill={palette.mid}
            opacity="0.18"
          />
        ))}
      </g>

      {/* Lit stars — glowing */}
      <g filter={`url(#${fid.glow})`}>
        {lit.map((s, i) => (
          <g key={i}>
            <circle cx={s.x} cy={s.y} r={s.size * 2.4} fill={`url(#cur-star-${seed})`} />
            <circle cx={s.x} cy={s.y} r={s.size} fill="white">
              {animate && (
                <animate
                  attributeName="opacity"
                  values="1;0.55;1"
                  dur={`${1.6 + s.twinkleOffset * 0.4}s`}
                  begin={`${s.twinkleOffset}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
            {/* Star sparkle cross */}
            <g stroke="white" strokeWidth="0.6" strokeLinecap="round" opacity="0.8">
              <line x1={s.x - s.size * 2} y1={s.y} x2={s.x + s.size * 2} y2={s.y} />
              <line x1={s.x} y1={s.y - s.size * 2} x2={s.x} y2={s.y + s.size * 2} />
            </g>
          </g>
        ))}
      </g>
    </svg>
  )
}
