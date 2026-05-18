'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

/**
 * /v2/reflect/start?work=<student_work id>
 *
 * Real v2 entry: create (or resume) the conversation for the chosen
 * work via /api/conversation/start (now v2-identity-aware), then route
 * into the existing /v2/conversation/[id] flow.
 *
 * The LTI-pinned card passes ?lti=<resourceLinkId>; mapping that to a
 * work row is out of scope (spec) — LTI students land on /v2/today and
 * start via their featured work (?work=). Missing/lti-only degrades to
 * a clear link back to Today.
 */
export default function V2ReflectStartPage() {
  const router = useRouter()
  const params = useSearchParams()
  const workId = params.get('work')
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!workId || started.current) return
    started.current = true
    ;(async () => {
      try {
        const res = await fetch('/api/conversation/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workId }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || `Couldn't start (HTTP ${res.status})`)
          return
        }
        router.replace(`/v2/conversation/${data.conversationId}`)
      } catch {
        setError('Failed to connect. Please try again.')
      }
    })()
  }, [workId, router])

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-8">
        {!workId ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Start a reflection</h1>
            <p className="text-sm text-gray-600 mb-6">
              Pick a piece of work from your Today view to start a guided
              reflection on it.
            </p>
            <Link
              href="/v2/today"
              className="inline-block px-4 py-3 rounded-lg bg-green-50 border border-green-200 hover:border-green-400 hover:bg-white transition-colors text-sm font-semibold text-green-900"
            >
              Go to Today →
            </Link>
          </>
        ) : error ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Couldn&rsquo;t start the reflection
            </h1>
            <p className="text-sm text-red-700 mb-6">{error}</p>
            <Link
              href="/v2/today"
              className="inline-block px-4 py-3 rounded-lg bg-white border border-gray-200 hover:border-gray-400 transition-colors text-sm font-semibold text-gray-900"
            >
              ← Back to Today
            </Link>
          </>
        ) : (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="h-4 w-4 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
            Starting your reflection…
          </div>
        )}
      </div>
    </div>
  )
}
