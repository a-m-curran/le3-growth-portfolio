'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'
import { CelebrationGlow, CelebrationSparkles } from '../CelebrationLayer'

/**
 * Adaptability — bamboo bending in the wind.
 *
 * Why: bamboo is the canonical symbol of adaptability — strong but
 * flexible, segmented and articulated, hollow yet unbreakable. Each
 * stalk bends without snapping. The cluster grows fuller over time.
 *
 * Composition stages (continuous):
 *   g 0.00–0.25  one or two short stalks
 *   g 0.25–0.60  taller stalks with visible segments
 *   g 0.60–0.85  multiple stalks, full segmentation, leaf clusters
 *   g 0.85–1.00  dense grove with leaves at multiple heights
 *
 * Depth: each stalk has a vertical highlight on its light side;
 * segment joints get dark accent rings; leaves drop-shadow forward
 * of the stalks; ground has cast shadow.
 */
export function AdaptabilityVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const baseY = 142
  // More stalks at peak so the bamboo grove looks lush, not sparse
  const stalkCount = Math.max(1, Math.round(lerp(1, 7, g))) + Math.floor(density * 2)

  // Generate stalks — each at a different x, height, bend, segments
  const stalks = Array.from({ length: stalkCount }, (_, i) => {
    const x = 30 + (i / Math.max(stalkCount - 1, 1)) * 100 + (rand() - 0.5) * 8
    // Taller stalks at peak — the grove reaches upward
    const height = lerp(50, 105, rand()) * lerp(0.35, 1, g)
    const bend = (rand() - 0.5) * 14 + 4 // slight rightward bias
    const segCount = Math.max(2, Math.floor(height / 15))
    const phase = rand() * 2
    const leafSide = i % 2 === 0 ? -1 : 1
    return { x, height, bend, segCount, phase, leafSide, idx: i }
  })

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`ada-stalk-${seed}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={palette.mid} />
          <stop offset="50%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
        <radialGradient id={`ada-leaf-${seed}`} cx="40%" cy="40%" r="65%">
          <stop offset="0%" stopColor={palette.accent} />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.95" />
        </radialGradient>
      </defs>

      {/* Peak-glow halo */}
      <CelebrationGlow growth={growth} palette={palette} seed={seed} />

      {/* Ground shadow */}
      <ellipse cx="80" cy={baseY + 4} rx="60" ry="6" fill={`url(#${fid.ground})`} />

      {stalks.map((s) => {
        const tipX = s.x + s.bend
        const tipY = baseY - s.height
        const ctrlX = s.x + s.bend * 0.4
        const ctrlY = baseY - s.height * 0.55
        return (
          <g key={s.idx} filter={`url(#${fid.drop})`}>
            <g style={{ transformOrigin: `${s.x}px ${baseY}px` }}>
              {animate && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values={`-2.5 ${s.x} ${baseY};2.5 ${s.x} ${baseY};-2.5 ${s.x} ${baseY}`}
                  dur={`${3.5 + s.phase * 0.4}s`}
                  begin={`${s.phase}s`}
                  repeatCount="indefinite"
                />
              )}

              {/* Bamboo stalk — thicker than grass, with segment joints */}
              <path
                d={`M ${s.x} ${baseY} Q ${ctrlX} ${ctrlY}, ${tipX} ${tipY}`}
                stroke={`url(#ada-stalk-${seed})`}
                strokeWidth={lerp(3, 4.5, g)}
                fill="none"
                strokeLinecap="round"
              />

              {/* Segment joints — dark rings at intervals along the stalk */}
              {Array.from({ length: s.segCount }, (_, j) => {
                const t = (j + 1) / (s.segCount + 1)
                // Cubic Bezier sampling for the joint position on
                // the curve (close enough using a quadratic Bezier
                // formula for x and y at parameter t)
                const jx = (1 - t) * (1 - t) * s.x + 2 * (1 - t) * t * ctrlX + t * t * tipX
                const jy = (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * ctrlY + t * t * tipY
                return (
                  <ellipse
                    key={j}
                    cx={jx}
                    cy={jy}
                    rx={lerp(2, 3, g)}
                    ry="0.9"
                    fill={palette.dark}
                    opacity="0.8"
                  />
                )
              })}

              {/* Light edge highlight — bamboo's characteristic shine */}
              <path
                d={`M ${s.x - 1} ${baseY - 4} Q ${ctrlX - 0.5} ${ctrlY}, ${tipX - 0.5} ${tipY + 2}`}
                stroke="white"
                strokeOpacity="0.35"
                strokeWidth="0.8"
                fill="none"
              />

              {/* Leaf cluster at the top */}
              <g transform={`translate(${tipX}, ${tipY})`}>
                <BambooLeaf
                  x={s.leafSide * 4}
                  y={-1}
                  rot={s.leafSide * 35}
                  size={lerp(5, 8, g)}
                  fill={`url(#ada-leaf-${seed})`}
                />
                <BambooLeaf
                  x={-s.leafSide * 3}
                  y={-4}
                  rot={-s.leafSide * 20}
                  size={lerp(4, 7, g)}
                  fill={`url(#ada-leaf-${seed})`}
                />
                {g > 0.5 && (
                  <BambooLeaf
                    x={0}
                    y={-6}
                    rot={s.leafSide * 5}
                    size={lerp(4, 6, g)}
                    fill={`url(#ada-leaf-${seed})`}
                  />
                )}
              </g>
            </g>
          </g>
        )
      })}

      {/* Celebration sparkles drifting through the grove at peak */}
      <CelebrationSparkles
        growth={growth}
        density={density}
        palette={palette}
        seed={seed}
        animate={animate}
        innerExclude={30}
      />
    </svg>
  )
}

function BambooLeaf({
  x,
  y,
  rot,
  size,
  fill,
}: {
  x: number
  y: number
  rot: number
  size: number
  fill: string
}) {
  // Narrow pointed bamboo leaf — almond shape
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      <path
        d={`M ${x} ${y} Q ${x + size * 0.4} ${y - size * 0.4}, ${x + size * 1.6} ${y - size * 1.2} Q ${x + size * 0.4} ${y - size * 0.6}, ${x} ${y} Z`}
        fill={fill}
      />
      {/* Midrib */}
      <line
        x1={x}
        y1={y}
        x2={x + size * 1.5}
        y2={y - size * 1.1}
        stroke="white"
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
    </g>
  )
}
