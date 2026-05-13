'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'
import { CelebrationGlow, CelebrationSparkles } from '../CelebrationLayer'

/**
 * Curiosity — a magnifying glass discovering a constellation.
 *
 * Why: curiosity isn't passive looking — it's the act of moving the
 * lens, finding things worth examining. The magnifying glass is the
 * universal symbol of inquiry. As curiosity grows, the lens moves
 * across the sky and points of light reveal themselves.
 *
 * Composition stages (continuous):
 *   g 0.00–0.25  magnifying glass alone; faint stars in background
 *   g 0.25–0.55  glass passes over stars; some light up brightly
 *   g 0.55–0.85  more stars lit; lines start drawing between them
 *   g 0.85–1.00  full constellation revealed with connection lines
 *
 * Depth: magnifying glass has a metallic handle gradient + glass
 * specular highlight + drop shadow; lit stars glow; dark "sky"
 * gradient backing for depth.
 */
export function CuriosityVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  // More stars + brighter at peak so a full curiosity sky really
  // looks like a constellation, not a smattering of dots
  const totalStars = 14
  const allStars = Array.from({ length: totalStars }, () => ({
    x: 18 + rand() * 124,
    y: 18 + rand() * 95,
    size: lerp(1.4, 3.2, rand()),
    twinkle: rand() * 4,
  }))
  const litCount = Math.max(1, Math.round(lerp(1, totalStars, g)))
  const lit = allStars.slice(0, litCount)

  // Connection lines between adjacent lit stars
  const connectionsToDraw = Math.floor(lerp(0, lit.length - 1, fadeIn(g, 0.55, 1)))
  const connections = Array.from({ length: connectionsToDraw }, (_, i) => ({
    a: lit[i],
    b: lit[i + 1],
  }))

  // Magnifying glass position — moves across the field as growth
  // increases (it "scans" for stars)
  const glassX = lerp(45, 105, g) + (rand() - 0.5) * 4
  const glassY = lerp(105, 65, g)
  const lensR = 16

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <radialGradient id={`cur-bg-${seed}`} cx="50%" cy="40%" r="80%">
          <stop offset="0%" stopColor={palette.dark} stopOpacity="0.15" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`cur-star-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="40%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`cur-lens-${seed}`} cx="40%" cy="38%" r="62%">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="60%" stopColor={palette.accent} stopOpacity="0.15" />
          <stop offset="100%" stopColor={palette.mid} stopOpacity="0.2" />
        </radialGradient>
        <linearGradient id={`cur-handle-${seed}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#9a7b4a" />
          <stop offset="50%" stopColor="#c89968" />
          <stop offset="100%" stopColor="#5a4a2a" />
        </linearGradient>
        <linearGradient id={`cur-frame-${seed}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#9a7b4a" />
          <stop offset="40%" stopColor="#e9d3a6" />
          <stop offset="100%" stopColor="#5a4a2a" />
        </linearGradient>
      </defs>

      {/* Sky backing */}
      <rect x="0" y="0" width="160" height="160" fill={`url(#cur-bg-${seed})`} />

      {/* Peak-glow halo */}
      <CelebrationGlow growth={growth} palette={palette} seed={seed} />

      {/* Unlit (background) stars — barely visible */}
      <g>
        {allStars.slice(litCount).map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.size * 0.5} fill={palette.mid} opacity="0.2" />
        ))}
      </g>

      {/* Connection lines */}
      <g stroke={palette.mid} strokeWidth="0.8" fill="none" strokeLinecap="round">
        {connections.map((c, i) => (
          <line
            key={i}
            x1={c.a.x}
            y1={c.a.y}
            x2={c.b.x}
            y2={c.b.y}
            opacity={lerp(0.4, 0.75, g)}
          />
        ))}
      </g>

      {/* Lit stars */}
      <g filter={`url(#${fid.glow})`}>
        {lit.map((s, i) => (
          <g key={i}>
            <circle cx={s.x} cy={s.y} r={s.size * 2.3} fill={`url(#cur-star-${seed})`} />
            <circle cx={s.x} cy={s.y} r={s.size} fill="white">
              {animate && (
                <animate
                  attributeName="opacity"
                  values="1;0.55;1"
                  dur={`${1.6 + s.twinkle * 0.4}s`}
                  begin={`${s.twinkle}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
            {/* Sparkle cross */}
            <g stroke="white" strokeWidth="0.55" strokeLinecap="round" opacity="0.85">
              <line x1={s.x - s.size * 2} y1={s.y} x2={s.x + s.size * 2} y2={s.y} />
              <line x1={s.x} y1={s.y - s.size * 2} x2={s.x} y2={s.y + s.size * 2} />
            </g>
          </g>
        ))}
      </g>

      {/* Magnifying glass */}
      <g filter={`url(#${fid.drop})`}>
        {/* Handle — angled down-right from the lens */}
        <rect
          x={glassX + lensR * 0.7}
          y={glassY + lensR * 0.7}
          width="22"
          height="5"
          rx="2.5"
          fill={`url(#cur-handle-${seed})`}
          transform={`rotate(35 ${glassX + lensR * 0.7} ${glassY + lensR * 0.7 + 2.5})`}
        />
        {/* Handle grip — knobby end */}
        <circle
          cx={glassX + lensR * 0.7 + Math.cos(35 * (Math.PI / 180)) * 22}
          cy={glassY + lensR * 0.7 + Math.sin(35 * (Math.PI / 180)) * 22 + 2.5}
          r="3"
          fill="#5a4a2a"
        />

        {/* Lens frame — outer ring */}
        <circle
          cx={glassX}
          cy={glassY}
          r={lensR}
          fill="none"
          stroke={`url(#cur-frame-${seed})`}
          strokeWidth="3.5"
        />
        {/* Lens glass — slight tint + specular */}
        <circle cx={glassX} cy={glassY} r={lensR - 2} fill={`url(#cur-lens-${seed})`} opacity="0.92" />
        {/* Glass highlight — crescent */}
        <path
          d={`M ${glassX - lensR + 4} ${glassY - 2} Q ${glassX - lensR + 6} ${glassY - lensR + 4} ${glassX - 2} ${glassY - lensR + 3}`}
          stroke="white"
          strokeOpacity="0.7"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* Density indicator: tiny question-mark-like dots near the lens */}
      {density > 0.3 && g > 0.4 && (
        <g opacity={density * 0.85}>
          <circle cx={glassX + lensR + 6} cy={glassY - lensR - 4} r="1.2" fill={palette.accent} />
          <circle cx={glassX + lensR + 10} cy={glassY - lensR - 8} r="0.9" fill={palette.accent} opacity="0.7" />
        </g>
      )}

      {/* Celebration sparkles at peak — joins the constellation */}
      <CelebrationSparkles
        growth={growth}
        density={density}
        palette={palette}
        seed={seed}
        animate={animate}
        innerExclude={20}
      />
    </svg>
  )
}

function fadeIn(g: number, start: number, end: number): number {
  if (g <= start) return 0
  if (g >= end) return 1
  const t = (g - start) / (end - start)
  return t * t * (3 - 2 * t)
}
