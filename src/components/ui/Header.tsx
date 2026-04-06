'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PersonSelector } from './PersonSelector'

export function Header() {
  const pathname = usePathname()
  const isCoach = pathname.startsWith('/coach')

  return (
    <header className="border-b border-green-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/garden" className="text-lg font-semibold text-green-900">
            LE3 Growth Portfolio
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link
              href="/garden"
              className={`px-2 py-1 rounded ${
                pathname === '/garden'
                  ? 'text-green-800 bg-green-100'
                  : 'text-gray-600 hover:text-green-800'
              }`}
            >
              Garden
            </Link>
            <Link
              href="/conversation"
              className={`px-2 py-1 rounded ${
                pathname.startsWith('/conversation')
                  ? 'text-green-800 bg-green-100'
                  : 'text-gray-600 hover:text-green-800'
              }`}
            >
              Conversation
            </Link>
            <Link
              href="/coach"
              className={`px-2 py-1 rounded ${
                pathname.startsWith('/coach')
                  ? 'text-green-800 bg-green-100'
                  : 'text-gray-600 hover:text-green-800'
              }`}
            >
              Coach
            </Link>
          </nav>
        </div>
        <PersonSelector isCoach={isCoach} />
      </div>
    </header>
  )
}
