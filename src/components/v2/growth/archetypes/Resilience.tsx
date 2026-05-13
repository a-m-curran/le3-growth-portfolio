'use client'

import type { ArchetypeProps } from '../shared'
import { clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Resilience — stones becoming a fortress.
 *
 * Why: resilience is what hardens through trial. The artwork starts
 * as a humble cairn of stones and grows into a fortified keep —
 * walls, battlements, towers, a flag. Each conversation is another
 * stone in the wall.
 *
 * Composition stages (continuous):
 *   g 0.00–0.20  scattered foundation stones
 *   g 0.20–0.50  short wall begins to form
 *   g 0.50–0.75  wall with battlements + central tower
 *   g 0.75–1.00  full castle — flanking towers, gate, flag
 *
 * Depth: stones use a radial gradient (light/shadow side); the
 * castle silhouette gets a drop shadow as a whole; the flag has
 * gentle sway.
 */
export function ResilienceVisual({ growth, palette, seed, animate = true }: ArchetypeProps) {
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const cx = 80
  const baseY = 138

  // Wall dimensions
  const wallW = 64
  const wallH = lerp(6, 32, g)
  const wallX = cx - wallW / 2
  const wallY = baseY - wallH

  // Center tower extends above the wall
  const towerW = 18
  const towerH = wallH + lerp(0, 28, fadeIn(g, 0.5, 0.85))
  const towerX = cx - towerW / 2
  const towerY = baseY - towerH

  // Flanking towers — narrower, on each end of the wall
  const sideTowerW = 12
  const sideTowerH = wallH + lerp(0, 14, fadeIn(g, 0.6, 0.9))

  // Element visibility
  const foundationOpacity = fadeOut(g, 0.5, 0.7) // foundation stones visible early
  const wallOpacity = fadeIn(g, 0.15, 0.4)
  const battlementsOpacity = fadeIn(g, 0.45, 0.65)
  const centerTowerOpacity = fadeIn(g, 0.45, 0.7)
  const sideTowersOpacity = fadeIn(g, 0.6, 0.85)
  const gateOpacity = fadeIn(g, 0.5, 0.75)
  const flagOpacity = fadeIn(g, 0.7, 0.95)

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        {/* Stone face gradient — light-from-upper-left convention */}
        <linearGradient id={`res-stone-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#a8a29e" />
          <stop offset="60%" stopColor="#78716c" />
          <stop offset="100%" stopColor="#44403c" />
        </linearGradient>
        <linearGradient id={`res-tower-${seed}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#a8a29e" />
          <stop offset="40%" stopColor="#78716c" />
          <stop offset="100%" stopColor="#3f3a36" />
        </linearGradient>
        <radialGradient id={`res-rock-${seed}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#a8a29e" />
          <stop offset="100%" stopColor="#44403c" />
        </radialGradient>
        <linearGradient id={`res-flag-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.accent} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
      </defs>

      {/* Cast ground shadow */}
      <ellipse cx={cx} cy={baseY + 5} rx={lerp(20, 40, g)} ry="5" fill={`url(#${fid.ground})`} />

      {/* Foundation stones — visible early, fade as the wall rises over them */}
      {foundationOpacity > 0.01 && (
        <g opacity={foundationOpacity} filter={`url(#${fid.drop})`}>
          <ellipse cx={cx - 18} cy={baseY - 3} rx="9" ry="4" fill={`url(#res-rock-${seed})`} />
          <ellipse cx={cx - 4} cy={baseY - 4} rx="10" ry="4.5" fill={`url(#res-rock-${seed})`} />
          <ellipse cx={cx + 12} cy={baseY - 3} rx="8" ry="4" fill={`url(#res-rock-${seed})`} />
          <ellipse cx={cx + 22} cy={baseY - 2} rx="6" ry="3" fill={`url(#res-rock-${seed})`} />
        </g>
      )}

      <g filter={`url(#${fid.drop})`}>
        {/* Main wall */}
        {wallOpacity > 0.01 && (
          <g opacity={wallOpacity}>
            <rect x={wallX} y={wallY} width={wallW} height={wallH} fill={`url(#res-stone-${seed})`} />
            {/* Stone block joints — vertical lines */}
            {wallH > 8 &&
              Array.from({ length: 6 }, (_, i) => {
                const x = wallX + (wallW / 6) * (i + 0.5)
                return (
                  <line
                    key={i}
                    x1={x}
                    y1={wallY + 2}
                    x2={x}
                    y2={baseY - 2}
                    stroke="#3f3a36"
                    strokeWidth="0.6"
                    opacity="0.6"
                  />
                )
              })}
            {/* Horizontal joint */}
            {wallH > 14 && (
              <line
                x1={wallX + 1}
                y1={wallY + wallH / 2}
                x2={wallX + wallW - 1}
                y2={wallY + wallH / 2}
                stroke="#3f3a36"
                strokeWidth="0.6"
                opacity="0.55"
              />
            )}
          </g>
        )}

        {/* Battlements (crenellations) on top of wall */}
        {battlementsOpacity > 0.01 && (
          <g opacity={battlementsOpacity}>
            {Array.from({ length: 6 }, (_, i) => {
              const slotW = wallW / 6
              const x = wallX + slotW * i + 1
              return (
                <rect
                  key={i}
                  x={x}
                  y={wallY - 4}
                  width={slotW * 0.55}
                  height="4"
                  fill={`url(#res-stone-${seed})`}
                />
              )
            })}
          </g>
        )}

        {/* Center tower (rises taller than wall) */}
        {centerTowerOpacity > 0.01 && (
          <g opacity={centerTowerOpacity}>
            <rect x={towerX} y={towerY} width={towerW} height={towerH} fill={`url(#res-tower-${seed})`} />
            {/* Tower battlements */}
            {Array.from({ length: 3 }, (_, i) => (
              <rect
                key={i}
                x={towerX + 0.5 + (towerW / 3) * i}
                y={towerY - 4}
                width={(towerW / 3) * 0.6}
                height="4"
                fill={`url(#res-tower-${seed})`}
              />
            ))}
            {/* Arrow slit / window */}
            {towerH > 22 && (
              <rect
                x={cx - 1}
                y={towerY + 6}
                width="2"
                height="6"
                fill="#1a1410"
                opacity="0.9"
              />
            )}
            {/* Horizontal joint */}
            {towerH > 20 && (
              <line
                x1={towerX + 1}
                y1={towerY + towerH * 0.55}
                x2={towerX + towerW - 1}
                y2={towerY + towerH * 0.55}
                stroke="#3f3a36"
                strokeWidth="0.6"
                opacity="0.55"
              />
            )}
          </g>
        )}

        {/* Flanking towers (left + right) */}
        {sideTowersOpacity > 0.01 && (
          <g opacity={sideTowersOpacity}>
            {/* Left flanking tower */}
            <rect
              x={wallX - sideTowerW / 2}
              y={baseY - sideTowerH}
              width={sideTowerW}
              height={sideTowerH}
              fill={`url(#res-tower-${seed})`}
            />
            {/* Cone roof */}
            <polygon
              points={`${wallX - sideTowerW / 2 - 2},${baseY - sideTowerH} ${wallX + sideTowerW / 2 + 2},${baseY - sideTowerH} ${wallX},${baseY - sideTowerH - 8}`}
              fill={palette.dark}
            />
            {/* Right flanking tower */}
            <rect
              x={wallX + wallW - sideTowerW / 2}
              y={baseY - sideTowerH}
              width={sideTowerW}
              height={sideTowerH}
              fill={`url(#res-tower-${seed})`}
            />
            <polygon
              points={`${wallX + wallW - sideTowerW / 2 - 2},${baseY - sideTowerH} ${wallX + wallW + sideTowerW / 2 + 2},${baseY - sideTowerH} ${wallX + wallW},${baseY - sideTowerH - 8}`}
              fill={palette.dark}
            />
          </g>
        )}

        {/* Gate door — arched opening in the wall, in front of center tower */}
        {gateOpacity > 0.01 && wallH > 14 && (
          <g opacity={gateOpacity}>
            <path
              d={`
                M ${cx - 5} ${baseY}
                L ${cx - 5} ${baseY - 8}
                Q ${cx - 5} ${baseY - 11} ${cx} ${baseY - 11}
                Q ${cx + 5} ${baseY - 11} ${cx + 5} ${baseY - 8}
                L ${cx + 5} ${baseY}
                Z
              `}
              fill="#1a1410"
            />
            {/* Door planks suggestion */}
            <line x1={cx} y1={baseY - 10} x2={cx} y2={baseY - 1} stroke="#3f3a36" strokeWidth="0.6" opacity="0.7" />
          </g>
        )}
      </g>

      {/* Flag on top of center tower */}
      {flagOpacity > 0.01 && (
        <g opacity={flagOpacity}>
          {/* Pole */}
          <line
            x1={cx}
            y1={towerY - 4}
            x2={cx}
            y2={towerY - 18}
            stroke="#44403c"
            strokeWidth="1.2"
          />
          {/* Flag — swaying triangle pennant */}
          <g style={{ transformOrigin: `${cx}px ${towerY - 16}px` }}>
            {animate && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values={`-3 ${cx} ${towerY - 16};3 ${cx} ${towerY - 16};-3 ${cx} ${towerY - 16}`}
                dur="2.4s"
                repeatCount="indefinite"
              />
            )}
            <polygon
              points={`${cx},${towerY - 17} ${cx + 12},${towerY - 14} ${cx},${towerY - 11}`}
              fill={`url(#res-flag-${seed})`}
            />
          </g>
          {/* Pole top knob */}
          <circle cx={cx} cy={towerY - 18.5} r="1.3" fill={palette.accent} />
        </g>
      )}
    </svg>
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
