'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { activeNavKey, type NavItem } from './nav-config'

interface SidebarProps {
  /** Display name shown at the top */
  userName: string
  /** Sub-label under the name (cohort, role, etc.) */
  userSubLabel?: string | null
  /** Items to render */
  items: NavItem[]
  /** Whether the current viewer is allowed to see admin-flagged items */
  showAdmin?: boolean
  /** Optional slot rendered between user info and nav (e.g. student picker for coach) */
  belowUser?: React.ReactNode
}

/**
 * Desktop left sidebar. Fixed width, full height, single source of
 * navigation truth on desktop (≥768px).
 *
 * Visually:
 *   - white bg, subtle right border
 *   - user info up top (name + sub-label + avatar circle)
 *   - optional `belowUser` slot (coach uses this for student picker)
 *   - nav list (active item highlighted green)
 *
 * No collapse/expand toggle in Phase 0 — that's a Phase 1 polish.
 */
export function Sidebar({
  userName,
  userSubLabel,
  items,
  showAdmin = false,
  belowUser,
}: SidebarProps) {
  const pathname = usePathname()
  const activeKey = activeNavKey(pathname, items)
  const visibleItems = items.filter(i => !i.admin || showAdmin)

  return (
    <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:border-r md:border-gray-200 md:bg-white">
      {/* User block */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-sm font-semibold">
            {initials(userName)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">
              {userName}
            </div>
            {userSubLabel && (
              <div className="text-xs text-gray-500 truncate">{userSubLabel}</div>
            )}
          </div>
        </div>
      </div>

      {/* Optional below-user slot (coach student picker, etc.) */}
      {belowUser && (
        <div className="px-3 py-3 border-b border-gray-100">{belowUser}</div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map(item => {
          const isActive = item.key === activeKey
          const Icon = item.icon
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-green-50 text-green-800 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${
                  isActive ? 'text-green-700' : 'text-gray-400'
                }`}
              />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer slot (sign out etc. — Phase 1) */}
      <div className="px-3 py-3 border-t border-gray-100">
        <Link
          href="/login"
          className="text-xs text-gray-500 hover:text-gray-800"
        >
          Sign out
        </Link>
      </div>
    </aside>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() || '')
    .join('')
}
