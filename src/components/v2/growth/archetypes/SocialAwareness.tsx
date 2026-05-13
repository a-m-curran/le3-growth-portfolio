'use client'

import type { ArchetypeProps } from '../shared'
import { clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'
import { CelebrationGlow, CelebrationSparkles } from '../CelebrationLayer'

/**
 * Social Awareness — you in a room, sensing what's around you.
 *
 * Why: social awareness is *peripheral perception* — picking up on
 * the mood of people nearby without them telling you. We render a
 * central figure (you) with surrounding figures whose emotional
 * states are visible as small colored auras around their heads. As
 * awareness grows, more surrounding figures become visible, their
 * auras brighten, and concentric "perception rings" pulse outward
 * from you.
 *
 * Distinct from Empathy (two figures, one heart between them) by
 * the *many* surrounding figures and the *attention flowing
 * outward* rather than inward.
 *
 * Composition stages (continuous):
 *   g 0.00–0.20  central figure alone
 *   g 0.20–0.50  first surrounding figures appear (faint)
 *   g 0.50–0.80  more figures + mood auras visible
 *   g 0.80–1.00  full ring of figures + perception rings emanating
 */
export function SocialAwarenessVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const cx = 80
  const centerY = 88

  // Surrounding figures — fixed positions in a rough circle. They
  // come into view as growth increases.
  const positions = [
    { x: 28, y: 60, mood: 'accent' as const },
    { x: 132, y: 65, mood: 'mid' as const },
    { x: 24, y: 110, mood: 'mid' as const },
    { x: 136, y: 115, mood: 'accent' as const },
    { x: 60, y: 38, mood: 'mid' as const },
    { x: 110, y: 42, mood: 'accent' as const },
  ]
  // Number of figures visible scales with growth
  const figuresVisible = Math.floor(lerp(0, positions.length, fadeIn(g, 0.15, 0.85)))

  // Perception rings — concentric pulsing rings from the center.
  // More rings at peak so awareness reads as truly expansive.
  const ringCount = Math.max(0, Math.floor(lerp(0, 5, fadeIn(g, 0.4, 0.95))))

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`sa-you-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.accent} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
        <linearGradient id={`sa-other-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
        <radialGradient id={`sa-aura-warm-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.7" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`sa-aura-cool-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.mid} stopOpacity="0.7" />
          <stop offset="100%" stopColor={palette.mid} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Peak-glow halo */}
      <CelebrationGlow growth={growth} palette={palette} seed={seed} />

      {/* Ground shadow under the whole scene */}
      <ellipse cx={cx} cy="145" rx="65" ry="6" fill={`url(#${fid.ground})`} />

      {/* Perception rings — concentric pulses out from center figure */}
      {Array.from({ length: ringCount }, (_, i) => {
        const baseR = 18 + i * 14
        return (
          <circle
            key={i}
            cx={cx}
            cy={centerY}
            r={baseR}
            fill="none"
            stroke={palette.accent}
            strokeWidth="1.2"
            opacity={0.45 - i * 0.1}
          >
            {animate && (
              <>
                <animate
                  attributeName="r"
                  values={`${baseR - 4};${baseR + 6};${baseR - 4}`}
                  dur="3s"
                  begin={`${i * 0.6}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.1;0.5;0.1"
                  dur="3s"
                  begin={`${i * 0.6}s`}
                  repeatCount="indefinite"
                />
              </>
            )}
          </circle>
        )
      })}

      {/* Surrounding figures — drawn back-first */}
      {positions.slice(0, figuresVisible).map((p, i) => {
        const auraColor = p.mood === 'accent' ? `url(#sa-aura-warm-${seed})` : `url(#sa-aura-cool-${seed})`
        const auraOpacity = density > 0.2 ? clamp01(density + 0.3) : 0.4
        return (
          <g key={i} opacity={fadeIn(g, 0.15 + i * 0.1, 0.4 + i * 0.1)}>
            {/* Mood aura */}
            <circle cx={p.x} cy={p.y - 2} r="12" fill={auraColor} opacity={auraOpacity} />
            {/* Small person — drop shadow + silhouette */}
            <g filter={`url(#${fid.drop})`}>
              <SmallPerson cx={p.x} cy={p.y} fill={`url(#sa-other-${seed})`} />
            </g>
          </g>
        )
      })}

      {/* Central figure — you */}
      <g filter={`url(#${fid.drop})`}>
        <CenterPerson cx={cx} cy={centerY} fill={`url(#sa-you-${seed})`} />
        {/* Subtle "alert" highlight on the central figure when grown */}
        {g > 0.3 && (
          <circle
            cx={cx + 3}
            cy={centerY - 14}
            r="1.5"
            fill="white"
            opacity={lerp(0.3, 0.85, g)}
          />
        )}
      </g>

      {/* Celebration sparkles surrounding the room at peak */}
      <CelebrationSparkles
        growth={growth}
        density={density}
        palette={palette}
        seed={seed}
        animate={animate}
        innerExclude={68}
      />
    </svg>
  )
}

/** Central "you" figure — head + shoulders, slightly bigger than others. */
function CenterPerson({ cx, cy, fill }: { cx: number; cy: number; fill: string }) {
  return (
    <g>
      {/* Head */}
      <circle cx={cx} cy={cy - 10} r="9" fill={fill} />
      {/* Shoulders / body */}
      <path
        d={`
          M ${cx - 14} ${cy + 16}
          Q ${cx - 14} ${cy + 6} ${cx - 7} ${cy + 2}
          L ${cx - 4} ${cy - 1}
          L ${cx + 4} ${cy - 1}
          L ${cx + 7} ${cy + 2}
          Q ${cx + 14} ${cy + 6} ${cx + 14} ${cy + 16}
          Z
        `}
        fill={fill}
      />
      {/* Highlight on top of head */}
      <ellipse cx={cx - 3} cy={cy - 14} rx="2.5" ry="2" fill="white" opacity="0.35" />
    </g>
  )
}

/** Surrounding small person — smaller silhouette. */
function SmallPerson({ cx, cy, fill }: { cx: number; cy: number; fill: string }) {
  return (
    <g>
      {/* Head */}
      <circle cx={cx} cy={cy - 5} r="5" fill={fill} />
      {/* Body */}
      <path
        d={`
          M ${cx - 8} ${cy + 10}
          Q ${cx - 8} ${cy + 3} ${cx - 4} ${cy + 1}
          L ${cx + 4} ${cy + 1}
          Q ${cx + 8} ${cy + 3} ${cx + 8} ${cy + 10}
          Z
        `}
        fill={fill}
      />
    </g>
  )
}

function fadeIn(g: number, start: number, end: number): number {
  if (g <= start) return 0
  if (g >= end) return 1
  const t = (g - start) / (end - start)
  return t * t * (3 - 2 * t)
}
