'use client'

import { seededRandom } from './shared'

/**
 * CelebrationLayer — the "this is what spectacular looks like" overlay.
 *
 * Sits behind/around an archetype's artwork. Invisible at low growth.
 * As growth crosses ~0.65 it begins to fade in three things in a
 * stack:
 *
 *   1. A radial peak-glow that lights up the canvas edges in the
 *      pillar's accent color — the artwork looks lit from within.
 *   2. A scatter of small twinkling sparkles around the artwork —
 *      "achievement particles."
 *   3. Optional accent rays radiating outward from the canvas
 *      center, like sunbeams behind a hero.
 *
 * Each archetype is responsible for its own primary content; this
 * layer just adds the trophy/celebration aura on top of everything
 * else. Drop one `<CelebrationLayer ... />` near the start of the
 * SVG (for the glow) and another `<CelebrationSparkles ... />` near
 * the end (so sparkles render in front).
 *
 * Density influences sparkle count + brightness — a skill with many
 * conversations celebrates more loudly than one earned by reaching
 * the same level with fewer.
 */

interface BackProps {
  /** Continuous growth 0..1 from the archetype. */
  growth: number
  /** Pillar palette so the celebration matches the artwork. */
  palette: { bg: string; mid: string; dark: string; accent: string }
  /** Used to make the radial gradient id unique. */
  seed: string
  /** Threshold below which the celebration is invisible. Default 0.65. */
  threshold?: number
}

/**
 * The back half: a radial accent-color glow that fades in from the
 * edges of the canvas. Render BEFORE the archetype's primary content
 * so the artwork sits on top of it.
 */
export function CelebrationGlow({ growth, palette, seed, threshold = 0.65 }: BackProps) {
  const intensity = fadeIn(growth, threshold, 1)
  if (intensity < 0.01) return null
  return (
    <g opacity={intensity}>
      <defs>
        <radialGradient id={`cel-glow-${seed}`} cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0" />
          <stop offset="55%" stopColor={palette.accent} stopOpacity="0.18" />
          <stop offset="90%" stopColor={palette.accent} stopOpacity="0.32" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0.05" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="160" height="160" fill={`url(#cel-glow-${seed})`} />
    </g>
  )
}

interface FrontProps extends BackProps {
  /** Conversation density 0..1; modulates sparkle count + brightness. */
  density: number
  /** Whether to animate the sparkles. */
  animate?: boolean
  /**
   * Optional radius (in viewBox units) inside which no sparkles
   * render — keeps them from overlapping the main artwork. Default 32.
   */
  innerExclude?: number
}

/**
 * The front half: twinkling sparkle particles scattered around the
 * artwork. Render AFTER the archetype's primary content so sparkles
 * sit on top.
 */
export function CelebrationSparkles({
  growth,
  density,
  palette,
  seed,
  threshold = 0.65,
  animate = true,
  innerExclude = 32,
}: FrontProps) {
  const intensity = fadeIn(growth, threshold, 1)
  if (intensity < 0.05) return null

  const rand = seededRandom(`${seed}-cel`)
  // Sparkle count scales with both growth peak and density
  const count = Math.round(6 + density * 6 + intensity * 4)
  const sparkles = Array.from({ length: count }, (_, i) => {
    // Spread sparkles around the canvas; reject those inside the
    // inner-exclude radius so they don't sit on top of the main form.
    let x = 0
    let y = 0
    for (let attempt = 0; attempt < 5; attempt++) {
      x = 12 + rand() * 136
      y = 12 + rand() * 136
      const dx = x - 80
      const dy = y - 80
      if (Math.sqrt(dx * dx + dy * dy) > innerExclude) break
    }
    const size = 0.9 + rand() * 1.4
    const phase = rand() * 3
    return { x, y, size, phase, i }
  })

  return (
    <g opacity={intensity}>
      {sparkles.map((s) => (
        <g key={s.i}>
          {/* Sparkle = small bright circle + 4-pointed cross */}
          <circle cx={s.x} cy={s.y} r={s.size} fill="white" opacity="0.95">
            {animate && (
              <animate
                attributeName="opacity"
                values="0;0.95;0;0.95;0"
                dur={`${2.2 + s.phase * 0.4}s`}
                begin={`${s.phase}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>
          <g stroke={palette.accent} strokeWidth="0.6" strokeLinecap="round" opacity="0.95">
            <line x1={s.x - s.size * 2.2} y1={s.y} x2={s.x + s.size * 2.2} y2={s.y}>
              {animate && (
                <animate
                  attributeName="opacity"
                  values="0;0.95;0"
                  dur={`${2.2 + s.phase * 0.4}s`}
                  begin={`${s.phase}s`}
                  repeatCount="indefinite"
                />
              )}
            </line>
            <line x1={s.x} y1={s.y - s.size * 2.2} x2={s.x} y2={s.y + s.size * 2.2}>
              {animate && (
                <animate
                  attributeName="opacity"
                  values="0;0.95;0"
                  dur={`${2.2 + s.phase * 0.4}s`}
                  begin={`${s.phase}s`}
                  repeatCount="indefinite"
                />
              )}
            </line>
          </g>
        </g>
      ))}
    </g>
  )
}

/**
 * Optional sunburst — soft accent rays radiating from the artwork's
 * center. Adds "hero behind a sun" energy at peak. Use sparingly;
 * not every archetype wants this (the lightbulb already has rays,
 * the lighthouse-replacement has its own beam, etc).
 */
export function CelebrationSunburst({ growth, palette, seed, threshold = 0.75 }: BackProps) {
  const intensity = fadeIn(growth, threshold, 1)
  if (intensity < 0.05) return null
  const rayCount = 12
  return (
    <g opacity={intensity * 0.7} style={{ transformOrigin: '80px 80px' }}>
      {Array.from({ length: rayCount }, (_, i) => {
        const angle = (i / rayCount) * 360
        return (
          <line
            key={i}
            x1="80"
            y1="80"
            x2="80"
            y2="0"
            stroke={palette.accent}
            strokeWidth="0.9"
            opacity="0.35"
            transform={`rotate(${angle} 80 80)`}
          />
        )
      })}
      <defs>
        <radialGradient id={`cel-sun-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
    </g>
  )
}

function fadeIn(g: number, start: number, end: number): number {
  if (g <= start) return 0
  if (g >= end) return 1
  const t = (g - start) / (end - start)
  return t * t * (3 - 2 * t)
}
