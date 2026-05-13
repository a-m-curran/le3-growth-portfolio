'use client'

import type { ArchetypeProps } from '../shared'
import { clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'
import { CelebrationGlow, CelebrationSparkles } from '../CelebrationLayer'

/**
 * Empathy — two figures, one with an arm around the other.
 *
 * Why: empathy at its most legible is the moment one person shows
 * up for another with their body — the side-hug, the hand on the
 * shoulder, the lean-in. We render two front-facing silhouettes with
 * the right figure's arm extended around the left figure's shoulders.
 * Heart appears above them as the gesture lands.
 *
 * Composition stages (continuous):
 *   g 0.00–0.20  two figures standing apart
 *   g 0.20–0.50  closer; right figure starts reaching
 *   g 0.50–0.80  arm rests on the other's shoulder; warm glow
 *                begins connecting them
 *   g 0.80–1.00  heart appears above; full embrace; bright aura
 *
 * Depth: each figure has a vertical body gradient (highlight up top,
 * shadow at base); arm has its own drop shadow as a layer in front
 * of the second figure; ground gets a unifying cast shadow; heart
 * is form-modeled with a radial gradient.
 */
export function EmpathyVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  // Two figures — slightly converge as growth increases
  const baseY = 138
  const figW = 26
  const apart = lerp(28, 8, g) // gap between figure centers at base
  const leftX = 80 - apart - 1
  const rightX = 80 + apart + 1

  // Figure heights — roughly equal
  const figH = 60

  // Arm reach — extends from right figure's right shoulder around
  // the left figure's shoulders
  const armReach = fadeIn(g, 0.2, 0.65)

  // Heart visibility
  const heartOpacity = fadeIn(g, 0.55, 0.85)
  const heartGlow = fadeIn(g, 0.85, 1)
  const heartSize = lerp(7, 13, fadeIn(g, 0.55, 0.95))

  // Warm aura between them
  const auraOpacity = fadeIn(g, 0.4, 0.85)

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`emp-figL-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
        <linearGradient id={`emp-figR-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.accent} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
        <radialGradient id={`emp-aura-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.55" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`emp-heart-${seed}`} cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.85" />
          <stop offset="40%" stopColor={palette.accent} stopOpacity="0.98" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.85" />
        </radialGradient>
      </defs>

      {/* Peak-glow halo */}
      <CelebrationGlow growth={growth} palette={palette} seed={seed} />

      {/* Ground shadow — single shared shadow */}
      <ellipse cx="80" cy={baseY + 5} rx={lerp(36, 50, g)} ry="5" fill={`url(#${fid.ground})`} />

      {/* Warm aura between them — appears as connection forms */}
      {auraOpacity > 0.01 && (
        <ellipse
          cx="80"
          cy={baseY - figH * 0.5}
          rx={lerp(28, 42, g)}
          ry={lerp(20, 30, g)}
          fill={`url(#emp-aura-${seed})`}
          opacity={auraOpacity}
        />
      )}

      {/* Left figure (them) */}
      <g filter={`url(#${fid.drop})`}>
        <FrontFigure cx={leftX} baseY={baseY} h={figH} w={figW} fill={`url(#emp-figL-${seed})`} />
      </g>

      {/* Right figure (you) */}
      <g filter={`url(#${fid.drop})`}>
        <FrontFigure cx={rightX} baseY={baseY} h={figH} w={figW} fill={`url(#emp-figR-${seed})`} />
      </g>

      {/* The arm wrapping over the left figure's shoulders — drawn
          as a thick curve from right figure's shoulder to left
          figure's far shoulder. Renders in front of the left figure. */}
      {armReach > 0.01 && (
        <g filter={`url(#${fid.drop})`} opacity={armReach}>
          {/* Arm sleeve — same color as the right figure */}
          <path
            d={`
              M ${rightX - figW * 0.35} ${baseY - figH * 0.65}
              Q ${(leftX + rightX) / 2} ${baseY - figH * 0.85 - lerp(2, 6, g)},
                ${leftX - figW * 0.4} ${baseY - figH * 0.6}
            `}
            stroke={`url(#emp-figR-${seed})`}
            strokeWidth={lerp(4, 6.5, g)}
            fill="none"
            strokeLinecap="round"
          />
          {/* Hand resting on left figure's shoulder */}
          <circle
            cx={leftX - figW * 0.4}
            cy={baseY - figH * 0.6}
            r={lerp(2.5, 4, g)}
            fill={palette.accent}
          />
        </g>
      )}

      {/* Heart above them */}
      {heartOpacity > 0.01 && (
        <g
          opacity={heartOpacity}
          filter={heartGlow > 0.1 ? `url(#${fid.glow})` : `url(#${fid.drop})`}
          style={{ transformOrigin: `80px ${baseY - figH - 6}px` }}
        >
          {animate && (
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1;1.12;1"
              dur="1.4s"
              additive="sum"
              repeatCount="indefinite"
            />
          )}
          <Heart cx={80} cy={baseY - figH - 6} size={heartSize} fill={`url(#emp-heart-${seed})`} />
          <circle
            cx={80 - heartSize * 0.25}
            cy={baseY - figH - 6 - heartSize * 0.3}
            r={heartSize * 0.18}
            fill="white"
            opacity="0.7"
          />
        </g>
      )}

      {/* Radiating heartbeat arcs at full bloom */}
      {heartGlow > 0.1 && (
        <g
          opacity={heartGlow * 0.7}
          stroke={palette.accent}
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        >
          {[0, 1, 2].map((i) => {
            const r = heartSize + 5 + i * 4
            return (
              <path
                key={i}
                d={`M ${80 - r} ${baseY - figH - 6} Q 80 ${baseY - figH - 6 - r}, ${80 + r} ${baseY - figH - 6}`}
                opacity={0.5 - i * 0.13}
              />
            )
          })}
        </g>
      )}

      {/* Celebration sparkles around the embrace at peak */}
      <CelebrationSparkles
        growth={growth}
        density={density}
        palette={palette}
        seed={seed}
        animate={animate}
        innerExclude={50}
      />
    </svg>
  )
}

