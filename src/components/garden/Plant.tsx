'use client'

import type { GardenPlant } from '@/lib/types'
import { SDT_LEVELS } from '@/lib/constants'
import { Leaf } from './Leaf'

interface PlantProps {
  plant: GardenPlant
  onClick: () => void
}

export function Plant({ plant, onClick }: PlantProps) {
  const level = plant.sdtLevel as 1 | 2 | 3 | 4
  const config = SDT_LEVELS[level]

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/60 transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      aria-label={`${plant.skillName}: ${config.name} level, ${plant.conversationCount} conversations`}
    >
      <div className="relative w-24 h-32">
        <svg viewBox="0 0 100 140" className="w-full h-full">
          {/* Soil */}
          <ellipse cx="50" cy="130" rx="30" ry="6" fill="#7c5d3a" opacity="0.3" />

          {level === 1 && <NoticingPlant />}
          {level === 2 && <PracticingPlant />}
          {level === 3 && <IntegratingPlant conversations={plant.conversations} />}
          {level === 4 && <EvolvingPlant conversations={plant.conversations} />}
        </svg>

        {/* Conversation leaves overlaid */}
        {(level === 1 || level === 2) && plant.conversations.length > 0 && (
          <div className="absolute top-2 right-0 flex flex-col gap-0.5">
            {plant.conversations.slice(0, 4).map((conv, i) => (
              <Leaf key={conv.id} quarter={conv.quarter} size="sm" index={i} />
            ))}
          </div>
        )}
      </div>

      <div className="text-center max-w-[120px]">
        <div className="text-xs font-medium text-green-900 group-hover:text-green-700">
          {plant.skillName}
        </div>
        <div className="text-[10px] text-green-700 mt-0.5" style={{ color: config.color }}>
          {config.name}
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

function NoticingPlant() {
  return (
    <g>
      {/* Seed */}
      <ellipse cx="50" cy="120" rx="5" ry="4" fill="#7c5d3a" />
      {/* Tiny stem */}
      <line x1="50" y1="120" x2="50" y2="108" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
      {/* One tiny leaf bud */}
      <ellipse cx="53" cy="110" rx="4" ry="2" fill="#86efac" transform="rotate(-20, 53, 110)" />
    </g>
  )
}

function PracticingPlant() {
  return (
    <g>
      {/* Stem */}
      <path d="M50 128 Q50 90 50 70" stroke="#16a34a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Leaves along stem */}
      <ellipse cx="45" cy="100" rx="8" ry="4" fill="#4ade80" transform="rotate(-30, 45, 100)" />
      <ellipse cx="56" cy="90" rx="8" ry="4" fill="#4ade80" transform="rotate(25, 56, 90)" />
      <ellipse cx="44" cy="80" rx="7" ry="3.5" fill="#86efac" transform="rotate(-25, 44, 80)" />
      {/* Top leaf */}
      <ellipse cx="50" cy="68" rx="6" ry="3" fill="#86efac" transform="rotate(5, 50, 68)" />
    </g>
  )
}

function IntegratingPlant({ conversations }: { conversations: { id: string; quarter: string }[] }) {
  return (
    <g>
      {/* Main stem */}
      <path d="M50 128 Q50 85 50 50" stroke="#166534" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Left branch */}
      <path d="M50 80 Q35 70 25 60" stroke="#16a34a" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Right branch */}
      <path d="M50 75 Q65 65 72 55" stroke="#16a34a" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Main stem leaves */}
      <ellipse cx="43" cy="105" rx="9" ry="4.5" fill="#4ade80" transform="rotate(-30, 43, 105)" />
      <ellipse cx="58" cy="95" rx="9" ry="4.5" fill="#4ade80" transform="rotate(25, 58, 95)" />
      {/* Branch leaves */}
      <ellipse cx="28" cy="58" rx="8" ry="4" fill="#86efac" transform="rotate(-40, 28, 58)" />
      <ellipse cx="22" cy="65" rx="7" ry="3.5" fill="#4ade80" transform="rotate(-20, 22, 65)" />
      <ellipse cx="70" cy="53" rx="8" ry="4" fill="#86efac" transform="rotate(35, 70, 53)" />
      <ellipse cx="75" cy="60" rx="7" ry="3.5" fill="#4ade80" transform="rotate(20, 75, 60)" />
      {/* Small flowers */}
      <circle cx="50" cy="48" r="4" fill="#fbbf24" opacity="0.8" />
      <circle cx="50" cy="48" r="2" fill="#f59e0b" />
      {/* Conversation leaf indicators */}
      {conversations.slice(0, 6).map((conv, i) => {
        const angle = (i * 60) - 150
        const rad = (angle * Math.PI) / 180
        const cx = 50 + Math.cos(rad) * (15 + i * 3)
        const cy = 85 + Math.sin(rad) * 8 - i * 6
        return (
          <Leaf key={conv.id} quarter={conv.quarter} cx={cx} cy={cy} svg />
        )
      })}
    </g>
  )
}

