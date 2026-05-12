'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Sidebar } from './Sidebar'
import { BottomTabBar } from './BottomTabBar'
import { StudentPicker } from './StudentPicker'
import { STUDENT_NAV, COACH_NAV } from './nav-config'

interface AppShellProps {
  role: 'student' | 'coach'
  userName: string
  userSubLabel?: string | null
  /** True if current user is allowed to see admin-flagged nav items */
  showAdmin?: boolean
  children: ReactNode
}

/**
 * Top-level shell for the v2 IA exploration. Composes:
 *   - BrandBar (sticky top across all surfaces)
 *   - Sidebar (desktop ≥ md)
 *   - BottomTabBar (mobile < md)
 *   - Coach-only StudentPicker slotted into the sidebar
 *
 * Role determines which nav set renders. The shell itself doesn't
 * fetch data — the parent layout passes user info as props.
 */
export function AppShell({
  role,
  userName,
  userSubLabel,
  showAdmin = false,
  children,
}: AppShellProps) {
  const items = role === 'coach' ? COACH_NAV : STUDENT_NAV

  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900 antialiased">
      <Sidebar
        userName={userName}
        userSubLabel={userSubLabel}
        items={items}
        showAdmin={showAdmin}
        belowUser={role === 'coach' ? <StudentPicker /> : null}
      />

      <main className="flex-1 min-w-0 pb-16 md:pb-0 flex flex-col">
        <BrandBar role={role} />
        <div className="flex-1 min-w-0">
          {/* pb-16 reserves space for the bottom tab bar on mobile so
              the last item in a scrolling list isn't hidden behind it */}
          {children}
        </div>
      </main>

      <BottomTabBar items={items} showAdmin={showAdmin} />
    </div>
  )
}

/**
 * Subtle sticky brand strip across the top of every v2 surface.
 * Keeps the app identity present without competing with sidebar /
 * tab nav. Click navigates home (/v2).
 */
function BrandBar({ role }: { role: 'student' | 'coach' }) {
  return (
    <div className="sticky top-0 z-30 bg-white/85 backdrop-blur-sm border-b border-gray-200">
      <div className="flex items-center justify-between gap-3 px-6 py-2.5">
        <Link
          href={role === 'coach' ? '/v2/coach' : '/v2/today'}
          className="flex items-center gap-2 text-sm font-semibold text-green-900 hover:text-green-700 transition-colors"
        >
          <span aria-hidden="true">🌱</span>
          <span>LE3 Growth Portfolio</span>
        </Link>
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
          National Louis University
        </span>
      </div>
    </div>
  )
}
