'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Relationship Building — intertwined climbing vines.
 *
 * Why: relationships are sustained growth that climbs together. Two
 * vines wind around each other, gaining height together — neither
 * grows alone. Leaves emerge from each as the relationship deepens.
 *
 * Depth: each vine has its own bark gradient; drop shadows give the
 * twist real Z-order (front vine occludes back vine at crossings);
 * leaves drop-shadow forward; ground gets a cast shadow at the base.
 */
export function RelationshipBuildingVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const baseY = 142
  const cx = 80
  const climbH = lerp(40, 100, g)
  const twistAmp = 10
  // Number of full twists scales with growth
  const twists = Math.max(2, Math.round(lerp(2, 4, g)))

  // Sample points along each vine. Vines mirror each other around
  // the center axis, twisting in sinusoidal opposition.
  const steps = 30
  const samples = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const y = baseY - climbH * t
    const phase = t * twists * Math.PI
    const offsetA = Math.sin(phase) * twistAmp
    const offsetB = -offsetA
    return { y, t, a: cx + offsetA, b: cx + offsetB }
  })

  // Leaf positions — emerge at sample points where the vine is at
  // its outermost (sin = ±1 → twist peaks)
  const leafCount = Math.floor(lerp(2, 8, g)) + Math.floor(density * 2)
  const leaves = Array.from({ length: leafCount }, (_, i) => {
    const t = (i + 1) / (leafCount + 1)
    const phase = t * twists * Math.PI
    const onA = Math.sin(phase) > 0
    const sign = onA ? 1 : -1
    const y = baseY - climbH * t
    const x = cx + Math.sin(phase) * twistAmp + sign * 4
    return { x, y, side: sign, size: lerp(2.5, 4, rand()) }
  })

  // Build each vine path
  const vineAPath = samples.map((s, i) => `${i === 0 ? 'M' : 'L'} ${s.a} ${s.y}`).join(' ')
  const vineBPath = samples.map((s, i) => `${i === 0 ? 'M' : 'L'} ${s.b} ${s.y}`).join(' ')

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`rb-vineA-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.mid} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`rb-vineB-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx={cx} cy={baseY + 4} rx="22" ry="5" fill={`url(#${fid.ground})`} />

      {/* Vines — draw alternating segments so they appear to weave.
          A is "behind" on first half-twist, "front" on next. We
          fake this by drawing both, then over-drawing front-segments
          in their natural color. */}
      <g filter={`url(#${fid.drop})`}>
        {/* Both vines, full length */}
        <path d={vineAPath} stroke={`url(#rb-vineA-${seed})`} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d={vineBPath} stroke={`url(#rb-vineB-${seed})`} strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>

      {/* Highlight strokes for depth */}
      <path
        d={vineAPath}
        stroke="white"
        strokeOpacity="0.3"
        strokeWidth="0.7"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={vineBPath}
        stroke="white"
        strokeOpacity="0.3"
        strokeWidth="0.7"
        fill="none"
        strokeLinecap="round"
      />

      {/* Leaves */}
      <g filter={`url(#${fid.drop})`}>
        {leaves.map((l, i) => (
          <ellipse
            key={i}
            cx={l.x}
            cy={l.y}
            rx={l.size}
            ry={l.size * 0.5}
            fill={i % 2 === 0 ? palette.accent : palette.mid}
            transform={`rotate(${l.side * 35} ${l.x} ${l.y})`}
          />
        ))}
      </g>

      {/* Top buds — paired flowers at the peak when grown */}
      {g > 0.4 && (
        <g filter={`url(#${fid.drop})`}>
          <circle cx={samples[samples.length - 1].a} cy={samples[samples.length - 1].y - 2} r={lerp(2, 3.5, g)} fill={palette.accent} />
          <circle cx={samples[samples.length - 1].b} cy={samples[samples.length - 1].y - 2} r={lerp(2, 3.5, g)} fill={palette.mid} />
        </g>
      )}

      {/* Gentle sway of the upper half */}
      {animate && (
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`-0.8 ${cx} ${baseY};0.8 ${cx} ${baseY};-0.8 ${cx} ${baseY}`}
            dur="7s"
            repeatCount="indefinite"
          />
        </g>
      )}
    </svg>
  )
}