function EvolvingPlant({ conversations }: { conversations: { id: string; quarter: string }[] }) {
  return (
    <g>
      {/* Thick main stem */}
      <path d="M50 128 Q48 80 50 40" stroke="#166534" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* Left branch */}
      <path d="M50 85 Q32 72 20 55" stroke="#166534" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Right branch */}
      <path d="M50 78 Q68 62 78 48" stroke="#166534" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Upper left branch */}
      <path d="M50 60 Q38 50 30 40" stroke="#16a34a" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Abundant leaves */}
      <ellipse cx="42" cy="108" rx="10" ry="5" fill="#4ade80" transform="rotate(-30, 42, 108)" />
      <ellipse cx="60" cy="98" rx="10" ry="5" fill="#4ade80" transform="rotate(25, 60, 98)" />
      <ellipse cx="38" cy="88" rx="9" ry="4.5" fill="#86efac" transform="rotate(-20, 38, 88)" />
      <ellipse cx="62" cy="78" rx="9" ry="4.5" fill="#86efac" transform="rotate(20, 62, 78)" />
      {/* Branch leaves */}
      <ellipse cx="22" cy="52" rx="9" ry="4.5" fill="#86efac" transform="rotate(-40, 22, 52)" />
      <ellipse cx="16" cy="60" rx="8" ry="4" fill="#4ade80" transform="rotate(-15, 16, 60)" />
      <ellipse cx="76" cy="46" rx="9" ry="4.5" fill="#86efac" transform="rotate(40, 76, 46)" />
      <ellipse cx="80" cy="54" rx="8" ry="4" fill="#4ade80" transform="rotate(15, 80, 54)" />
      <ellipse cx="32" cy="38" rx="7" ry="3.5" fill="#86efac" transform="rotate(-30, 32, 38)" />
      {/* Flowers/blooms */}
      <circle cx="50" cy="38" r="5" fill="#f472b6" opacity="0.9" />
      <circle cx="50" cy="38" r="2.5" fill="#ec4899" />
      <circle cx="20" cy="50" r="4" fill="#fbbf24" opacity="0.8" />
      <circle cx="20" cy="50" r="2" fill="#f59e0b" />
      <circle cx="78" cy="44" r="4" fill="#f472b6" opacity="0.8" />
      <circle cx="78" cy="44" r="2" fill="#ec4899" />
      <circle cx="30" cy="36" r="3.5" fill="#fbbf24" opacity="0.8" />
      <circle cx="30" cy="36" r="1.5" fill="#f59e0b" />
      {/* Conversation leaf indicators */}
      {conversations.slice(0, 8).map((conv, i) => {
        const angle = (i * 45) - 180
        const rad = (angle * Math.PI) / 180
        const cx = 50 + Math.cos(rad) * (18 + i * 2)
        const cy = 90 + Math.sin(rad) * 10 - i * 5
        return (
          <Leaf key={conv.id} quarter={conv.quarter} cx={cx} cy={cy} svg />
        )
      })}
    </g>
  )
}
