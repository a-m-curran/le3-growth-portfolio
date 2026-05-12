'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { activeNavKey, type NavItem } from './nav-config'

interface BottomTabBarProps {
  items: NavItem[]
  showAdmin?: boolean
}

/**
 * Mobile bottom tab bar. Visible only below md breakpoint (<768px).
 *
 * Capped at ~5 visible items. If the role-specific nav has more, the
 * overflow goes elsewhere (settings menu, etc.) — but for current
 * student (5) and coach (4) navs, everything fits.
 *
 * Safe-area-inset-bottom for iOS PWAs once we add a manifest.
 */
export function BottomTabBar({ items, showAdmin = false }: BottomTabBarProps) {
  const pathname = usePathname()
  const activeKey = activeNavKey(pathname, items)
  const visibleItems = items.filter(i => !i.admin || showAdmin).slice(0, 5)

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {visibleItems.map(item => {
        const isActive = item.key === activeKey
        const Icon = item.icon
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
              isActive ? 'text-green-700' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
