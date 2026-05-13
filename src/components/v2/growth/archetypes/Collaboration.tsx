'use client'

import type { ArchetypeProps } from '../shared'
import { seededRandom, clamp01, lerp, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Collaboration — a mycelial network.
 *
 * Why: collaboration is what's happening underneath, even when you
 * can't see it. Mushroom networks span vast areas, sharing nutrients
 * between trees — invisible until you look for it. Each conversation
 * is another node that lights up in the network.
 *
 * Depth: network threads have varying opacities (closer/further);
 * nodes glow; pulses travel along threads (light moving through the
 * dark). Background gets a subtle dark tone so the glowing nodes
 * read as light sources, not just colored shapes.
 */
export function CollaborationVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const rand = seededRandom(seed)
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  // Generate a network of nodes — first one fixed near center, rest
  // scatter around it, with edges between nearby pairs
  const nodeCount = Math.round(lerp(4, 10, g))
  const center = { x: 80, y: 90 }
  const nodes: Array<{ x: number; y: number; lit: boolean; size: number }> = [
    { x: center.x, y: center.y, lit: true, size: 3.5 },
  ]
  for (let i = 1; i < nodeCount; i++) {
    const angle = rand() * Math.PI * 2
    const dist = lerp(20, 55, rand())
    nodes.push({
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist * 0.7,
      lit: i < Math.max(2, Math.round(lerp(2, nodeCount, density))),
      size: lerp(2, 3.2, rand()),
    })
  }

  // Edges: each non-center node connects back to a closer one
  const edges: Array<{ a: typeof nodes[0]; b: typeof nodes[0] }> = []
  for (let i = 1; i < nodes.length; i++) {
    // Find closest earlier node
    let closest = 0
    let minDist = Infinity
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
      if (d < minDist) {
        minDist = d
        closest = j
      }
    }
    edges.push({ a: nodes[i], b: nodes[closest] })
  }

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <radialGradient id={`coll-bg-${seed}`} cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor={palette.dark} stopOpacity="0.15" />
          <stop offset="100%" stopColor={palette.dark} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`coll-node-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="40%" stopColor={palette.accent} stopOpacity="1" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`coll-node-dim-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.mid} stopOpacity="0.7" />
          <stop offset="100%" stopColor={palette.mid} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Dark ground/underground gradient */}
      <rect x="0" y="0" width="160" height="160" fill={`url(#coll-bg-${seed})`} />

      {/* Edges — thin filaments */}
      <g stroke={palette.mid} strokeWidth="0.7" fill="none" strokeLinecap="round">
        {edges.map((e, i) => (
          <g key={i}>
            <path
              d={`M ${e.a.x} ${e.a.y} Q ${(e.a.x + e.b.x) / 2 + (rand() - 0.5) * 6} ${(e.a.y + e.b.y) / 2 + (rand() - 0.5) * 6}, ${e.b.x} ${e.b.y}`}
              opacity="0.55"
            />
          </g>
        ))}
      </g>

      {/* Pulses travelling along edges — small bright circles */}
      {animate &&
        edges.map((e, i) => (
          <circle key={i} r="1.6" fill={palette.accent} filter={`url(#${fid.glow})`}>
            <animateMotion
              path={`M ${e.a.x} ${e.a.y} Q ${(e.a.x + e.b.x) / 2} ${(e.a.y + e.b.y) / 2}, ${e.b.x} ${e.b.y}`}
              dur={`${2.5 + i * 0.4}s`}
              begin={`${i * 0.3}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur={`${2.5 + i * 0.4}s`}
              begin={`${i * 0.3}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}

      {/* Nodes — lit vs dim */}
      {nodes.map((n, i) => (
        <g key={i} filter={n.lit ? `url(#${fid.glow})` : undefined}>
          {n.lit ? (
            <>
              <circle cx={n.x} cy={n.y} r={n.size * 2.2} fill={`url(#coll-node-${seed})`} />
              <circle cx={n.x} cy={n.y} r={n.size * 0.7} fill="white">
                {animate && (
                  <animate
                    attributeName="opacity"
                    values="0.9;0.55;0.9"
                    dur={`${2 + (i % 3) * 0.3}s`}
                    repeatCount="indefinite"
                  />
                )}
              </circle>
            </>
          ) : (
            <circle cx={n.x} cy={n.y} r={n.size * 0.9} fill={`url(#coll-node-dim-${seed})`} />
          )}
        </g>
      ))}
    </svg>
  )
}
