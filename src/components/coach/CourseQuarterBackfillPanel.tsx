'use client'

import { useState } from 'react'

interface Transition {
  courseName: string
  orgUnitId: string
  oldQuarter: string | null
  newQuarter: string
  assignmentCount: number
  studentWorkCount: number
}

interface FailedCourse {
  courseName: string
  orgUnitId: string
  message: string
}

interface BackfillSummary {
  totalCourses: number
  updated: number
  skipped: number
  errored: number
}

interface BackfillResult {
  ok: boolean
  summary?: BackfillSummary
  transitions?: Transition[]
  failures?: FailedCourse[]
  error?: string
}

/**
 * Admin-only panel that triggers POST /api/admin/backfill-course-quarter
 * and renders the per-course transitions + failures.
 *
 * Idempotent: re-running is safe (rows already matching derived value
 * are skipped). course.quarter is the canary (UPDATEd last per course),
 * so a mid-run failure leaves the system in a re-runnable state.
 */
export function CourseQuarterBackfillPanel() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BackfillResult | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function runBackfill() {
    setBusy(true)
    setResult(null)
    setConfirming(false)
    try {
      const res = await fetch('/api/admin/backfill-course-quarter', { method: 'POST' })
      const data = (await res.json()) as BackfillResult
      setResult(data)
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Course Quarter Backfill</h2>
      <p className="text-sm text-gray-600 mb-4">
        Refetches every course from D2L, derives the canonical quarter (Semester.Name → StartDate
        → currentQuarter() fallback), and UPDATEs <code>course.quarter</code>,{' '}
        <code>assignment.quarter</code>, and <code>student_work.quarter</code> for each.
        Idempotent — courses whose stored quarter already matches the derived value are skipped.
        Safe to re-run.
      </p>

      {!busy && !confirming && !result && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg bg-green-700 hover:bg-green-800 text-white px-4 py-2 text-sm font-medium"
        >
          Backfill course quarters
        </button>
      )}

      {confirming && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm text-amber-900 mb-3">
            This will UPDATE every course / assignment / student_work row whose stored quarter
            differs from the D2L-derived value. Idempotent and safe to re-run.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={runBackfill}
              className="rounded-lg bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 text-sm font-medium"
            >
              Yes, run backfill
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-gray-300 hover:bg-gray-50 px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {busy && (
        <p className="text-sm text-gray-600">
          Backfilling… (sequential per-course; ~70 courses × 1 D2L HTTP each, expect 20–60s)
        </p>
      )}

      {result && (
        <div className="space-y-3">
          {!result.ok && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              {result.error ?? 'Backfill failed'}
            </div>
          )}
          {result.ok && result.summary && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900 mb-1">Summary</p>
              <p className="text-gray-700">
                {result.summary.totalCourses} courses checked · {result.summary.updated} updated
                · {result.summary.skipped} skipped · {result.summary.errored} errored
              </p>
            </div>
          )}
          {result.ok && result.transitions && result.transitions.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                Updated ({result.transitions.length})
              </p>
              <div className="rounded-lg border border-gray-200 max-h-60 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5">Course</th>
                      <th className="text-left px-2 py-1.5">Old</th>
                      <th className="text-left px-2 py-1.5">→ New</th>
                      <th className="text-right px-2 py-1.5">Asgn</th>
                      <th className="text-right px-2 py-1.5">SWork</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transitions.map(t => (
                      <tr key={t.orgUnitId} className="border-t border-gray-100">
                        <td className="px-2 py-1 text-gray-900">{t.courseName}</td>
                        <td className="px-2 py-1 text-gray-500">{t.oldQuarter ?? '(null)'}</td>
                        <td className="px-2 py-1 text-gray-900 font-medium">{t.newQuarter}</td>
                        <td className="px-2 py-1 text-right text-gray-700">{t.assignmentCount}</td>
                        <td className="px-2 py-1 text-right text-gray-700">{t.studentWorkCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {result.ok && result.failures && result.failures.length > 0 && (
            <div>
              <p className="text-sm font-medium text-red-900 mb-1">
                Failed ({result.failures.length})
              </p>
              <ul className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs space-y-1">
                {result.failures.map(f => (
                  <li key={f.orgUnitId} className="text-red-900">
                    <span className="font-medium">{f.courseName}</span>: {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  )
}
