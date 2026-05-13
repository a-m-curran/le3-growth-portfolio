'use client'

import type { ArchetypeProps } from '../shared'
import { clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Creative Problem Solving — a lightbulb.
 *
 * Why: the universal "aha" symbol. A bulb starts dark, the filament
 * faintly glows, the bulb brightens, and finally radiates beams of
 * light outward. Each conversation is another idea connecting.
 *
 * Composition stages (continuous):
 *   g 0.00–0.25  dark bulb; filament barely visible
 *   g 0.25–0.50  filament heats up; soft amber glow inside
 *   g 0.50–0.75  bulb shines white-hot; halo appears
 *   g 0.75–1.00  rays radiate outward; aura widens
 *
 * Depth: bulb has a glass highlight + form-modeled gradient; screw
 * base has metal banding; rays are layered with falloff opacity.
 */
export function CreativeProblemSolvingVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  const cx = 80
  const cy = 70
  // Bulb body
  const bulbR = 22

  // Visibility thresholds
  const filamentGlow = fadeIn(g, 0.05, 0.4)
  const innerGlow = fadeIn(g, 0.3, 0.65)
  const haloOpacity = fadeIn(g, 0.5, 0.8)
  const raysOpacity = fadeIn(g, 0.65, 0.95)

  const rayCount = 8
  const rayLength = lerp(8, 28, fadeIn(g, 0.65, 1))

  // Subtle bulb sway (only when animating) — like it's "thinking"
  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <radialGradient id={`cps-bulb-${seed}`} cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.85" />
          <stop offset="50%" stopColor={palette.accent} stopOpacity="0.55" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0.4" />
        </radialGradient>
        <radialGradient id={`cps-inner-${seed}`} cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
          <stop offset="40%" stopColor={palette.accent} stopOpacity="0.85" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`cps-base-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#4b5563" />
        </linearGradient>
        <radialGradient id={`cps-halo-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.6" />
          <stop offset="60%" stopColor={palette.accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft cast shadow under the bulb's base */}
      <ellipse cx={cx} cy="135" rx="20" ry="4" fill={`url(#${fid.ground})`} />

      {/* Outer halo — appears when the bulb is bright */}
      {haloOpacity > 0.01 && (
        <circle cx={cx} cy={cy} r={bulbR * 2.2} fill={`url(#cps-halo-${seed})`} opacity={haloOpacity} />
      )}

      {/* Radiating rays — only at high growth */}
      {raysOpacity > 0.01 && (
        <g
          opacity={raysOpacity}
          stroke={palette.accent}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        >
          {animate && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${cx} ${cy}`}
              to={`360 ${cx} ${cy}`}
              dur="18s"
              repeatCount="indefinite"
            />
          )}
          {Array.from({ length: rayCount }, (_, i) => {
            const angle = (i / rayCount) * Math.PI * 2
            const x1 = cx + Math.cos(angle) * (bulbR + 6)
            const y1 = cy + Math.sin(angle) * (bulbR + 6)
            const x2 = cx + Math.cos(angle) * (bulbR + 6 + rayLength)
            const y2 = cy + Math.sin(angle) * (bulbR + 6 + rayLength)
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} opacity={0.75} />
          })}
        </g>
      )}

      {/* Screw base — bottom of the bulb */}
      <g filter={`url(#${fid.drop})`}>
        {/* Threaded section */}
        <rect x={cx - 8} y={cy + bulbR - 4} width="16" height="12" fill={`url(#cps-base-${seed})`} />
        {/* Thread bands */}
        <line x1={cx - 7.5} y1={cy + bulbR} x2={cx + 7.5} y2={cy + bulbR} stroke="#374151" strokeWidth="0.6" />
        <line x1={cx - 7.5} y1={cy + bulbR + 3} x2={cx + 7.5} y2={cy + bulbR + 3} stroke="#374151" strokeWidth="0.6" />
        <line x1={cx - 7.5} y1={cy + bulbR + 6} x2={cx + 7.5} y2={cy + bulbR + 6} stroke="#374151" strokeWidth="0.6" />
        {/* Tip contact */}
        <ellipse cx={cx} cy={cy + bulbR + 9.5} rx="6" ry="2" fill="#374151" />
      </g>

      {/* Bulb glass — main body */}
      <g filter={`url(#${fid.drop})`}>
        {/* Glass envelope: classic Edison teardrop */}
        <path
          d={`
            M ${cx - bulbR} ${cy}
            C ${cx - bulbR} ${cy - bulbR * 1.05} ${cx + bulbR} ${cy - bulbR * 1.05} ${cx + bulbR} ${cy}
            C ${cx + bulbR} ${cy + bulbR * 0.7} ${cx + 8} ${cy + bulbR - 4} ${cx + 8} ${cy + bulbR - 4}
            L ${cx - 8} ${cy + bulbR - 4}
            C ${cx - 8} ${cy + bulbR - 4} ${cx - bulbR} ${cy + bulbR * 0.7} ${cx - bulbR} ${cy}
            Z
          `}
          fill={`url(#cps-bulb-${seed})`}
          stroke={palette.dark}
          strokeWidth="0.8"
          strokeOpacity="0.4"
        />

        {/* Inner glow — the hot zone */}
        {innerGlow > 0.01 && (
          <ellipse
            cx={cx}
            cy={cy + 2}
            rx={bulbR * 0.7}
            ry={bulbR * 0.85}
            fill={`url(#cps-inner-${seed})`}
            opacity={innerGlow}
            filter={`url(#${fid.glow})`}
          />
        )}
      </g>

      {/* Filament — zigzag wire across the inside */}
      <g
        stroke={palette.accent}
        strokeWidth={lerp(0.9, 1.6, filamentGlow)}
        fill="none"
        strokeLinecap="round"
        opacity={lerp(0.4, 1, filamentGlow)}
        filter={filamentGlow > 0.4 ? `url(#${fid.glow})` : undefined}
      >
        {/* Support wires from base to filament */}
        <line x1={cx - 3.5} y1={cy + bulbR - 4} x2={cx - 3.5} y2={cy + 4} />
        <line x1={cx + 3.5} y1={cy + bulbR - 4} x2={cx + 3.5} y2={cy + 4} />
        {/* Zigzag filament */}
        <path
          d={`
            M ${cx - 3.5} ${cy + 4}
            L ${cx - 5} ${cy + 1}
            L ${cx - 2.5} ${cy - 2}
            L ${cx + 0} ${cy + 1}
            L ${cx + 2.5} ${cy - 2}
            L ${cx + 5} ${cy + 1}
            L ${cx + 3.5} ${cy + 4}
          `}
        />
        {/* Subtle filament pulse when on */}
        {animate && filamentGlow > 0.2 && (
          <animate
            attributeName="opacity"
            values={`${lerp(0.4, 1, filamentGlow)};${lerp(0.55, 0.85, filamentGlow)};${lerp(0.4, 1, filamentGlow)}`}
            dur="1.4s"
            repeatCount="indefinite"
          />
        )}
      </g>

      {/* Glass highlight — upper-left specular reflection */}
      <ellipse
        cx={cx - bulbR * 0.45}
        cy={cy - bulbR * 0.45}
        rx={bulbR * 0.32}
        ry={bulbR * 0.22}
        fill="white"
        opacity="0.55"
        transform={`rotate(-30 ${cx - bulbR * 0.45} ${cy - bulbR * 0.45})`}
      />

      {/* Small accent dots in the radiating phase — looks like "ideas escaping" */}
      {raysOpacity > 0.1 && density > 0.2 && (
        <g opacity={raysOpacity * density}>
          {[0, 1, 2, 3].map((i) => {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 8
            const r = bulbR + 12 + lerp(0, 8, density)
            return (
              <circle
                key={i}
                cx={cx + Math.cos(angle) * r}
                cy={cy + Math.sin(angle) * r}
                r="1.6"
                fill={palette.accent}
                filter={`url(#${fid.glow})`}
              />
            )
          })}
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
