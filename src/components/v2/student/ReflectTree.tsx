'use client'

import { useMemo, useState } from 'react'
import { SubmissionRow } from '@/components/v2/student/SubmissionRow'
import type { SubmissionItem } from '@/components/v2/student/types'

/**
 * Quarter → Course → Week → Submissions tree.
 *
 * - Quarters sorted most recent first (Fall > Summer > Spring > Winter
 *   within a year; higher year first).
 * - Courses within a quarter sorted alphabetically by course_name.
 * - Weeks within a course sorted ascending by week_number; the "Other"
 *   bucket (week_number is null) comes last.
 * - Submissions within a week sorted newest-first by submitted_at
 *   (preserving the API's order — submissions arrive newest-first).
 *
 * Smart-expand defaults computed once from the input:
 *   - The current quarter (the one with the highest ordinal that has
 *     any submissions) is expanded.
 *   - Within it, every course is expanded.
 *   - Within each expanded course, the "current week" = the highest
 *     week_number that has content for that course; only that week is
 *     expanded by default. (Curriculum-week-based, not calendar.)
 *   - Per-session client state only; reloading resets to defaults.
 */

interface ReflectTreeProps {
  submissions: SubmissionItem[]
  onRowClick: (item: SubmissionItem) => void
}

const SEASON_ORDER: Record<string, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 }

function quarterOrdinal(q: string): number {
  const [season, year] = q.split(' ')
  const y = parseInt(year, 10)
  const s = SEASON_ORDER[season] ?? 0
  return y * 10 + s
}

function weekKey(weekNumber: number | null): string {
  return weekNumber === null ? 'other' : String(weekNumber)
}

interface Grouped {
  quarter: string
  total: number
  courses: Array<{
    courseName: string
    courseCode: string | null
    total: number
    weeks: Array<{
      label: string         // "Week N" or "Other"
      key: string           // weekKey
      weekNumber: number | null
      total: number
      items: SubmissionItem[]
    }>
  }>
}

function group(submissions: SubmissionItem[]): Grouped[] {
  const byQuarter = new Map<string, Map<string, Map<string, SubmissionItem[]>>>()
  for (const s of submissions) {
    if (!s.courseName) continue   // submissions without course_name are not surfaceable here
    if (!byQuarter.has(s.quarter)) byQuarter.set(s.quarter, new Map())
    const courses = byQuarter.get(s.quarter)!
    if (!courses.has(s.courseName)) courses.set(s.courseName, new Map())
    const weeks = courses.get(s.courseName)!
    const wk = weekKey(s.weekNumber)
    if (!weeks.has(wk)) weeks.set(wk, [])
    weeks.get(wk)!.push(s)
  }

  const out: Grouped[] = []
  const quarters = Array.from(byQuarter.keys()).sort((a, b) => quarterOrdinal(b) - quarterOrdinal(a))
  for (const q of quarters) {
    const coursesMap = byQuarter.get(q)!
    const courseNames = Array.from(coursesMap.keys()).sort((a, b) => a.localeCompare(b))
    let qTotal = 0
    const courses: Grouped['courses'] = []
    for (const cn of courseNames) {
      const weeksMap = coursesMap.get(cn)!
      const weekKeys = Array.from(weeksMap.keys()).sort((a, b) => {
        if (a === 'other') return 1
        if (b === 'other') return -1
        return parseInt(a, 10) - parseInt(b, 10)
      })
      let cTotal = 0
      const weeks: Grouped['courses'][number]['weeks'] = []
      let courseCode: string | null = null
      for (const wk of weekKeys) {
        const items = weeksMap.get(wk)!
        if (!courseCode) courseCode = items[0].courseCode
        const weekNumber = wk === 'other' ? null : parseInt(wk, 10)
        weeks.push({
          label: wk === 'other' ? 'Other' : `Week ${weekNumber}`,
          key: wk,
          weekNumber,
          total: items.length,
          items,
        })
        cTotal += items.length
      }
      courses.push({ courseName: cn, courseCode, total: cTotal, weeks })
      qTotal += cTotal
    }
    out.push({ quarter: q, total: qTotal, courses })
  }
  return out
}

interface ExpandDefaults {
  quarters: Set<string>
  courses: Set<string>       // `${quarter}/${courseName}` keys
  weeks: Set<string>         // `${quarter}/${courseName}/${weekKey}` keys
}

