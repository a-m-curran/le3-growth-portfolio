'use client'

import type { GardenPlant } from '@/lib/types'
import { SDT_LEVELS, CURRENT_QUARTER } from '@/lib/constants'

interface Props {
  plant: GardenPlant
  onClick: () => void
}

const MOUNTAIN_LEVELS = {
  1: 'Trailhead',
  2: 'Lower Trail',
  3: 'Basecamp',
  4: 'Summit Ridge',
  5: 'Summit',
} as const

function getMarkerColor(quarter: string): { fill: string; opacity: number } {
  if (quarter === CURRENT_QUARTER) return { fill: '#DC2626', opacity: 1 }
  if (quarter.includes('Winter 2026')) return { fill: '#F97316', opacity: 0.8 }
  return { fill: '#F59E0B', opacity: 0.5 }
}

export function MountainPeak({ plant, onClick }: Props) {
  const level = plant.sdtLevel as 1 | 2 | 3 | 4 | 5
  const config = SDT_LEVELS[level]
  const levelName = MOUNTAIN_LEVELS[level]

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/60 transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      aria-label={`${plant.skillName}: ${levelName}, ${plant.conversationCount} conversations`}
    >
      <div className="relative w-24 h-32">
        <svg viewBox="0 0 100 140" className="w-full h-full">
          {/* Ground */}
          <rect x="5" y="128" width="90" height="4" rx="2" fill="#7c5d3a" opacity="0.3" />

          {level === 1 && <TrailheadMountain />}
          {level === 2 && <LowerTrailMountain />}
          {level === 3 && <BasecampMountain conversations={plant.conversations} />}
          {level === 4 && <SummitRidgeMountain conversations={plant.conversations} />}
          {level === 5 && <SummitMountain conversations={plant.conversations} />}
        </svg>
      </div>

      <div className="text-center max-w-[120px]">
        <div className="text-xs font-medium text-green-900 group-hover:text-green-700">
          {plant.skillName}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: config.color }}>
          {levelName}
        </div>
      </div>

      {plant.currentDefinition && (
        <div className="text-[10px] text-gray-500 max-w-[140px] text-center leading-tight line-clamp-3">
          &ldquo;{plant.currentDefinition.substring(0, 80)}
          {plant.currentDefinition.length > 80 ? '...' : ''}&rdquo;
          {plant.definitionRevised && (
            <span className="block text-green-600 mt-0.5">&#x2191; Revised</span>
          )}
        </div>
      )}
    </button>
  )
}

// ─── LEVEL 1: TRAILHEAD ──────────────────────────────
function TrailheadMountain() {
  return (
    <g>
      {/* Small foothill */}
      <polygon points="30,128 50,105 70,128" fill="#94A3B8" opacity="0.6" />
      <polygon points="25,128 50,108 75,128" fill="none" stroke="#94A3B8" strokeWidth="1" opacity="0.4" />
      {/* Trail sign */}
      <line x1="50" y1="128" x2="50" y2="118" stroke="#92400E" strokeWidth="1.5" />
      <rect x="45" y="115" width="10" height="6" rx="1" fill="#92400E" opacity="0.7" />
    </g>
  )
}

// ─── LEVEL 2: LOWER TRAIL ────────────────────────────
function LowerTrailMountain() {
  return (
    <g>
      {/* Low hill */}
      <polygon points="20,128 50,85 80,128" fill="#64748B" opacity="0.5" />
      <polygon points="25,128 50,90 75,128" fill="#94A3B8" opacity="0.3" />
      {/* Faint trail path */}
      <path d="M35,128 Q40,115 45,110 Q50,105 50,95" stroke="#92400E" strokeWidth="1" fill="none" strokeDasharray="3,3" opacity="0.5" />
      {/* Small rocks */}
      <circle cx="38" cy="120" r="2" fill="#94A3B8" opacity="0.4" />
      <circle cx="62" cy="122" r="1.5" fill="#94A3B8" opacity="0.4" />
    </g>
  )
}

// ─── LEVEL 3: BASECAMP ───────────────────────────────
function BasecampMountain({ conversations }: { conversations: { id: string; quarter: string }[] }) {
  return (
    <g>
      {/* Medium mountain */}
      <polygon points="15,128 50,65 85,128" fill="#475569" opacity="0.5" />
      <polygon points="20,128 50,70 80,128" fill="#64748B" opacity="0.4" />
      {/* Ridge detail */}
      <polygon points="60,128 75,85 90,128" fill="#475569" opacity="0.3" />
      {/* Clear trail */}
      <path d="M30,128 Q35,115 40,108 Q45,100 48,90 Q50,80 50,72" stroke="#92400E" strokeWidth="1.5" fill="none" strokeDasharray="4,2" />
      {/* Basecamp tent */}
      <polygon points="44,95 50,88 56,95" fill="#F59E0B" opacity="0.8" />
      <line x1="44" y1="95" x2="56" y2="95" stroke="#92400E" strokeWidth="0.5" />
      {/* Trees at base */}
      <polygon points="25,128 27,118 29,128" fill="#22C55E" opacity="0.5" />
      <polygon points="70,128 72,120 74,128" fill="#22C55E" opacity="0.5" />
      {/* Trail markers */}
      {conversations.slice(0, 6).map((conv, i) => {
        const { fill, opacity } = getMarkerColor(conv.quarter)
        const y = 120 - i * 8
        const x = 32 + (i % 2) * 6
        return <polygon key={conv.id} points={`${x},${y} ${x+2},${y-5} ${x+4},${y}`} fill={fill} opacity={opacity} />
      })}
    </g>
  )
}

