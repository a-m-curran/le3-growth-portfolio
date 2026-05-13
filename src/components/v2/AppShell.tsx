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
 * Top-level shell for the v2 IA. Composes:
 *   - Sidebar (desktop ≥ md): sticky, full-height, holds brand + user
 *     + nav. Replaces the previous separate top brand bar so the
 *     content area gets the full viewport width minus the sidebar.
 *   - BottomTabBar (mobile < md): brand stays at the top of the page
 *     on mobile (rendered inside the sidebar's mobile branch) but
 *     primary nav lives at the bottom for thumb reach.
 *   - Coach-only StudentPicker slotted into the sidebar
 *
 * Role determines which nav set renders. The shell itself doesn't
 * fetch data — parent layout passes user info as props.
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
    <div className="min-h-screen bg-gray-50 text-gray-900 antialiased md:flex">
      <Sidebar
        role={role}
        userName={userName}
        userSubLabel={userSubLabel}
        items={items}
        showAdmin={showAdmin}
        belowUser={role === 'coach' ? <StudentPicker /> : null}
      />

      <main className="flex-1 min-w-0 pb-16 md:pb-0">
        {/* Mobile-only brand strip — sidebar holds the brand on desktop.
            Sticky so it stays put on scroll, mirroring the sidebar's
            behavior. md:hidden because the sidebar already shows the
            brand on wider screens. */}
        <div className="md:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-sm border-b border-gray-200">
          <Link
            href={role === 'coach' ? '/v2/coach' : '/v2/today'}
            className="flex items-center justify-between gap-3 px-4 py-2"
          >
            <span className="text-sm font-semibold text-green-900">
              LE3 Growth Portfolio
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/nlu-logo.svg"
              alt="National Louis University"
              className="h-5 w-auto opacity-80"
            />
          </Link>
        </div>
        {children}
      </main>

      <BottomTabBar items={items} showAdmin={showAdmin} />
    </div>
  )
}
