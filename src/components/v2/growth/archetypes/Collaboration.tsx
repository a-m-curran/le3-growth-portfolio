'use client'

import type { ArchetypeProps } from '../shared'
import { clamp01, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Collaboration — interlocking gears.
 *
 * Why: collaboration is movement that only happens when pieces fit
 * together. One gear alone is inert; two interlocking gears turn
 * each other; three or more form a working machine. Each
 * conversation is another tooth meshing.
 *
 * Composition stages (continuous):
 *   g 0.00–0.25  a single gear, not turning
 *   g 0.25–0.50  second gear engages; both turn (opposite directions)
 *   g 0.50–0.80  third gear joins the chain
 *   g 0.80–1.00  full machine — multiple gears turning together
 *
 * Depth: each gear has a 3D-ish radial gradient (light face, shadow
 * underside), a central hub with shadow, and an inner spoke pattern.
 * Drop shadows lift the gears off the canvas.
 */
export function CollaborationVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  // Main gear — always present
  const mainCx = 65
  const mainCy = 85
  const mainR = 22

  // Second gear — engages at g > 0.25, slightly smaller, to the right
  const g2Visibility = fadeIn(g, 0.2, 0.45)
  const g2Cx = 105
  const g2Cy = 75
  const g2R = 16

  // Third gear — joins at g > 0.5, smallest, lower right
  const g3Visibility = fadeIn(g, 0.5, 0.75)
  const g3Cx = 112
  const g3Cy = 110
  const g3R = 11

  // Fourth gear — top accent at full growth
  const g4Visibility = fadeIn(g, 0.75, 0.95)
  const g4Cx = 50
  const g4Cy = 50
  const g4R = 9

  // Gears only turn when something engages them — main gear turns
  // when g > 0.2 (second gear engaged), others turn with their own
  // engagement thresholds
  const mainShouldTurn = animate && g > 0.2
  const g2ShouldTurn = animate && g > 0.25
  const g3ShouldTurn = animate && g > 0.55
  const g4ShouldTurn = animate && g > 0.8

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <radialGradient id={`coll-gear-${seed}`} cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor={palette.accent} />
          <stop offset="55%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.dark} />
        </radialGradient>
        <radialGradient id={`coll-gear2-${seed}`} cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.85" />
          <stop offset="55%" stopColor={palette.accent} />
          <stop offset="100%" stopColor={palette.dark} />
        </radialGradient>
        <radialGradient id={`coll-hub-${seed}`} cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.5" />
          <stop offset="100%" stopColor={palette.dark} />
        </radialGradient>
      </defs>

      {/* Cast shadow under the assembly */}
      <ellipse cx="85" cy="138" rx="55" ry="6" fill={`url(#${fid.ground})`} />

      {/* Main gear */}
      <Gear
        cx={mainCx}
        cy={mainCy}
        r={mainR}
        teeth={12}
        fill={`url(#coll-gear-${seed})`}
        hubFill={`url(#coll-hub-${seed})`}
        spokeStroke={palette.bg}
        animateRotation={mainShouldTurn ? { dur: '8s', direction: 1 } : undefined}
        filterId={fid.drop}
      />

      {/* Second gear */}
      {g2Visibility > 0.01 && (
        <g opacity={g2Visibility}>
          <Gear
            cx={g2Cx}
            cy={g2Cy}
            r={g2R}
            teeth={10}
            fill={`url(#coll-gear2-${seed})`}
            hubFill={`url(#coll-hub-${seed})`}
            spokeStroke={palette.bg}
            animateRotation={g2ShouldTurn ? { dur: '6s', direction: -1 } : undefined}
            filterId={fid.drop}
          />
        </g>
      )}

      {/* Third gear */}
      {g3Visibility > 0.01 && (
        <g opacity={g3Visibility}>
          <Gear
            cx={g3Cx}
            cy={g3Cy}
            r={g3R}
            teeth={8}
            fill={`url(#coll-gear-${seed})`}
            hubFill={`url(#coll-hub-${seed})`}
            spokeStroke={palette.bg}
            animateRotation={g3ShouldTurn ? { dur: '4.5s', direction: 1 } : undefined}
            filterId={fid.drop}
          />
        </g>
      )}

      {/* Fourth gear */}
      {g4Visibility > 0.01 && (
        <g opacity={g4Visibility}>
          <Gear
            cx={g4Cx}
            cy={g4Cy}
            r={g4R}
            teeth={8}
            fill={`url(#coll-gear2-${seed})`}
            hubFill={`url(#coll-hub-${seed})`}
            spokeStroke={palette.bg}
            animateRotation={g4ShouldTurn ? { dur: '3.5s', direction: -1 } : undefined}
            filterId={fid.drop}
          />
        </g>
      )}

      {/* Tiny "moving" spark where gears mesh — high-density indicator */}
      {g > 0.55 && density > 0.3 && (
        <g filter={`url(#${fid.glow})`} opacity={density}>
          <circle cx={(mainCx + g2Cx) / 2 + 4} cy={(mainCy + g2Cy) / 2 + 4} r="1.5" fill={palette.accent}>
            {animate && (
              <animate attributeName="opacity" values="0;1;0" dur="1.2s" repeatCount="indefinite" />
            )}
          </circle>
        </g>
      )}
    </svg>
  )
}

