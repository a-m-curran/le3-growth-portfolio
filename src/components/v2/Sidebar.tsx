'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { activeNavKey, type NavItem } from './nav-config'

interface SidebarProps {
  /** Used to pick the brand link target (/v2/coach vs /v2/today). */
  role: 'student' | 'coach'
  /** Display name shown below the brand block. */
  userName: string
  /** Sub-label under the name (cohort, role, etc.). */
  userSubLabel?: string | null
  /** Nav items to render. */
  items: NavItem[]
  /** Whether the current viewer is allowed to see admin-flagged items. */
  showAdmin?: boolean
  /** Optional slot rendered between user info and nav (coach student picker). */
  belowUser?: React.ReactNode
}

/**
 * Desktop left sidebar. Single source of navigation truth on desktop
 * (≥768px). Hidden on mobile in favor of the bottom tab bar.
 *
 * Layout:
 *   sticky position, full viewport height, so it stays put as the
 *   content area scrolls. Internal column flexes so the nav scrolls
 *   independently if it ever overflows.
 *
 *   ┌─────────────────────┐
 *   │ Brand               │ ← NLU logo + product name (link to home)
 *   ├─────────────────────┤
 *   │ User block          │ ← avatar + name + sub-label
 *   ├─────────────────────┤
 *   │ Below-user slot     │ ← coach: student picker
 *   ├─────────────────────┤
 *   │ Nav (scrolls)       │ ← Today, Growth, Reflect, ...
 *   ├─────────────────────┤
 *   │ Sign out            │
 *   └─────────────────────┘
 */
export function Sidebar({
  role,
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
    <aside
      className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:border-r md:border-gray-200 md:bg-white md:sticky md:top-0 md:h-screen md:self-start"
    >
      {/* Brand block — NLU logo + product name. Click → role-appropriate home. */}
      <Link
        href={role === 'coach' ? '/v2/coach' : '/v2/today'}
        className="block px-4 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nlu-logo.svg"
            alt="National Louis University"
            className="h-7 w-auto opacity-80 shrink-0"
          />
        </div>
        <div className="mt-2 text-[13px] font-semibold text-green-900 leading-tight">
          LE3 Growth Portfolio
        </div>
      </Link>

      {/* User block */}
      <div className="px-4 py-4 border-b border-gray-100">
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
      <nav className="flex-1 min-h-0 px-2 py-3 space-y-0.5 overflow-y-auto">
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

      {/* Footer slot */}
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
