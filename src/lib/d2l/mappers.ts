/**
 * Mappers from raw D2L Valence payloads to the application's
 * NormalizedCourse type.
 *
 * The pure deriveQuarter helper computes the canonical "Season YYYY"
 * for a course using the priority chain:
 *   1. NLU Banner term code embedded in course.code: parses
 *      "<sectionId>.<YYYY><TT>" where TT ∈ {10:Winter, 30:Spring,
 *      60:Summer, 90:Fall}. Empirically derived + cross-referenced
 *      against student_work.submitted_at distributions; matches
 *      currentQuarter()'s boundary convention exactly.
 *   2. Semester.Name (if matches /^(Winter|Spring|Summer|Fall)\s+\d{4}$/)
 *      — used if NLU's Brightspace OAuth app grants orgunits:course:read
 *      AND we've called the full /courses/{id} endpoint; otherwise null.
 *   3. StartDate month → Season + Year (same scope dependency as #2).
 *   4. currentQuarter() safety net (calendar-quarter-at-call-time).
 *
 * Priority 1 is intentionally first because it's the most reliable
 * signal: it's exact (deterministic mapping, no ambiguity), already
 * present in the lightweight org-structure payload (no extra D2L
 * call), and doesn't depend on any scope grant. Priorities 2-3 are
 * generality fallbacks for institutions whose code field doesn't
 * follow the Banner convention.
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

// NLU Banner term-code parser. The code field comes as e.g.
// "10977.202610" — section number, dot, then 4-digit year + 2-digit
// term suffix. Suffixes empirically map to seasons:
//   10 → Winter, 30 → Spring, 60 → Summer, 90 → Fall
// (Cross-referenced against student_work.submitted_at distributions
// in prod; aligns exactly with currentQuarter()'s boundaries.)
const BANNER_TERM_CODE = /\.(\d{4})(\d{2})$/
const BANNER_SUFFIX_TO_SEASON: Record<string, 'Winter' | 'Spring' | 'Summer' | 'Fall'> = {
  '10': 'Winter',
  '30': 'Spring',
  '60': 'Summer',
  '90': 'Fall',
}

export function deriveQuarter(input: {
  semesterName: string | null
  startDate: string | null
  code: string | null
}): string {
  // Priority 1: NLU Banner term code embedded in course.code.
  // Exact, deterministic, requires no D2L scope (the code field is in
  // the lightweight /orgstructure/descendants/ payload we already have).
  if (input.code) {
    const m = input.code.match(BANNER_TERM_CODE)
    if (m) {
      const year = m[1]
      const suffix = m[2]
      const season = BANNER_SUFFIX_TO_SEASON[suffix]
      if (season) {
        return `${season} ${year}`
      }
    }
  }
  // Priority 2: D2L Semester.Name, if it's already canonical. Requires
  // the orgunits:course:read scope to populate; null otherwise.
  if (input.semesterName && CANONICAL_SEMESTER.test(input.semesterName.trim())) {
    return input.semesterName.trim()
  }
  // Priority 3: StartDate month → Season + the date's year. Same scope
  // dependency as Priority 2.
  if (input.startDate) {
    const d = new Date(input.startDate)
    if (!isNaN(d.getTime())) {
      return `${SEASON_BY_MONTH[d.getMonth()]} ${d.getFullYear()}`
    }
  }
  // Priority 4: calendar-quarter-at-call-time (safety net).
  return currentQuarter()
}

/**
 * Map a raw D2L CourseOffering payload to NormalizedCourse.
 * Used by getCourse() (and listCoursesUnderOrgUnit() after enrichment).
 */
export function normalizeCourseOffering(raw: D2LCourseOffering): NormalizedCourse {
  const semesterName = raw.Semester?.Name ?? null
  const startDate = raw.StartDate ?? null
  const code = raw.Code ?? null
  return {
    orgUnitId: raw.Identifier,
    name: raw.Name,
    code,
    active: raw.IsActive,
    quarter: deriveQuarter({ semesterName, startDate, code }),
    startDate,
    semesterName,
  }
}