function smartExpandDefaults(grouped: Grouped[]): ExpandDefaults {
  const quarters = new Set<string>()
  const courses = new Set<string>()
  const weeks = new Set<string>()
  if (grouped.length === 0) return { quarters, courses, weeks }
  const current = grouped[0]   // grouped is sorted newest-first by ordinal
  quarters.add(current.quarter)
  for (const c of current.courses) {
    const cKey = `${current.quarter}/${c.courseName}`
    courses.add(cKey)
    // Pick the highest week_number (excluding "other") for this course.
    // If only "other" exists, expand that.
    const numericWeeks = c.weeks.filter(w => w.weekNumber !== null)
    const target = numericWeeks.length > 0
      ? numericWeeks.reduce((a, b) => (a.weekNumber! >= b.weekNumber! ? a : b))
      : c.weeks[0]
    if (target) weeks.add(`${cKey}/${target.key}`)
  }
  return { quarters, courses, weeks }
}

export function ReflectTree({ submissions, onRowClick }: ReflectTreeProps) {
  const grouped = useMemo(() => group(submissions), [submissions])
  const defaults = useMemo(() => smartExpandDefaults(grouped), [grouped])

  const [openQuarters, setOpenQuarters] = useState<Set<string>>(defaults.quarters)
  const [openCourses, setOpenCourses] = useState<Set<string>>(defaults.courses)
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(defaults.weeks)

  function toggle(set: Set<string>, key: string, update: (next: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    update(next)
  }

  if (grouped.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
        <p className="text-gray-600">Nothing to reflect on yet.</p>
        <p className="text-xs text-gray-500 mt-2">
          When you submit work to D2L, it&rsquo;ll show up here ready for reflection.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm divide-y divide-gray-100">
      {grouped.map(q => {
        const qOpen = openQuarters.has(q.quarter)
        return (
          <section key={q.quarter} className="p-3">
            <button
              type="button"
              onClick={() => toggle(openQuarters, q.quarter, setOpenQuarters)}
              className="w-full flex items-center justify-between py-1 px-1 hover:bg-gray-50 rounded"
              aria-expanded={qOpen}
            >
              <span className="text-sm font-semibold text-gray-900">
                {qOpen ? '▾' : '▸'} {q.quarter}
              </span>
              <span className="text-xs text-gray-500">({q.total})</span>
            </button>
            {qOpen && (
              <div className="mt-1 space-y-2 pl-3">
                {q.courses.map(c => {
                  const cKey = `${q.quarter}/${c.courseName}`
                  const cOpen = openCourses.has(cKey)
                  return (
                    <div key={cKey}>
                      <button
                        type="button"
                        onClick={() => toggle(openCourses, cKey, setOpenCourses)}
                        className="w-full flex items-center justify-between py-1 px-1 hover:bg-gray-50 rounded"
                        aria-expanded={cOpen}
                      >
                        <span className="text-sm font-semibold text-gray-800">
                          {cOpen ? '▾' : '▸'} {c.courseName}
                          {c.courseCode && (
                            <span className="text-xs font-normal text-gray-400 ml-2">
                              {c.courseCode}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500">({c.total})</span>
                      </button>
                      {cOpen && (
                        <div className="mt-1 space-y-1 pl-3">
                          {c.weeks.map(w => {
                            const wKey = `${cKey}/${w.key}`
                            const wOpen = openWeeks.has(wKey)
                            return (
                              <div key={wKey}>
                                <button
                                  type="button"
                                  onClick={() => toggle(openWeeks, wKey, setOpenWeeks)}
                                  className="w-full flex items-center justify-between py-1 px-1 hover:bg-gray-50 rounded"
                                  aria-expanded={wOpen}
                                >
                                  <span className="text-sm text-gray-700">
                                    {wOpen ? '▾' : '▸'} {w.label}
                                  </span>
                                  <span className="text-xs text-gray-500">({w.total})</span>
                                </button>
                                {wOpen && (
                                  <ul className="mt-1 space-y-0.5 pl-3">
                                    {w.items.map(item => (
                                      <li key={item.id}>
                                        <SubmissionRow
                                          item={item}
                                          surface="reflect"
                                          onClick={onRowClick}
                                        />
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