/** Simple front-facing figure — circle head + tapered body. */
function FrontFigure({
  cx,
  baseY,
  h,
  w,
  fill,
}: {
  cx: number
  baseY: number
  h: number
  w: number
  fill: string
}) {
  const headR = w * 0.32
  const headCy = baseY - h + headR
  const bodyTop = headCy + headR - 1
  return (
    <g>
      {/* Body */}
      <path
        d={`
          M ${cx - w / 2} ${baseY}
          Q ${cx - w / 2} ${bodyTop + 4} ${cx - w / 2 + 4} ${bodyTop + 2}
          L ${cx - 5} ${bodyTop}
          L ${cx + 5} ${bodyTop}
          L ${cx + w / 2 - 4} ${bodyTop + 2}
          Q ${cx + w / 2} ${bodyTop + 4} ${cx + w / 2} ${baseY}
          Z
        `}
        fill={fill}
      />
      {/* Head */}
      <circle cx={cx} cy={headCy} r={headR} fill={fill} />
      {/* Top-of-head highlight */}
      <ellipse cx={cx - headR * 0.3} cy={headCy - headR * 0.5} rx={headR * 0.35} ry={headR * 0.25} fill="white" opacity="0.4" />
    </g>
  )
}

/** Heart shape. */
function Heart({ cx, cy, size, fill }: { cx: number; cy: number; size: number; fill: string }) {
  return (
    <path
      d={`
        M ${cx} ${cy + size * 0.55}
        C ${cx} ${cy + size * 0.2} ${cx - size * 0.9} ${cy - size * 0.05} ${cx - size * 0.55} ${cy - size * 0.4}
        C ${cx - size * 0.3} ${cy - size * 0.7} ${cx - size * 0.05} ${cy - size * 0.55} ${cx} ${cy - size * 0.25}
        C ${cx + size * 0.05} ${cy - size * 0.55} ${cx + size * 0.3} ${cy - size * 0.7} ${cx + size * 0.55} ${cy - size * 0.4}
        C ${cx + size * 0.9} ${cy - size * 0.05} ${cx} ${cy + size * 0.2} ${cx} ${cy + size * 0.55}
        Z
      `}
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
