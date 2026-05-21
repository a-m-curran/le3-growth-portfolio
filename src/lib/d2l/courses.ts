/**
 * D2L Valence — course (org unit) discovery.
 *
 * Courses in Brightspace are represented as org units of type "CourseOffering"
 * (type ID 3). To find all LE3 courses, we walk the descendants of the
 * configured LE3 org unit and filter for course offerings.
 */

import { lpGet, lpGetAllPaged } from './client'
import type { D2LCourseOffering, D2LOrgUnitDescendant, NormalizedCourse } from './types'
import { normalizeCourseOffering } from './mappers'

const ORG_UNIT_TYPE_COURSE_OFFERING = 3

/**
 * List all course offerings that are descendants of the given org unit.
 * Used to discover "all LE3 courses" from a single parent LE3 org unit.
 *
 * Also handles the case where the configured org unit is ITSELF a course
 * offering (rather than a container of courses). This happens when the
 * pilot is scoped to a single sandbox / sandbox-cohort course rather than
 * a full LE3 program tree — e.g. early prod testing where NLU IT grants
 * the OAuth app access to just one course before opening it to the whole
 * program. Without this fallback, descendants returns [] and the sync
 * would silently skip everything.
 *
 * Earlier this function called getCourse() per descendant to enrich
 * each with the full CourseOffering payload (Semester + StartDate),
 * but /courses/{id} requires the orgunits:course:read scope NLU's
 * OAuth app does not grant. Since deriveQuarter now derives from the
 * NLU Banner term code embedded in course.code (which the lightweight
 * descendants payload already includes), the per-course enrichment
 * call was 100% wasted — every call 403'd and fell through to a
 * fallback that produced the same result we now compute directly
 * from the descendant. Removing it saves ~70 HTTPs per discovery and
 * ~70 console.warn log lines.
 */
export async function listCoursesUnderOrgUnit(
  parentOrgUnitId: string
): Promise<NormalizedCourse[]> {
  const path = `/orgstructure/${parentOrgUnitId}/descendants/?ouTypeId=${ORG_UNIT_TYPE_COURSE_OFFERING}`

  let descendants: D2LOrgUnitDescendant[] = []
  try {
    descendants = await lpGetAllPaged<D2LOrgUnitDescendant>(path)
  } catch {
    descendants = await lpGet<D2LOrgUnitDescendant[]>(path)
  }

  if (descendants.length > 0) {
    // Build NormalizedCourse directly from each descendant. The
    // descendants payload doesn't carry Semester or StartDate, but
    // deriveQuarter falls back to course.code (Banner term code) for
    // its primary signal, which IS present here. IsActive isn't in
    // the descendants payload either; assume true (matches the
    // pre-PR-17 behavior, and inactive courses don't generally appear
    // in the descendants query anyway).
    return descendants.map(d =>
      normalizeCourseOffering({
        Identifier: d.Identifier,
        Name: d.Name,
        Code: d.Code || null,
        IsActive: true,
        Path: '',
        StartDate: null,
        EndDate: null,
        Semester: null,
      })
    )
  }

  // No descendants. Check whether the configured org unit is itself a
  // Course Offering — if so, treat it as the (single) course to sync.
  const self = await lpGet<{
    Identifier: string
    Name: string
    Code: string | null
    Type: { Id: number; Code: string; Name: string }
  }>(`/orgstructure/${parentOrgUnitId}`)

  if (self.Type?.Id === ORG_UNIT_TYPE_COURSE_OFFERING) {
    // Self-as-course: build NormalizedCourse from the org-structure
    // payload directly (same rationale as the descendants .map above —
    // /courses/{id} would require a scope we don't have).
    return [
      normalizeCourseOffering({
        Identifier: self.Identifier,
        Name: self.Name,
        Code: self.Code,
        IsActive: true,
        Path: '',
        StartDate: null,
        EndDate: null,
        Semester: null,
      }),
    ]
  }

  // Genuinely empty (container exists but has no course children).
  return []
}

/**
 * Get details for a single course offering by org unit ID. Returns a
 * fully-shaped NormalizedCourse including derived quarter (via
 * normalizeCourseOffering, which applies the Banner-code → Semester →
 * StartDate → currentQuarter() priority chain).
 *
 * NOTE: as of today, NLU's OAuth app does not grant the
 * orgunits:course:read scope, so this function 403s against NLU's
 * prod. Kept for completeness (other deployments where the scope is
 * granted can use it) and for the unlikely future scenario where NLU
 * IT grants it. listCoursesUnderOrgUnit() no longer calls this for
 * the discovery path.
 */
export async function getCourse(orgUnitId: string): Promise<NormalizedCourse> {
  const info = await lpGet<D2LCourseOffering>(`/courses/${orgUnitId}`)
  return normalizeCourseOffering(info)
}
