'use client'

import { pillarStripeStyle } from '@/components/v2/PillarStripe'
import type { SubmissionItem, SubmissionStatus } from '@/components/v2/student/types'

/**
 * One row in the Reflect tree or Today buckets. Status glyph + title
 * + action chip. Click handling bubbles up to the parent (which knows
 * whether to open the interstitial, call /api/conversation/start, etc).
 *
 * surface="reflect": title stands alone (hierarchy provides course/week).
 * surface="today":   title gets " · courseName · Week N" muted suffix
 *                    (date-bucket context doesn't carry course/week).
 *
 * Pillar stripe is preserved for completed rows only.
 */

interface SubmissionRowProps {
  item: SubmissionItem
  surface: 'reflect' | 'today'
  onClick: (item: SubmissionItem) => void
}

const STATUS_GLYPH: Record<SubmissionStatus, { char: string; aria: string; chipLabel: string; chipClass: string }> = {
  unreflected: {
    char: '○',
    aria: 'Not yet reflected',
    chipLabel: 'Start',
    chipClass: 'text-blue-800 bg-blue-100',
  },
  in_progress: {
    char: '⏳',
    aria: 'Reflection in progress',
    chipLabel: 'Resume',
    chipClass: 'text-amber-800 bg-amber-100',
  },
  completed: {
    char: '✓',
    aria: 'Reflection complete',
    chipLabel: 'View',
    chipClass: 'text-emerald-800 bg-emerald-100',
  },
}

export function SubmissionRow({ item, surface, onClick }: SubmissionRowProps) {
  const g = STATUS_GLYPH[item.status]
  const stripeStyle = item.status === 'completed' ? pillarStripeStyle(item.primaryPillar) : undefined
  const suffix =
    surface === 'today'
      ? [item.courseName, item.weekNumber !== null ? `Week ${item.weekNumber}` : null]
          .filter((x): x is string => !!x)
          .join(' · ')
      : ''

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="w-full text-left flex items-center gap-3 pl-3 pr-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
      style={stripeStyle}
    >
      <span className="text-base shrink-0" aria-label={g.aria}>
        {g.char}
      </span>
      <span className="flex-1 min-w-0 text-sm text-gray-900 truncate">
        {item.title}
        {suffix && <span className="text-gray-500"> · {suffix}</span>}
      </span>
      <span
        className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${g.chipClass}`}
      >
        {g.chipLabel}
      </span>
    </button>
  )
}
