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
    return descendants.map(d => ({
      orgUnitId: d.Identifier,
      name: d.Name,
      code: d.Code || null,
      active: true,
    }))
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
    return [
      {
        orgUnitId: self.Identifier,
        name: self.Name,
        code: self.Code || null,
        active: true,
      },
    ]
  }

  // Genuinely empty (container exists but has no course children).
  return []
}

/**
 * Get details for a single course offering by org unit ID. Returns a
 * fully-shaped NormalizedCourse including derived quarter (via
 * normalizeCourseOffering, which applies the Semester→StartDate→
 * currentQuarter() priority chain).
 */
export async function getCourse(orgUnitId: string): Promise<NormalizedCourse> {
  const info = await lpGet<D2LCourseOffering>(`/courses/${orgUnitId}`)
  return normalizeCourseOffering(info)
}
