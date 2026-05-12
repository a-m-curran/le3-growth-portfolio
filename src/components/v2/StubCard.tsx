/**
 * Phase 0 placeholder card for v2 routes. Renders a route's name,
 * a short description of what will live there, and an explicit
 * "Phase 0 stub" badge so it's never mistaken for finished work
 * when navigating around the bones.
 *
 * Will be deleted as each route gets real content.
 */

interface StubCardProps {
  title: string
  description: string
  /** Optional bullets describing what this surface will contain */
  willContain?: string[]
}

export function StubCard({ title, description, willContain }: StubCardProps) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-8">
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            Phase 0 stub
          </span>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>

        {willContain && willContain.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Will eventually contain
            </p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              {willContain.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
