'use client'

import type { ArchetypeProps } from '../shared'
import { clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'
import { CelebrationGlow, CelebrationSparkles } from '../CelebrationLayer'

/**
 * Empathy — two profile silhouettes with a heart between them.
 *
 * Why: empathy is what happens between two minds. Two facing profiles
 * is the most universally legible "we are with each other" icon. As
 * the relationship grows, a heart forms in the space between, then
 * pulses and radiates.
 *
 * Composition stages (continuous):
 *   g 0.00–0.25  just the two profiles, blank space between
 *   g 0.25–0.55  small dots appear in the gap (the beginning of
 *                noticing)
 *   g 0.55–0.85  a heart forms between them
 *   g 0.85–1.00  heart pulses; soft glow radiates
 *
 * Depth: silhouettes use a vertical gradient (highlight on top of
 * head, deep shadow at neck); ground gets a soft cast shadow; heart
 * is form-modeled with a radial gradient + bright specular catch.
 */
export function EmpathyVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const baseY = 132
  // Left profile faces right; right profile faces left
  const leftCx = 45
  const rightCx = 115

  // Heart visibility & size — peak heart pushed bigger so it
  // really shines as the climax
  const heartOpacity = fadeIn(g, 0.5, 0.8)
  const heartGlow = fadeIn(g, 0.8, 1)
  const heartSize = lerp(8, 18, fadeIn(g, 0.5, 0.95))

  // Pre-heart dots
  const dotsOpacity = fadeIn(g, 0.2, 0.5) * fadeOut(g, 0.55, 0.7)

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`emp-fig-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
        <linearGradient id={`emp-fig2-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.accent} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
        <radialGradient id={`emp-heart-${seed}`} cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.85" />
          <stop offset="40%" stopColor={palette.accent} stopOpacity="0.98" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.9" />
        </radialGradient>
      </defs>

      {/* Peak-glow halo */}
      <CelebrationGlow growth={growth} palette={palette} seed={seed} />

      {/* Ground shadow */}
      <ellipse cx="80" cy="142" rx="56" ry="6" fill={`url(#${fid.ground})`} />

      {/* Left profile — facing right */}
      <g filter={`url(#${fid.drop})`}>
        <ProfileSilhouette cx={leftCx} baseY={baseY} fill={`url(#emp-fig-${seed})`} facing="right" />
      </g>

      {/* Right profile — facing left, slightly different palette stop */}
      <g filter={`url(#${fid.drop})`}>
        <ProfileSilhouette cx={rightCx} baseY={baseY} fill={`url(#emp-fig2-${seed})`} facing="left" />
      </g>

      {/* Pre-heart dots — "noticing each other" stage */}
      {dotsOpacity > 0.01 && (
        <g opacity={dotsOpacity}>
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={70 + i * 10}
              cy={80}
              r="1.4"
              fill={palette.accent}
            >
              {animate && (
                <animate
                  attributeName="opacity"
                  values="0.3;1;0.3"
                  dur="1.4s"
                  begin={`${i * 0.3}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
          ))}
        </g>
      )}

      {/* Heart between the profiles */}
      {heartOpacity > 0.01 && (
        <g
          opacity={heartOpacity}
          filter={heartGlow > 0.1 ? `url(#${fid.glow})` : `url(#${fid.drop})`}
          style={{ transformOrigin: '80px 80px' }}
        >
          {animate && (
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1;1.12;1"
              dur="1.2s"
              additive="sum"
              repeatCount="indefinite"
            />
          )}
          <Heart cx={80} cy={80} size={heartSize} fill={`url(#emp-heart-${seed})`} />
          {/* Bright specular */}
          <circle cx={80 - heartSize * 0.25} cy={80 - heartSize * 0.3} r={heartSize * 0.18} fill="white" opacity="0.65" />
        </g>
      )}

      {/* Radiating heartbeat lines — only at full growth, more rings now */}
      {heartGlow > 0.1 && (
        <g
          opacity={heartGlow * 0.7}
          stroke={palette.accent}
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        >
          {[0, 1, 2, 3].map((i) => {
            const r = heartSize + 6 + i * 5
            return (
              <path
                key={i}
                d={`M ${80 - r} 80 Q 80 ${80 - r}, ${80 + r} 80`}
                opacity={0.5 - i * 0.1}
              />
            )
          })}
        </g>
      )}

      {/* Celebration sparkles around the connection at peak */}
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

/** Side-profile silhouette of a head + shoulder. */
function ProfileSilhouette({
  cx,
  baseY,
  fill,
  facing,
}: {
  cx: number
  baseY: number
  fill: string
  facing: 'left' | 'right'
}) {
  // Profile silhouette path. Drawn for facing="right" then mirrored
  // via transform if facing="left".
  const headTop = baseY - 70
  const chinY = baseY - 38
  const shoulderY = baseY - 8
  // Path: top of head → forehead → nose → mouth → chin → neck → shoulder
  const path = `
    M ${cx} ${headTop}
    C ${cx - 9} ${headTop} ${cx - 12} ${headTop + 10} ${cx - 12} ${headTop + 18}
    C ${cx - 12} ${headTop + 30} ${cx - 8} ${chinY - 12} ${cx - 4} ${chinY - 8}
    L ${cx - 2} ${chinY - 14}
    Q ${cx + 8} ${chinY - 12} ${cx + 7} ${chinY - 4}
    Q ${cx + 6} ${chinY - 2} ${cx + 1} ${chinY - 1}
    Q ${cx + 4} ${chinY + 4} ${cx} ${chinY + 6}
    Q ${cx - 2} ${chinY + 10} ${cx - 4} ${chinY + 8}
    L ${cx - 6} ${shoulderY - 4}
    L ${cx - 22} ${shoulderY}
    L ${cx - 22} ${baseY}
    L ${cx + 4} ${baseY}
    L ${cx + 4} ${shoulderY}
    Z
  `
  return (
    <g transform={facing === 'left' ? `translate(${cx * 2}, 0) scale(-1, 1)` : undefined}>
      <path d={path} fill={fill} />
      {/* Subtle upper highlight on the head's outer curve */}
      <path
        d={`M ${cx - 11} ${headTop + 14} Q ${cx - 11.5} ${headTop + 24} ${cx - 9} ${headTop + 32}`}
        stroke="white"
        strokeOpacity="0.25"
        strokeWidth="1.2"
        fill="none"
      />
      <ProfileEye cx={cx - 4} cy={headTop + 22} />
    </g>
  )
}

function ProfileEye({ cx, cy }: { cx: number; cy: number }) {
  return <circle cx={cx} cy={cy} r="1.3" fill="white" opacity="0.85" />
}

/** Heart shape path. */
function Heart({ cx, cy, size, fill }: { cx: number; cy: number; size: number; fill: string }) {
  // Classic two-lobed heart, slightly squat
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
function fadeOut(g: number, start: number, end: number): number {
  return 1 - fadeIn(g, start, end)
}
