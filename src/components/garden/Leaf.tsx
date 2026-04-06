'use client'

import { CURRENT_QUARTER } from '@/lib/constants'

interface LeafProps {
  quarter: string
  size?: 'sm' | 'md'
  index?: number
  // For SVG inline rendering
  svg?: boolean
  cx?: number
  cy?: number
}

function getLeafOpacity(quarter: string): number {
  if (quarter === CURRENT_QUARTER) return 1
  if (quarter === 'Winter 2026') return 0.7
  return 0.4
}

function getLeafColor(quarter: string): string {
  if (quarter === CURRENT_QUARTER) return '#16a34a'
  if (quarter === 'Winter 2026') return '#4ade80'
  return '#86efac'
}

export function Leaf({ quarter, size = 'sm', index = 0, svg, cx = 0, cy = 0 }: LeafProps) {
  const opacity = getLeafOpacity(quarter)
  const color = getLeafColor(quarter)

  if (svg) {
    return (
      <ellipse
        cx={cx}
        cy={cy}
        rx={3}
        ry={1.5}
        fill={color}
        opacity={opacity}
        transform={`rotate(${(index || 0) * 30 - 45}, ${cx}, ${cy})`}
      />
    )
  }

  const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'

  return (
    <div
      className={`${sizeClass} rounded-full`}
      style={{ backgroundColor: color, opacity }}
      title={`Conversation from ${quarter}`}
    />
  )
}
