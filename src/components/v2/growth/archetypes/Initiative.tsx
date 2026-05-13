'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'
import { CelebrationGlow, CelebrationSparkles } from '../CelebrationLayer'

/**
 * Initiative — match evolving into a campfire.
 *
 * Why: initiative starts as a single spark — striking a match in the
 * dark — and grows into something that warms a whole gathering. The
 * artwork begins with a struck match leaning against twigs and ends
 * as a full campfire: stone ring, criss-crossed logs, roaring flame,
 * rising smoke.
 *
 * Composition stages (continuous, but thresholded for legibility):
 *   g 0.00–0.25  match alone, tiny flame on tip
 *   g 0.25–0.50  match has lit kindling; small flame
 *   g 0.50–0.75  stone ring + 2 logs in a V, modest flame
 *   g 0.75–1.00  full campfire — full ring, 3+ logs, leaping flame,
 *                smoke trail, sparks
 */
export function InitiativeVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const cx = 80
  const baseY = 138

  // Element fade-in thresholds (smoothstep around the boundary)
  const matchOpacity = fadeOut(g, 0.4, 0.55)
  const kindlingOpacity = fadeIn(g, 0.15, 0.35) * fadeOut(g, 0.55, 0.7)
  const stonesOpacity = fadeIn(g, 0.45, 0.65)
  const logsOpacity = fadeIn(g, 0.5, 0.75)
  const smokeOpacity = fadeIn(g, 0.55, 0.85)

  // Flame size grows continuously — peak pushed higher so a fully
  // grown campfire genuinely roars
  const flameH = lerp(6, 58, g)
  const flameW = lerp(3, 20, g)

  // Sparks above a threshold; count scales with density and peaks
  // with growth so a mature campfire throws real sparks
  const sparkCount = g > 0.55 ? Math.floor(density * 7) + Math.floor(g * 3) : 0
  const sparks = Array.from({ length: sparkCount }, () => ({
    x: cx + (rand() - 0.5) * 18,
    yOffset: rand() * 30 + 15,
    delay: rand() * 2.5,
    size: lerp(0.8, 1.8, rand()),
  }))

  // Stone ring — fixed positions, deterministic per seed
  const stoneCount = 5
  const stones = Array.from({ length: stoneCount }, (_, i) => {
    const t = i / (stoneCount - 1)
    const angle = lerp(Math.PI + 0.3, 2 * Math.PI - 0.3, t)
    const r = 20
    return {
      x: cx + Math.cos(angle) * r,
      y: baseY + 2 + Math.sin(angle) * 4,
      w: lerp(7, 11, rand()),
      h: lerp(4, 6, rand()),
      shade: i % 2,
    }
  })

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <radialGradient id={`init-flame-${seed}`} cx="50%" cy="80%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
          <stop offset="35%" stopColor={palette.accent} stopOpacity="0.98" />
          <stop offset="75%" stopColor={palette.mid} stopOpacity="0.85" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`init-ember-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
          <stop offset="50%" stopColor={palette.accent} stopOpacity="0.9" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.4" />
        </radialGradient>
        <radialGradient id={`init-light-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.45" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`init-log-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5b3a1f" />
          <stop offset="100%" stopColor="#3a2412" />
        </linearGradient>
        <radialGradient id={`init-stone-${seed}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#a6a6a6" />
          <stop offset="100%" stopColor="#4d4d4d" />
        </radialGradient>
      </defs>

      {/* Peak-glow halo */}
      <CelebrationGlow growth={growth} palette={palette} seed={seed} />

      {/* Warm ground glow from the fire */}
      <ellipse
        cx={cx}
        cy={baseY + 8}
        rx={lerp(15, 48, g)}
        ry="8"
        fill={`url(#init-light-${seed})`}
        opacity={lerp(0.4, 1, g)}
      />

      {/* Stone ring — appears as the campfire forms */}
      {stonesOpacity > 0.01 && (
        <g opacity={stonesOpacity} filter={`url(#${fid.drop})`}>
          {stones.map((s, i) => (
            <ellipse
              key={i}
              cx={s.x}
              cy={s.y}
              rx={s.w}
              ry={s.h}
              fill={`url(#init-stone-${seed})`}
            />
          ))}
        </g>
      )}

      {/* Kindling — small crossed twigs */}
      {kindlingOpacity > 0.01 && (
        <g opacity={kindlingOpacity} stroke="#6b4423" strokeWidth="1.5" strokeLinecap="round">
          <line x1={cx - 9} y1={baseY - 1} x2={cx + 8} y2={baseY - 3} />
          <line x1={cx - 6} y1={baseY - 4} x2={cx + 10} y2={baseY} />
          <line x1={cx - 11} y1={baseY + 1} x2={cx + 6} y2={baseY - 5} />
        </g>
      )}

      {/* Logs — criss-crossed at higher growth */}
      {logsOpacity > 0.01 && (
        <g opacity={logsOpacity} filter={`url(#${fid.drop})`}>
          {/* Log 1 — diagonal left */}
          <rect
            x={cx - 18}
            y={baseY - 3}
            width="28"
            height="5"
            rx="2"
            fill={`url(#init-log-${seed})`}
            transform={`rotate(-12 ${cx - 4} ${baseY - 0.5})`}
          />
          {/* Log 2 — diagonal right */}
          <rect
            x={cx - 10}
            y={baseY - 5}
            width="28"
            height="5"
            rx="2"
            fill={`url(#init-log-${seed})`}
            transform={`rotate(12 ${cx + 4} ${baseY - 2.5})`}
          />
          {/* Log 3 — appears at higher growth */}
          {g > 0.75 && (
            <rect
              x={cx - 14}
              y={baseY - 7}
              width="28"
              height="5"
              rx="2"
              fill={`url(#init-log-${seed})`}
              transform={`rotate(28 ${cx} ${baseY - 4.5})`}
              opacity={fadeIn(g, 0.75, 0.9)}
            />
          )}
          {/* Cut-end highlights — concentric circles on log ends */}
          <circle cx={cx + 10.5} cy={baseY - 3.5} r="2.4" fill="#8b6239" />
          <circle cx={cx + 10.5} cy={baseY - 3.5} r="1.4" fill="#5b3a1f" />
        </g>
      )}

      {/* Ember bed — bright glow at the base of the flames */}
      {g > 0.3 && (
        <g filter={`url(#${fid.glow})`} opacity={fadeIn(g, 0.3, 0.55)}>
          <ellipse cx={cx} cy={baseY - 1} rx={lerp(5, 12, g)} ry="3" fill={`url(#init-ember-${seed})`} />
        </g>
      )}

      {/* Flame — main fire body */}
      <g style={{ transformOrigin: `${cx}px ${baseY}px` }} filter={`url(#${fid.glow})`}>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1.04 0.95;0.97 1.04;1.02 0.98;1 1"
            dur="0.85s"
            additive="sum"
            repeatCount="indefinite"
          />
        )}
        <path
          d={`
            M ${cx} ${baseY - 2}
            C ${cx - flameW} ${baseY - flameH * 0.3} ${cx - flameW * 0.8} ${baseY - flameH * 0.7} ${cx - flameW * 0.2} ${baseY - flameH}
            C ${cx - flameW * 0.05} ${baseY - flameH * 1.05} ${cx + flameW * 0.1} ${baseY - flameH * 1.05} ${cx + flameW * 0.3} ${baseY - flameH}
            C ${cx + flameW * 0.9} ${baseY - flameH * 0.7} ${cx + flameW} ${baseY - flameH * 0.3} ${cx} ${baseY - 2}
            Z
          `}
          fill={`url(#init-flame-${seed})`}
        />
        {/* Inner hot core */}
        <ellipse
          cx={cx}
          cy={baseY - flameH * 0.55}
          rx={flameW * 0.35}
          ry={flameH * 0.32}
          fill="white"
          opacity="0.6"
        />
      </g>

      {/* The match — fades out as the fire takes over */}
      {matchOpacity > 0.01 && (
        <g opacity={matchOpacity} filter={`url(#${fid.drop})`}>
          {/* Stick */}
          <rect
            x={cx + 6}
            y={baseY - 14}
            width="22"
            height="1.5"
            rx="0.75"
            fill="#c89968"
            transform={`rotate(-30 ${cx + 6} ${baseY - 13.25})`}
          />
          {/* Match head */}
          <circle cx={cx + 4} cy={baseY - 13} r="2" fill={palette.accent} />
          {/* Tiny match flame */}
          {g > 0.05 && (
            <g filter={`url(#${fid.glow})`}>
              <ellipse cx={cx + 3} cy={baseY - 16} rx="1.5" ry="2.5" fill={palette.accent} />
              <circle cx={cx + 3} cy={baseY - 16.5} r="0.8" fill="white" />
            </g>
          )}
        </g>
      )}

      {/* Smoke — wispy trail rising from the flame top */}
      {smokeOpacity > 0.01 && (
        <g opacity={smokeOpacity * 0.55}>
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={cx + (i - 1) * 2}
              cy={baseY - flameH - 6 - i * 6}
              r={2.5 + i * 0.8}
              fill="#94a3b8"
              opacity={0.5 - i * 0.12}
            >
              {animate && (
                <animate
                  attributeName="cy"
                  values={`${baseY - flameH - 6 - i * 6};${baseY - flameH - 30 - i * 6}`}
                  dur="3.5s"
                  begin={`${i * 0.4}s`}
                  repeatCount="indefinite"
                />
              )}
              {animate && (
                <animate
                  attributeName="opacity"
                  values={`${0.5 - i * 0.12};0`}
                  dur="3.5s"
                  begin={`${i * 0.4}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
          ))}
        </g>
      )}

      {/* Rising sparks */}
      {sparks.map((s, i) => (
        <g key={i} filter={`url(#${fid.glow})`}>
          <circle cx={s.x} cy={baseY - s.yOffset} r={s.size} fill={palette.accent}>
            {animate && (
              <>
                <animate
                  attributeName="cy"
                  values={`${baseY - s.yOffset};${baseY - flameH - 35}`}
                  dur="2.4s"
                  begin={`${s.delay}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="1;0"
                  dur="2.4s"
                  begin={`${s.delay}s`}
                  repeatCount="indefinite"
                />
              </>
            )}
          </circle>
        </g>
      ))}

      {/* Celebration sparkles at the peak — joins the rising sparks */}
      <CelebrationSparkles
        growth={growth}
        density={density}
        palette={palette}
        seed={seed}
        animate={animate}
        innerExclude={36}
      />
    </svg>
  )
}

// Smoothstep fade helpers
function fadeIn(g: number, start: number, end: number): number {
  if (g <= start) return 0
  if (g >= end) return 1
  const t = (g - start) / (end - start)
  return t * t * (3 - 2 * t)
}
function fadeOut(g: number, start: number, end: number): number {
  return 1 - fadeIn(g, start, end)
}
