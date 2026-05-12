import { CaseloadView } from './CaseloadView'

/**
 * v2 Caseload page — full list of the coach's assigned students.
 * Server component shell that mounts the client CaseloadView, which
 * does the data fetching + filtering + click-through to student
 * detail. Server-side here just to keep the route's metadata simple.
 */
export default function V2CaseloadPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Caseload</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every student assigned to you. Click a card to dive in.
        </p>
      </div>
      <CaseloadView />
    </div>
  )
}