/** A single gear with teeth and a center hub. */
function Gear({
  cx,
  cy,
  r,
  teeth,
  fill,
  hubFill,
  spokeStroke,
  animateRotation,
  filterId,
}: {
  cx: number
  cy: number
  r: number
  teeth: number
  fill: string
  hubFill: string
  spokeStroke: string
  animateRotation?: { dur: string; direction: 1 | -1 }
  filterId: string
}) {
  // Generate gear silhouette: alternating outer (tooth) and inner (gap)
  // radii around the circle.
  const toothDepth = r * 0.18
  const innerR = r - toothDepth
  const pts: string[] = []
  const segments = teeth * 2
  // Tooth top arc — flat top with rounded shoulders
  for (let i = 0; i < segments; i++) {
    const onTooth = i % 2 === 0
    const rad = onTooth ? r : innerR
    const ang0 = ((i - 0.35) / segments) * Math.PI * 2
    const ang1 = ((i + 0.35) / segments) * Math.PI * 2
    pts.push(`${cx + Math.cos(ang0) * rad},${cy + Math.sin(ang0) * rad}`)
    pts.push(`${cx + Math.cos(ang1) * rad},${cy + Math.sin(ang1) * rad}`)
  }

  return (
    <g
      filter={`url(#${filterId})`}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      {animateRotation && (
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`0 ${cx} ${cy}`}
          to={`${360 * animateRotation.direction} ${cx} ${cy}`}
          dur={animateRotation.dur}
          repeatCount="indefinite"
        />
      )}
      {/* Gear body */}
      <polygon points={pts.join(' ')} fill={fill} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
      {/* Inner ring suggesting depth */}
      <circle cx={cx} cy={cy} r={innerR - 1.5} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
      {/* Spokes */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 8
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(a) * (innerR - 3)}
            y2={cy + Math.sin(a) * (innerR - 3)}
            stroke={spokeStroke}
            strokeWidth="2"
            opacity="0.65"
          />
        )
      })}
      {/* Center hub */}
      <circle cx={cx} cy={cy} r={r * 0.22} fill={hubFill} />
      <circle cx={cx - r * 0.07} cy={cy - r * 0.07} r={r * 0.08} fill="white" opacity="0.5" />
    </g>
  )
}

function fadeIn(g: number, start: number, end: number): number {
  if (g <= start) return 0
  if (g >= end) return 1
  const t = (g - start) / (end - start)
  return t * t * (3 - 2 * t)
}
