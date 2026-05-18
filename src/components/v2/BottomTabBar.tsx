'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { activeNavKey, type NavItem } from './nav-config'
import { MoreIcon } from './icons'

interface BottomTabBarProps {
  items: NavItem[]
  showAdmin?: boolean
}

/**
 * Mobile bottom tab bar (visible only below md, <768px).
 *
 * If the role-specific nav (after the admin filter) is ≤5 items, all
 * render exactly as before. If >5, the first 4 render as tabs and a
 * 5th "More" tab opens a dismissable sheet with the overflow — so
 * every item (e.g. student Career/Me) stays reachable. Primary vs
 * overflow is deterministic by nav-config order. The desktop Sidebar
 * (no cap) is unaffected.
 *
 * Safe-area-inset-bottom for iOS PWAs once we add a manifest.
 */
export function BottomTabBar({ items, showAdmin = false }: BottomTabBarProps) {
  const pathname = usePathname()
  const activeKey = activeNavKey(pathname, items)
  const [moreOpen, setMoreOpen] = useState(false)

  const filtered = items.filter(i => !i.admin || showAdmin)

  // ≤5: render all, exactly as before (no "More").
  if (filtered.length <= 5) {
    return (
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {filtered.map(item => (
          <TabLink key={item.key} item={item} active={item.key === activeKey} />
        ))}
      </nav>
    )
  }

  // >5: first 4 tabs + a "More" tab opening an overflow sheet.
  const primary = filtered.slice(0, 4)
  const overflow = filtered.slice(4)
  const overflowActive = overflow.some(i => i.key === activeKey)

  return (
    <>
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white border-t border-gray-200 rounded-t-2xl shadow-xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="text-sm text-gray-400 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <ul className="py-1">
              {overflow.map(item => {
                const Icon = item.icon
                const isActive = item.key === activeKey
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        isActive
                          ? 'text-green-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {primary.map(item => (
          <TabLink key={item.key} item={item} active={item.key === activeKey} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(o => !o)}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
            moreOpen || overflowActive
              ? 'text-green-700'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <MoreIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </>
  )
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
        active ? 'text-green-700' : 'text-gray-400 hover:text-gray-700'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium">{item.label}</span>
    </Link>
  )
}
