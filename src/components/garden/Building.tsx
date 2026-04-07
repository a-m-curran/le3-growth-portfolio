'use client'

import type { GardenPlant } from '@/lib/types'
import { SDT_LEVELS, CURRENT_QUARTER } from '@/lib/constants'

interface Props {
  plant: GardenPlant
  onClick: () => void
}

const BUILDING_LEVELS = {
  1: 'Foundation',
  2: 'Under Construction',
  3: 'Mid-Rise',
  4: 'High-Rise',
  5: 'Landmark',
} as const

function getWindowColor(quarter: string): { fill: string; opacity: number } {
  if (quarter === CURRENT_QUARTER) return { fill: '#FCD34D', opacity: 1 }
  if (quarter.includes('Winter 2026')) return { fill: '#F59E0B', opacity: 0.7 }
  return { fill: '#D97706', opacity: 0.4 }
}

export function Building({ plant, onClick }: Props) {
  const level = plant.sdtLevel as 1 | 2 | 3 | 4 | 5
  const config = SDT_LEVELS[level]
  const levelName = BUILDING_LEVELS[level]

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/60 transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      aria-label={`${plant.skillName}: ${levelName}, ${plant.conversationCount} conversations`}
    >
      <div className="relative w-24 h-32">
        <svg viewBox="0 0 100 140" className="w-full h-full">
          {/* Ground / pavement */}
          <rect x="0" y="128" width="100" height="6" fill="#1E293B" opacity="0.4" />
          <line x1="0" y1="128" x2="100" y2="128" stroke="#475569" strokeWidth="0.5" />

          {level === 1 && <FoundationBuilding />}
          {level === 2 && <ConstructionBuilding conversations={plant.conversations} />}
          {level === 3 && <MidRiseBuilding conversations={plant.conversations} />}
          {level === 4 && <HighRiseBuilding conversations={plant.conversations} />}
          {level === 5 && <LandmarkBuilding conversations={plant.conversations} />}
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

// ─── LEVEL 1: FOUNDATION ─────────────────────────────
function FoundationBuilding() {
  return (
    <g>
      {/* Foundation slab */}
      <rect x="25" y="120" width="50" height="8" fill="#475569" opacity="0.5" />
      {/* Stakes */}
      <line x1="30" y1="128" x2="30" y2="115" stroke="#94A3B8" strokeWidth="1" />
      <line x1="50" y1="128" x2="50" y2="115" stroke="#94A3B8" strokeWidth="1" />
      <line x1="70" y1="128" x2="70" y2="115" stroke="#94A3B8" strokeWidth="1" />
      {/* String between stakes */}
      <line x1="30" y1="115" x2="70" y2="115" stroke="#F59E0B" strokeWidth="0.5" strokeDasharray="2,2" />
      {/* Dirt pile */}
      <ellipse cx="50" cy="122" rx="15" ry="3" fill="#7c5d3a" opacity="0.3" />
    </g>
  )
}

// ─── LEVEL 2: UNDER CONSTRUCTION ─────────────────────
function ConstructionBuilding({ conversations }: { conversations: { id: string; quarter: string }[] }) {
  return (
    <g>
      {/* Small structure */}
      <rect x="30" y="100" width="40" height="28" fill="#475569" />
      <rect x="30" y="100" width="40" height="28" fill="none" stroke="#64748B" strokeWidth="0.5" />
      {/* Scaffolding */}
      <line x1="28" y1="128" x2="28" y2="95" stroke="#94A3B8" strokeWidth="1" opacity="0.6" />
      <line x1="72" y1="128" x2="72" y2="95" stroke="#94A3B8" strokeWidth="1" opacity="0.6" />
      <line x1="28" y1="100" x2="72" y2="100" stroke="#94A3B8" strokeWidth="0.5" opacity="0.4" />
      <line x1="28" y1="110" x2="72" y2="110" stroke="#94A3B8" strokeWidth="0.5" opacity="0.4" />
      {/* Crane */}
      <line x1="65" y1="100" x2="65" y2="80" stroke="#94A3B8" strokeWidth="1.5" />
      <line x1="55" y1="80" x2="75" y2="80" stroke="#94A3B8" strokeWidth="1" />
      <line x1="57" y1="80" x2="57" y2="85" stroke="#94A3B8" strokeWidth="0.5" />
      {/* Door */}
      <rect x="44" y="116" width="12" height="12" fill="#334155" />
      {/* Windows (conversations) */}
      {conversations.slice(0, 4).map((conv, i) => {
        const { fill, opacity } = getWindowColor(conv.quarter)
        const x = 34 + (i % 2) * 20
        const y = 104 + Math.floor(i / 2) * 10
        return <rect key={conv.id} x={x} y={y} width="6" height="5" fill={fill} opacity={opacity} rx="0.5" />
      })}
    </g>
  )
}

// ─── LEVEL 3: MID-RISE ───────────────────────────────
function MidRiseBuilding({ conversations }: { conversations: { id: string; quarter: string }[] }) {
  return (
    <g>
      {/* 3-story building */}
      <rect x="28" y="75" width="44" height="53" fill="#475569" />
      <rect x="28" y="75" width="44" height="53" fill="none" stroke="#64748B" strokeWidth="0.5" />
      {/* Roof */}
      <rect x="26" y="73" width="48" height="4" fill="#334155" />
      {/* Floor lines */}
      <line x1="28" y1="93" x2="72" y2="93" stroke="#334155" strokeWidth="0.5" />
      <line x1="28" y1="110" x2="72" y2="110" stroke="#334155" strokeWidth="0.5" />
      {/* Door */}
      <rect x="44" y="116" width="12" height="12" fill="#334155" />
      <circle cx="54" cy="122" r="1" fill="#94A3B8" />
      {/* Window grid (3 rows x 3 cols) */}
      {[0,1,2].map(row => [0,1,2].map(col => {
        const x = 33 + col * 13
        const y = 78 + row * 17
        const convIdx = row * 3 + col
        const conv = conversations[convIdx]
        const { fill, opacity } = conv ? getWindowColor(conv.quarter) : { fill: '#334155', opacity: 0.6 }
        return <rect key={`${row}-${col}`} x={x} y={y} width="7" height="6" fill={fill} opacity={opacity} rx="0.5" />
      }))}
    </g>
  )
}

// ─── LEVEL 4: HIGH-RISE ──────────────────────────────
function HighRiseBuilding({ conversations }: { conversations: { id: string; quarter: string }[] }) {
  return (
    <g>
      {/* Tall building */}
      <rect x="30" y="45" width="40" height="83" fill="#475569" />
      <rect x="30" y="45" width="40" height="83" fill="none" stroke="#64748B" strokeWidth="0.5" />
      {/* Roof with antenna */}
      <rect x="28" y="43" width="44" height="4" fill="#334155" />
      <line x1="50" y1="43" x2="50" y2="35" stroke="#94A3B8" strokeWidth="1.5" />
      <circle cx="50" cy="34" r="2" fill="#EF4444" opacity="0.7" />
      {/* Floor lines */}
      {[60, 75, 90, 105, 118].map(y => (
        <line key={y} x1="30" y1={y} x2="70" y2={y} stroke="#334155" strokeWidth="0.3" />
      ))}
      {/* Door */}
      <rect x="44" y="118" width="12" height="10" fill="#334155" />
      {/* Window grid (5 rows x 3 cols) */}
      {[0,1,2,3,4].map(row => [0,1,2].map(col => {
        const x = 34 + col * 12
        const y = 48 + row * 15
        const convIdx = row * 3 + col
        const conv = conversations[convIdx]
        const { fill, opacity } = conv ? getWindowColor(conv.quarter) : { fill: '#334155', opacity: 0.4 }
        return <rect key={`${row}-${col}`} x={x} y={y} width="6" height="5" fill={fill} opacity={opacity} rx="0.5" />
      }))}
    </g>
  )
}

// ─── LEVEL 5: LANDMARK ───────────────────────────────
function LandmarkBuilding({ conversations }: { conversations: { id: string; quarter: string }[] }) {
  return (
    <g>
      {/* Beacon glow */}
      <circle cx="50" cy="18" r="10" fill="#FCD34D" opacity="0.15" />
      <circle cx="50" cy="18" r="6" fill="#FCD34D" opacity="0.1" />
      {/* Skyscraper */}
      <rect x="32" y="28" width="36" height="100" fill="#334155" />
      <rect x="32" y="28" width="36" height="100" fill="none" stroke="#475569" strokeWidth="0.5" />
      {/* Stepped top */}
      <rect x="36" y="22" width="28" height="8" fill="#334155" />
      <rect x="40" y="18" width="20" height="6" fill="#475569" />
      {/* Spire */}
      <line x1="50" y1="18" x2="50" y2="8" stroke="#94A3B8" strokeWidth="2" />
      <circle cx="50" cy="7" r="3" fill="#FCD34D" opacity="0.9" />
      <circle cx="50" cy="7" r="1.5" fill="#FFFFFF" opacity="0.8" />
      {/* Floor lines */}
      {[40, 52, 64, 76, 88, 100, 112].map(y => (
        <line key={y} x1="32" y1={y} x2="68" y2={y} stroke="#1E293B" strokeWidth="0.3" />
      ))}
      {/* Door with awning */}
      <rect x="43" y="118" width="14" height="10" fill="#1E293B" />
      <polygon points="41,118 50,114 59,118" fill="#475569" />
      {/* Window grid (7 rows x 3 cols) — lots of windows */}
      {[0,1,2,3,4,5,6].map(row => [0,1,2].map(col => {
        const x = 36 + col * 10
        const y = 30 + row * 13
        const convIdx = row * 3 + col
        const conv = conversations[convIdx]
        const { fill, opacity } = conv ? getWindowColor(conv.quarter) : { fill: '#1E293B', opacity: 0.3 }
        return <rect key={`${row}-${col}`} x={x} y={y} width="5" height="5" fill={fill} opacity={opacity} rx="0.5" />
      }))}
    </g>
  )
}
