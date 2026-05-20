/**
 * Mappers from raw D2L Valence payloads to the application's
 * NormalizedCourse type.
 *
 * The pure deriveQuarter helper computes the canonical "Season YYYY"
 * for a course using the priority chain:
 *   1. Semester.Name (if matches /^(Winter|Spring|Summer|Fall)\s+\d{4}$/)
 *   2. StartDate month → Season + Year
 *   3. currentQuarter() safety net (calendar-quarter-at-call-time)
 *
 * deriveQuarter is pure and unit-testable. The structural test in
 * scripts/test-sync-quarter.ts asserts all branches of its shape.
 */

import { currentQuarter } from '@/lib/sync/quarter'
import type { D2LCourseOffering, NormalizedCourse } from './types'

const SEASON_BY_MONTH: ReadonlyArray<'Winter' | 'Spring' | 'Summer' | 'Fall'> = [
  'Winter', 'Winter', 'Winter',   // Jan-Mar (0-2)
  'Spring', 'Spring', 'Spring',   // Apr-Jun (3-5)
  'Summer', 'Summer', 'Summer',   // Jul-Sep (6-8)
  'Fall',   'Fall',   'Fall',     // Oct-Dec (9-11)
]

const CANONICAL_SEMESTER = /^(Winter|Spring|Summer|Fall)\s+\d{4}$/

export function deriveQuarter(input: {
  semesterName: string | null
  startDate: string | null
}): string {
  // Priority 1: D2L Semester.Name, if it's already canonical.
  if (input.semesterName && CANONICAL_SEMESTER.test(input.semesterName.trim())) {
    return input.semesterName.trim()
  }
  // Priority 2: StartDate month → Season + the date's year.
  if (input.startDate) {
    const d = new Date(input.startDate)
    if (!isNaN(d.getTime())) {
      return `${SEASON_BY_MONTH[d.getMonth()]} ${d.getFullYear()}`
    }
  }
  // Priority 3: calendar-quarter-at-call-time (safety net).
  return currentQuarter()
}

/**
 * Map a raw D2L CourseOffering payload to NormalizedCourse.
 * Used by getCourse() (and listCoursesUnderOrgUnit() after enrichment).
 */
export function normalizeCourseOffering(raw: D2LCourseOffering): NormalizedCourse {
  const semesterName = raw.Semester?.Name ?? null
  const startDate = raw.StartDate ?? null
  return {
    orgUnitId: raw.Identifier,
    name: raw.Name,
    code: raw.Code,
    active: raw.IsActive,
    quarter: deriveQuarter({ semesterName, startDate }),
    startDate,
    semesterName,
  }
}