// ─── LEVEL 4: SUMMIT RIDGE ───────────────────────────
function SummitRidgeMountain({ conversations }: { conversations: { id: string; quarter: string }[] }) {
  return (
    <g>
      {/* Tall peak */}
      <polygon points="10,128 50,45 90,128" fill="#334155" opacity="0.5" />
      <polygon points="15,128 50,50 85,128" fill="#475569" opacity="0.4" />
      {/* Secondary ridge */}
      <polygon points="55,128 72,75 90,128" fill="#334155" opacity="0.3" />
      {/* Trail winding up */}
      <path d="M25,128 Q30,115 35,108 Q42,95 45,85 Q48,75 49,65 Q50,55 50,50" stroke="#92400E" strokeWidth="1.5" fill="none" strokeDasharray="4,2" />
      {/* Flag near summit */}
      <line x1="52" y1="55" x2="52" y2="45" stroke="#92400E" strokeWidth="1.5" />
      <polygon points="52,45 60,48 52,51" fill="#DC2626" opacity="0.9" />
      {/* Trees at base */}
      <polygon points="20,128 23,116 26,128" fill="#22C55E" opacity="0.5" />
      <polygon points="72,128 74,119 76,128" fill="#22C55E" opacity="0.5" />
      <polygon points="78,128 80,121 82,128" fill="#22C55E" opacity="0.4" />
      {/* Trail markers */}
      {conversations.slice(0, 8).map((conv, i) => {
        const { fill, opacity } = getMarkerColor(conv.quarter)
        const y = 118 - i * 8
        const x = 28 + (i % 2) * 8
        return <polygon key={conv.id} points={`${x},${y} ${x+2},${y-5} ${x+4},${y}`} fill={fill} opacity={opacity} />
      })}
    </g>
  )
}

// ─── LEVEL 5: SUMMIT ─────────────────────────────────
function SummitMountain({ conversations }: { conversations: { id: string; quarter: string }[] }) {
  return (
    <g>
      {/* Sun behind peak */}
      <circle cx="55" cy="25" r="12" fill="#FCD34D" opacity="0.3" />
      <circle cx="55" cy="25" r="8" fill="#FCD34D" opacity="0.2" />
      {/* Full mountain */}
      <polygon points="5,128 50,30 95,128" fill="#1E293B" opacity="0.5" />
      <polygon points="10,128 50,35 90,128" fill="#334155" opacity="0.4" />
      {/* Secondary peaks */}
      <polygon points="55,128 70,65 90,128" fill="#1E293B" opacity="0.3" />
      <polygon points="0,128 20,80 40,128" fill="#334155" opacity="0.25" />
      {/* Snow cap */}
      <polygon points="42,50 50,33 58,50" fill="#FFFFFF" opacity="0.7" />
      <polygon points="44,55 50,38 56,55" fill="#E2E8F0" opacity="0.4" />
      {/* Trail to summit */}
      <path d="M20,128 Q25,115 30,105 Q38,90 42,78 Q46,65 48,55 Q49,45 50,35" stroke="#92400E" strokeWidth="1.5" fill="none" strokeDasharray="4,2" />
      {/* Summit flag */}
      <line x1="50" y1="35" x2="50" y2="22" stroke="#92400E" strokeWidth="2" />
      <polygon points="50,22 62,26 50,30" fill="#DC2626" />
      {/* Trees at base */}
      <polygon points="15,128 18,115 21,128" fill="#22C55E" opacity="0.5" />
      <polygon points="75,128 77,118 79,128" fill="#22C55E" opacity="0.5" />
      <polygon points="82,128 84,120 86,128" fill="#22C55E" opacity="0.4" />
      {/* Trail markers */}
      {conversations.slice(0, 10).map((conv, i) => {
        const { fill, opacity } = getMarkerColor(conv.quarter)
        const y = 120 - i * 8
        const x = 22 + (i % 3) * 6
        return <polygon key={conv.id} points={`${x},${y} ${x+2},${y-5} ${x+4},${y}`} fill={fill} opacity={opacity} />
      })}
    </g>
  )
}
