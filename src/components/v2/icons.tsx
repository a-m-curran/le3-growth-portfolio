/**
 * Minimal inline-SVG icon set for the v2 shell. Hand-picked from
 * commonly-needed UI verbs so we don't drag in a 500KB icon library
 * for a navigation skeleton.
 *
 * All icons use currentColor + stroke so they inherit the parent's
 * text color. Render at any size via className="w-5 h-5" etc.
 */

interface IconProps {
  className?: string
}

const baseProps = (className?: string) => ({
  className: className || 'w-5 h-5',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export function TodayIcon({ className }: IconProps) {
  return (
    <svg {...baseProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function GrowthIcon({ className }: IconProps) {
  // Three rising arcs of different heights — a small bar chart that
  // suggests progress without anchoring to a specific metaphor (plant,
  // mountain, etc). Lets the page name carry the abstraction.
  return (
    <svg {...baseProps(className)}>
      <path d="M4 20V14" />
      <path d="M10 20V10" />
      <path d="M16 20V6" />
      <path d="M22 20V4" />
      <path d="M3 20h20" />
    </svg>
  )
}

export function ReflectIcon({ className }: IconProps) {
  return (
    <svg {...baseProps(className)}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

export function JournalIcon({ className }: IconProps) {
  return (
    <svg {...baseProps(className)}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

export function MeIcon({ className }: IconProps) {
  return (
    <svg {...baseProps(className)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  )
}

export function CaseloadIcon({ className }: IconProps) {
  return (
    <svg {...baseProps(className)}>
      <circle cx="9" cy="8" r="3.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2 20c0-3 3-5 7-5s7 2 7 5" />
      <path d="M16 20c0-2.5 2-4 5-4" />
    </svg>
  )
}

export function ToolsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps(className)}>
      <path d="M14.7 6.3a4 4 0 1 0 4.6 4.6L21 13l-1 1-1.4-1.4a4 4 0 0 1-2 2L14 17l-1 1-2-2 1-1 2.4-2.6a4 4 0 0 1 2-2L17 8.5z" />
      <path d="M9 11l-6 6 3 3 6-6" />
    </svg>
  )
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...baseProps(className)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function NarrativeIcon({ className }: IconProps) {
  // Open book — a story unfolding. Two facing pages with a spine.
  return (
    <svg {...baseProps(className)}>
      <path d="M3 5.5a1.5 1.5 0 0 1 1.5-1.5H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4.5A1.5 1.5 0 0 1 3 15.5z" />
      <path d="M21 5.5a1.5 1.5 0 0 0-1.5-1.5H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </svg>
  )
}

export function DemoIcon({ className }: IconProps) {
  // Two head silhouettes side-by-side — a persona switcher feel
  return (
    <svg {...baseProps(className)}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
      <path d="M14 20c0-2.5 2-4 5-4" />
      <path d="M19 4l-2 3M19 4l2 3" />
    </svg>
  )
}

export function CareerIcon({ className }: IconProps) {
  // Briefcase — concrete and unambiguous "professional/career"
  return (
    <svg {...baseProps(className)}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  )
}

export function MoreIcon({ className }: IconProps) {
  return (
    <svg {...baseProps(className)}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
