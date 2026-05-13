'use client'

import type { ArchetypeProps } from '../shared'
import { clamp01, artworkFilterIds } from '../shared'
import { ArtworkFilters } from '../ArtworkFilters'

/**
 * Communication — two speech bubbles facing each other.
 *
 * Why: communication is back-and-forth. Two bubbles facing each
 * other, content filling them over time, with small "message dots"
 * travelling between them — the universal "people talking" icon.
 *
 * Composition stages (continuous):
 *   g 0.00–0.20  empty bubble outlines
 *   g 0.20–0.50  left bubble fills with content lines
 *   g 0.50–0.80  both bubbles fill; message dots fly between them
 *   g 0.80–1.00  rich back-and-forth; bubbles overflow slightly
 *
 * Depth: bubbles use a subtle highlight on the upper-left edge
 * (paper-like quality); drop shadows lift them off the canvas;
 * "messages in transit" glow as they travel.
 */
export function CommunicationVisual({ growth, density, palette, seed, animate = true }: ArchetypeProps) {
  const fid = artworkFilterIds(seed)
  const g = clamp01(growth)

  // Two bubbles — left smaller (incoming), right larger (you)
  const leftCx = 48
  const leftCy = 68
  const leftW = 50
  const leftH = 36

  const rightCx = 108
  const rightCy = 92
  const rightW = 52
  const rightH = 38

  // Content lines visibility
  const leftLines = fadeIn(g, 0.15, 0.45)
  const rightLines = fadeIn(g, 0.4, 0.7)
  const messagesVisible = g > 0.5

  // Number of message dots flying between
  const messageCount = Math.floor(density * 4) + (g > 0.5 ? 1 : 0)

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
      <defs>
        <ArtworkFilters seed={seed} />
        <linearGradient id={`com-bubbleL-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor={palette.bg} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`com-bubbleR-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.bg} />
          <stop offset="100%" stopColor={palette.mid} stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id={`com-msg-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="50%" stopColor={palette.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft ground shadow under the conversation */}
      <ellipse cx="80" cy="140" rx="50" ry="5" fill={`url(#${fid.ground})`} />

      {/* Left bubble — incoming */}
      <g filter={`url(#${fid.drop})`}>
        <BubbleShape
          cx={leftCx}
          cy={leftCy}
          w={leftW}
          h={leftH}
          fill={`url(#com-bubbleL-${seed})`}
          stroke={palette.mid}
          tailSide="right"
        />
        {/* Upper-left specular highlight */}
        <path
          d={`M ${leftCx - leftW / 2 + 4} ${leftCy - leftH / 2 + 6} Q ${leftCx - leftW / 2 + 8} ${leftCy - leftH / 2 + 2} ${leftCx - leftW / 4} ${leftCy - leftH / 2 + 3}`}
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
      </g>

      {/* Left bubble content lines */}
      {leftLines > 0.01 && (
        <g opacity={leftLines}>
          <BubbleLines cx={leftCx} cy={leftCy} w={leftW} h={leftH} progress={leftLines} color={palette.dark} />
        </g>
      )}

      {/* Right bubble — yours */}
      <g filter={`url(#${fid.drop})`}>
        <BubbleShape
          cx={rightCx}
          cy={rightCy}
          w={rightW}
          h={rightH}
          fill={`url(#com-bubbleR-${seed})`}
          stroke={palette.dark}
          tailSide="left"
        />
        <path
          d={`M ${rightCx - rightW / 2 + 4} ${rightCy - rightH / 2 + 6} Q ${rightCx - rightW / 2 + 8} ${rightCy - rightH / 2 + 2} ${rightCx - rightW / 4} ${rightCy - rightH / 2 + 3}`}
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.55"
        />
      </g>

      {/* Right bubble content lines */}
      {rightLines > 0.01 && (
        <g opacity={rightLines}>
          <BubbleLines cx={rightCx} cy={rightCy} w={rightW} h={rightH} progress={rightLines} color={palette.dark} />
        </g>
      )}

      {/* Messages in transit — small glowing dots flying between bubbles */}
      {messagesVisible && (
        <g filter={`url(#${fid.glow})`}>
          {Array.from({ length: messageCount }, (_, i) => {
            // Some go left-to-right, some right-to-left
            const dir = i % 2 === 0 ? 1 : -1
            const startX = dir === 1 ? leftCx + leftW / 2 : rightCx - rightW / 2
            const endX = dir === 1 ? rightCx - rightW / 2 : leftCx + leftW / 2
            const startY = dir === 1 ? leftCy : rightCy
            const endY = dir === 1 ? rightCy : leftCy
            const delay = i * 0.6
            return (
              <circle key={i} r="2.5" fill={`url(#com-msg-${seed})`}>
                {animate ? (
                  <>
                    <animate
                      attributeName="cx"
                      values={`${startX};${endX}`}
                      dur="1.8s"
                      begin={`${delay}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="cy"
                      values={`${startY};${(startY + endY) / 2 - 6};${endY}`}
                      dur="1.8s"
                      begin={`${delay}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="1.8s"
                      begin={`${delay}s`}
                      repeatCount="indefinite"
                    />
                  </>
                ) : (
                  // Static: park the dot in the middle
                  <>
                    <set attributeName="cx" to={(startX + endX) / 2} />
                    <set attributeName="cy" to={(startY + endY) / 2 - 6} />
                    <set attributeName="opacity" to="0.9" />
                  </>
                )}
              </circle>
            )
          })}
        </g>
      )}
    </svg>
  )
}

/** A speech bubble — rounded rect with a tail on one side. */
function BubbleShape({
  cx,
  cy,
  w,
  h,
  fill,
  stroke,
  tailSide,
}: {
  cx: number
  cy: number
  w: number
  h: number
  fill: string
  stroke: string
  tailSide: 'left' | 'right'
}) {
  const left = cx - w / 2
  const top = cy - h / 2
  const right = cx + w / 2
  const bottom = cy + h / 2
  const r = 8
  // Tail anchors near the bottom of the bubble, pointing toward the
  // other bubble.
  const tailX = tailSide === 'right' ? right : left
  const tailDir = tailSide === 'right' ? 1 : -1
  return (
    <path
      d={`
        M ${left + r} ${top}
        L ${right - r} ${top}
        Q ${right} ${top} ${right} ${top + r}
        L ${right} ${bottom - r}
        Q ${right} ${bottom} ${right - r} ${bottom}
        L ${tailX + (tailSide === 'right' ? -r - 2 : r + 2)} ${bottom}
        L ${tailX + tailDir * 8} ${bottom + 8}
        L ${tailX + (tailSide === 'right' ? -r - 6 : r + 6)} ${bottom}
        L ${left + r} ${bottom}
        Q ${left} ${bottom} ${left} ${bottom - r}
        L ${left} ${top + r}
        Q ${left} ${top} ${left + r} ${top}
        Z
      `}
      fill={fill}
      stroke={stroke}
      strokeWidth="1.4"
      strokeOpacity="0.85"
    />
  )
}

/** Content lines that fill in as a bubble's text grows. */
function BubbleLines({
  cx,
  cy,
  w,
  h,
  progress,
  color,
}: {
  cx: number
  cy: number
  w: number
  h: number
  progress: number
  color: string
}) {
  const padding = 7
  const left = cx - w / 2 + padding
  const right = cx + w / 2 - padding
  const lineGap = 5
  const linesToShow = Math.min(4, Math.ceil(progress * 4))
  return (
    <g stroke={color} strokeWidth="1.8" strokeLinecap="round" opacity="0.55">
      {Array.from({ length: linesToShow }, (_, i) => {
        const y = cy - h / 2 + padding + 4 + i * lineGap
        // Last line is shorter — feels like real text
        const lineEnd = i === linesToShow - 1 ? left + (right - left) * 0.6 : right
        return <line key={i} x1={left} y1={y} x2={lineEnd} y2={y} />
      })}
    </g>
  )
}

function fadeIn(g: number, start: number, end: number): number {
  if (g <= start) return 0
  if (g >= end) return 1
  const t = (g - start) / (end - start)
  return t * t * (3 - 2 * t)
}
