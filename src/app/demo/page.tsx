'use client'

import { useRouter } from 'next/navigation'
import { students, coaches } from '@/data'

export default function DemoHomePage() {
  const router = useRouter()

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-green-50 px-4 py-12">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-green-900">Explore the Demo</h1>
          <p className="text-sm text-gray-600 mt-2">Choose a person to see their portfolio</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Students</h2>
          <div className="grid gap-3">
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => router.push(`/demo/garden?student=${s.id}`)}
                className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-green-400 hover:shadow-sm transition-all group"
              >
                <div className="font-medium text-green-900 group-hover:text-green-700">
                  {s.firstName} {s.lastName}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{s.cohort}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Coaches</h2>
          <div className="grid gap-3">
            {coaches.map(c => (
              <button
                key={c.id}
                onClick={() => router.push(`/demo/coach?coach=${c.id}`)}
                className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-green-400 hover:shadow-sm transition-all group"
              >
                <div className="font-medium text-green-900 group-hover:text-green-700">{c.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">Coach</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
