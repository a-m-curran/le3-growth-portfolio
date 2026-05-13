'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'
import { CelebrationGlow, CelebrationSparkles } from '../CelebrationLayer'

/**
 * Communication — a megaphone broadcasting outward.
 *
 * Why: the megaphone is the universal icon for "I have something to
 * say and I want it heard." We render a megaphone angled up-right,
 * with concentric sound-wave arcs emanating from its mouth and small
 * symbols ("words being broadcast") flying along the wave fronts.
 *
 * Composition stages (continuous):
 *   g 0.00–0.20  megaphone alone, no sound coming out yet
 *   g 0.20–0.50  one sound wave; one or two flying symbols
 *   g 0.50–0.80  multiple wave arcs; rich symbol stream
 *   g 0.80–1.00  full broadcast — waves reach the canvas edge,
 *                many symbols traveling, celebration sparkles
 *
 * Depth: megaphone body has a metallic gradient (light on the upper
 * edge, dark underside); waves layer in front-to-back order with
 * decreasing opacity; flying symbols drop-shadow forward.
 */
export function CommunicationVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  // Megaphone geometry — anchored in lower-left, pointed up-right
  // Mouth (the wide end) is at (mouthX, mouthY), grip (narrow end)
  // is below-and-left.
  const mouthX = 95
  const mouthY = 65
  const gripX = 50
  const gripY = 110
  // Mouth circle (outer rim)
  const mouthR = 22
  // Inner depth circle (the dark "inside the cone" look)
  const innerR = 14

  // Sound wave count + reach
  const waveCount = Math.max(0, Math.round(lerp(0, 4, fadeIn(g, 0.2, 0.95))))

  // Flying symbols — small dots that travel outward along the wave
  // axis at the mouth direction
  const symbolCount = Math.floor(density * 4) + (g > 0.5 ? 2 : 0) + (g > 0.85 ? 2 : 0)
  // Direction from grip to mouth (the broadcast direction)
  const dx = mouthX - gripX
  const dy = mouthY - gripY
  const dirLen = Math.hypot(dx, dy)
  const dirX = dx / dirLen
  const dirY = dy / dirLen

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`com-body-${seed}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="40%" stopColor={palette.accent} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
        <linearGradient id={`com-inside-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.dark} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`com-grip-${seed}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#4b5563" />
          <stop offset="50%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#4b5563" />
        </linearGradient>
        <radialGradient id={`com-symbol-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="50%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Peak-glow halo */}
      <CelebrationGlow growth={growth} palette={palette} seed={seed} />

      {/* Ground shadow */}
      <ellipse cx="80" cy="145" rx="50" ry="5" fill={`url(#${fid.ground})`} />

      {/* Sound wave arcs — drawn from far → near so foreground waves
          sit on top. Each is a partial ring centered at the mouth,
          arcing outward in the broadcast direction. */}
      {Array.from({ length: waveCount }, (_, i) => {
        const rIndex = waveCount - 1 - i // outermost first
        const r = mouthR + 10 + rIndex * 12
        // Visibility of this wave — only fully visible when growth
        // has progressed enough
        const waveVisible = fadeIn(g, 0.2 + rIndex * 0.18, 0.4 + rIndex * 0.18)
        if (waveVisible < 0.05) return null
        // Arc spans about 100 degrees centered on the broadcast direction
        const dirAngle = Math.atan2(dirY, dirX)
        const startAngle = dirAngle - (50 * Math.PI) / 180
        const endAngle = dirAngle + (50 * Math.PI) / 180
        const x1 = mouthX + Math.cos(startAngle) * r
        const y1 = mouthY + Math.sin(startAngle) * r
        const x2 = mouthX + Math.cos(endAngle) * r
        const y2 = mouthY + Math.sin(endAngle) * r
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
            stroke={palette.accent}
            strokeWidth={lerp(2.4, 1.4, rIndex / Math.max(waveCount - 1, 1))}
            fill="none"
            strokeLinecap="round"
            opacity={lerp(0.95, 0.4, rIndex / Math.max(waveCount, 1)) * waveVisible}
          >
            {animate && (
              <animate
                attributeName="opacity"
                values={`${0.3 * waveVisible};${lerp(0.95, 0.4, rIndex / Math.max(waveCount, 1)) * waveVisible};${0.3 * waveVisible}`}
                dur="1.6s"
                begin={`${rIndex * 0.25}s`}
                repeatCount="indefinite"
              />
            )}
          </path>
        )
      })}

      {/* Megaphone body */}
      <g filter={`url(#${fid.drop})`}>
        {/* Cone shape — from grip-end to mouth-end. The cone is a
            trapezoid rotated along the broadcast direction. */}
        <ConeShape
          gripX={gripX}
          gripY={gripY}
          mouthX={mouthX}
          mouthY={mouthY}
          gripR={6}
          mouthR={mouthR}
          fill={`url(#com-body-${seed})`}
        />

        {/* Mouth rim — the wide oval at the front */}
        <ellipse
          cx={mouthX}
          cy={mouthY}
          rx={mouthR}
          ry={mouthR * 0.55}
          fill={`url(#com-body-${seed})`}
          transform={`rotate(${(Math.atan2(dirY, dirX) * 180) / Math.PI - 90} ${mouthX} ${mouthY})`}
        />
        {/* Inside the cone — dark depth */}
        <ellipse
          cx={mouthX}
          cy={mouthY}
          rx={innerR}
          ry={innerR * 0.55}
          fill={`url(#com-inside-${seed})`}
          transform={`rotate(${(Math.atan2(dirY, dirX) * 180) / Math.PI - 90} ${mouthX} ${mouthY})`}
        />

        {/* Highlight strip along the upper edge of the cone */}
        <line
          x1={gripX + dirX * 6}
          y1={gripY + dirY * 6 - 4}
          x2={mouthX + Math.cos(Math.atan2(dirY, dirX) + Math.PI / 2) * mouthR * 0.45}
          y2={mouthY + Math.sin(Math.atan2(dirY, dirX) + Math.PI / 2) * mouthR * 0.45}
          stroke="white"
          strokeOpacity="0.35"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* Grip / handle — small cylinder behind the cone */}
        <rect
          x={gripX - 4}
          y={gripY - 2}
          width="10"
          height="14"
          rx="1.5"
          fill={`url(#com-grip-${seed})`}
          transform={`rotate(${(Math.atan2(dirY, dirX) * 180) / Math.PI + 90} ${gripX + 1} ${gripY + 5})`}
        />
      </g>

      {/* Flying symbols — small bright dots/circles riding along the
          broadcast direction, fading as they reach the edge */}
      {symbolCount > 0 && (
        <g filter={`url(#${fid.glow})`}>
          {Array.from({ length: symbolCount }, (_, i) => {
            const delay = i * 0.45 + rand() * 0.5
            const lateralOffset = (rand() - 0.5) * 24
            // Start point: just outside the mouth
            const startX = mouthX + dirX * 8
            const startY = mouthY + dirY * 8
            // End point: well past the canvas in the broadcast direction
            // (offset laterally so symbols fan out)
            const endX = mouthX + dirX * 90 + (-dirY) * lateralOffset
            const endY = mouthY + dirY * 90 + dirX * lateralOffset
            return (
              <circle key={i} r="2.4" fill={`url(#com-symbol-${seed})`}>
                {animate ? (
                  <>
                    <animate attributeName="cx" values={`${startX};${endX}`} dur="2s" begin={`${delay}s`} repeatCount="indefinite" />
                    <animate attributeName="cy" values={`${startY};${endY}`} dur="2s" begin={`${delay}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0;1;1;0" dur="2s" begin={`${delay}s`} repeatCount="indefinite" />
                  </>
                ) : (
                  <>
                    <set attributeName="cx" to={(startX + endX) / 2} />
                    <set attributeName="cy" to={(startY + endY) / 2} />
                    <set attributeName="opacity" to="0.85" />
                  </>
                )}
              </circle>
            )
          })}
        </g>
      )}

      {/* Celebration sparkles around the broadcast at peak */}
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

/**
 * Builds a tapered cone shape between two points: a narrow grip end
 * and a wide mouth end. Used for the megaphone body.
 */
function ConeShape({
  gripX,
  gripY,
  mouthX,
  mouthY,
  gripR,
  mouthR,
  fill,
}: {
  gripX: number
  gripY: number
  mouthX: number
  mouthY: number
  gripR: number
  mouthR: number
  fill: string
}) {
  // Direction & perpendicular
  const dx = mouthX - gripX
  const dy = mouthY - gripY
  const len = Math.hypot(dx, dy)
  const px = -dy / len
  const py = dx / len
  // Four corners of the trapezoid
  const g1x = gripX + px * gripR
  const g1y = gripY + py * gripR
  const g2x = gripX - px * gripR
  const g2y = gripY - py * gripR
  const m1x = mouthX + px * mouthR * 0.95
  const m1y = mouthY + py * mouthR * 0.95
  const m2x = mouthX - px * mouthR * 0.95
  const m2y = mouthY - py * mouthR * 0.95
  return (
    <path
      d={`M ${g1x} ${g1y} L ${m1x} ${m1y} L ${m2x} ${m2y} L ${g2x} ${g2y} Z`}
      fill={fill}
    />
  )
}

function fadeIn(g: number, start: number, end: number): number {
  if (g <= start) return 0
  if (g >= end) return 1
  const t = (g - start) / (end - start)
  return t * t * (3 - 2 * t)
}
