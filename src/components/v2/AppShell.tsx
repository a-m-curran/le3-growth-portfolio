'use client'

import type { ReactNode } from 'react'
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

      <main className="flex-1 min-w-0 pb-16 md:pb-0">
        {/* pb-16 reserves space for the bottom tab bar on mobile so
            the last item in a scrolling list isn't hidden behind it */}
        {children}
      </main>

      <BottomTabBar items={items} showAdmin={showAdmin} />
    </div>
  )
}
