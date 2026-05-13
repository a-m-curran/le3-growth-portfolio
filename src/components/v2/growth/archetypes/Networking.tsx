'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Networking — an expanding web.
 *
 * Why: networking is hub-and-spoke. Every connection extends from
 * you, and the web grows outward over time. Distinct from
 * collaboration (which is rhizomatic / underground) — this is
 * intentional outward reach.
 *
 * Depth: hub has drop-shadowed solid form (you're the anchor); spoke
 * lines fade with distance (deeper into the web = lower opacity);
 * outer nodes glow softly; whole structure rotates slowly so you see
 * it as 3D, not a flat star.
 */
export function NetworkingVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const cx = 80
  const cy = 85

  // Two orbits — inner ring at all confidence, outer appears with
  // growth. Spoke count scales with density.
  const innerCount = Math.max(4, Math.round(lerp(4, 7, density)))
  const outerCount = Math.max(0, Math.round(lerp(0, 7, g)))

  const innerR = lerp(22, 30, g)
  const outerR = lerp(40, 55, g)

  const inner = Array.from({ length: innerCount }, (_, i) => {
    const angle = (i / innerCount) * Math.PI * 2 + rand() * 0.2
    return {
      x: cx + Math.cos(angle) * innerR,
      y: cy + Math.sin(angle) * innerR,
    }
  })
  const outer = Array.from({ length: outerCount }, (_, i) => {
    const angle = (i / Math.max(outerCount, 1)) * Math.PI * 2 + rand() * 0.3
    return {
      x: cx + Math.cos(angle) * outerR,
      y: cy + Math.sin(angle) * outerR,
    }
  })

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <radialGradient id={`net-hub-${seed}`} cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
          <stop offset="40%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.9" />
        </radialGradient>
        <radialGradient id={`net-node-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.7" />
        </radialGradient>
      </defs>

      {/* Slow rotating group — gives 3D-ness to the spokes */}
      <g style={{ transformOrigin: `${cx}px ${cy}px` }}>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${cx} ${cy}`}
            to={`360 ${cx} ${cy}`}
            dur="42s"
            repeatCount="indefinite"
          />
        )}

        {/* Outer spokes (back) */}
        <g stroke={palette.mid} strokeWidth="0.7" opacity="0.45">
          {outer.map((n, i) => (
            <line key={i} x1={cx} y1={cy} x2={n.x} y2={n.y} />
          ))}
        </g>

        {/* Inner spokes */}
        <g stroke={palette.dark} strokeWidth="1" opacity="0.7">
          {inner.map((n, i) => (
            <line key={i} x1={cx} y1={cy} x2={n.x} y2={n.y} />
          ))}
        </g>

        {/* Connecting arcs between adjacent inner nodes (the web) */}
        <g stroke={palette.mid} strokeWidth="0.6" fill="none" opacity="0.5">
          {inner.map((n, i) => {
            const next = inner[(i + 1) % inner.length]
            return (
              <line key={i} x1={n.x} y1={n.y} x2={next.x} y2={next.y} />
            )
          })}
        </g>

        {/* Outer nodes — dim, distant */}
        <g filter={`url(#${fid.glow})`}>
          {outer.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r="2.2" fill={palette.mid} opacity="0.85" />
          ))}
        </g>

        {/* Inner nodes — solid, depth */}
        <g filter={`url(#${fid.drop})`}>
          {inner.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r="3" fill={`url(#net-node-${seed})`} />
          ))}
        </g>
      </g>

      {/* Hub — front-and-center, doesn't rotate so the "you" stays
          stable while the web turns around */}
      <g filter={`url(#${fid.drop})`}>
        <circle cx={cx} cy={cy} r={lerp(5, 7, g)} fill={`url(#net-hub-${seed})`} />
        <circle cx={cx - 1.5} cy={cy - 1.5} r="1.6" fill="white" opacity="0.6" />
      </g>
    </svg>
  )
}
