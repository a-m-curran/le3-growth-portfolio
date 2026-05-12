import Link from 'next/link'

/**
 * /v2/reflect/start?work=<id>
 *
 * Stub destination for "Start reflection" clicks on a featured work
 * card. v2 doesn't yet have its own end-to-end conversation flow —
 * the 3-phase guided experience still runs through v1 routes.
 *
 * Rather than routing to v1 from inside v2 (which would bounce demo
 * personas back into the v1 layout that ignores the v2 demo cookie
 * and treats everyone as a coach), this page acknowledges the gap
 * and gives the user a clear next move.
 *
 * When the v2 conversation flow gets built, this page becomes the
 * real entry point.
 */
export default function V2ReflectStartPage({ searchParams }: { searchParams: { work?: string } }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Start a reflection
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          The 3-phase guided conversation flow is part of the v2 IA
          exploration that&rsquo;s still being built. For now you can:
        </p>
        <div className="space-y-2">
          <Link
            href="/v2/reflect"
            className="block px-4 py-3 rounded-lg bg-green-50 border border-green-200 hover:border-green-400 hover:bg-white transition-colors"
          >
            <span className="text-sm font-semibold text-green-900 block">
              ← Back to Reflect
            </span>
            <span className="text-xs text-gray-600">
              See past reflections and in-progress entries
            </span>
          </Link>
          <Link
            href="/v2/today"
            className="block px-4 py-3 rounded-lg bg-white border border-gray-200 hover:border-gray-400 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-900 block">
              Go to Today
            </span>
            <span className="text-xs text-gray-600">
              Your home view
            </span>
          </Link>
        </div>
        {searchParams.work && (
          <p className="text-[11px] text-gray-400 mt-6">
            (Work selected: <code className="font-mono">{searchParams.work}</code>)
          </p>
        )}
      </div>
    </div>
  )
}
