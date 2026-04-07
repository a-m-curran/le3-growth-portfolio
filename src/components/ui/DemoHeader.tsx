'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { students, coaches } from '@/data'

export function DemoHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const isCoach = pathname.startsWith('/demo/coach')

  return (
    <header className="border-b border-green-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/demo" className="text-lg font-semibold text-green-900 flex items-center gap-2">
            LE3 Growth Portfolio
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded uppercase tracking-wider">
              Demo
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link
              href="/demo/garden"
              className={`px-2 py-1 rounded ${
                pathname === '/demo/garden'
                  ? 'text-green-800 bg-green-100'
                  : 'text-gray-600 hover:text-green-800'
              }`}
            >
              Portfolio
            </Link>
            <Link
              href="/demo/conversation"
              className={`px-2 py-1 rounded ${
                pathname.startsWith('/demo/conversation')
                  ? 'text-green-800 bg-green-100'
                  : 'text-gray-600 hover:text-green-800'
              }`}
            >
              Conversation
            </Link>
            <Link
              href="/demo/reflect"
              className={`px-2 py-1 rounded ${
                pathname.startsWith('/demo/reflect')
                  ? 'text-green-800 bg-green-100'
                  : 'text-gray-600 hover:text-green-800'
              }`}
            >
              Reflection
            </Link>
            <Link
              href="/demo/narrative"
              className={`px-2 py-1 rounded ${
                pathname.startsWith('/demo/narrative')
                  ? 'text-green-800 bg-green-100'
                  : 'text-gray-600 hover:text-green-800'
              }`}
            >
              Narratives
            </Link>
            <Link
              href="/demo/career"
              className={`px-2 py-1 rounded ${
                pathname.startsWith('/demo/career')
                  ? 'text-green-800 bg-green-100'
                  : 'text-gray-600 hover:text-green-800'
              }`}
            >
              Career
            </Link>
            <Link
              href="/demo/coach"
              className={`px-2 py-1 rounded ${
                pathname.startsWith('/demo/coach')
                  ? 'text-green-800 bg-green-100'
                  : 'text-gray-600 hover:text-green-800'
              }`}
            >
              Coach
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isCoach ? (
            <select
              value={searchParams.get('coach') || 'coach_elizabeth'}
              onChange={e => router.push(`/demo/coach?coach=${e.target.value}`)}
              className="text-sm border border-green-300 rounded-md px-2 py-1 bg-white text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-label="Select coach"
            >
              {coaches.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <select
              value={searchParams.get('student') || 'stu_aja'}
              onChange={e => router.push(`/demo/garden?student=${e.target.value}`)}
              className="text-sm border border-green-300 rounded-md px-2 py-1 bg-white text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-label="Select student"
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          )}
          <Link
            href="/login"
            className="text-xs text-green-700 hover:text-green-900 hover:underline hidden sm:block"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  )
}
