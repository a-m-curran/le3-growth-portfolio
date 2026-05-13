import type { ComponentType } from 'react'
import {
  TodayIcon,
  GrowthIcon,
  ReflectIcon,
  JournalIcon,
  MeIcon,
  CaseloadIcon,
  ToolsIcon,
} from './icons'

/**
 * Single source of truth for the v2 sidebar / bottom-tab-bar
 * navigation. Add/remove items here rather than in the components.
 *
 * Each entry:
 *   key   — stable identifier; also used for path matching
 *   label — visible text in both sidebar and tab bar
 *   href  — destination route
 *   icon  — inline SVG icon component (see icons.tsx)
 *   admin — if true, only renders when current user is in ADMIN_EMAILS
 */

export interface NavItem {
  key: string
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  admin?: boolean
}

export const STUDENT_NAV: NavItem[] = [
  { key: 'today', label: 'Today', href: '/v2/today', icon: TodayIcon },
  { key: 'growth', label: 'Growth', href: '/v2/growth', icon: GrowthIcon },
  { key: 'reflect', label: 'Reflect', href: '/v2/reflect', icon: ReflectIcon },
  { key: 'journal', label: 'Journal', href: '/v2/journal', icon: JournalIcon },
  { key: 'me', label: 'Me', href: '/v2/me', icon: MeIcon },
]

export const COACH_NAV: NavItem[] = [
  { key: 'today', label: 'Today', href: '/v2/coach', icon: TodayIcon },
  { key: 'caseload', label: 'Caseload', href: '/v2/coach/caseload', icon: CaseloadIcon },
  { key: 'tools', label: 'Tools', href: '/v2/coach/tools', icon: ToolsIcon, admin: true },
  { key: 'me', label: 'Me', href: '/v2/me', icon: MeIcon },
]

/**
 * Match the current path to a nav item key so the shell can highlight
 * the active item. Returns null if no match (e.g. when on a coach
 * student-detail page that doesn't have its own nav entry).
 */
export function activeNavKey(path: string, items: NavItem[]): string | null {
  // Sort by href length descending so /v2/coach/tools matches before /v2/coach
  const sorted = [...items].sort((a, b) => b.href.length - a.href.length)
  for (const item of sorted) {
    if (path === item.href || path.startsWith(item.href + '/')) {
      return item.key
    }
  }
  return null
}
