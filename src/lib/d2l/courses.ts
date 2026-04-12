/**
 * D2L Valence — course (org unit) discovery.
 *
 * Courses in Brightspace are represented as org units of type "CourseOffering"
 * (type ID 3). To find all LE3 courses, we walk the descendants of the
 * configured LE3 org unit and filter for course offerings.
 */

import { lpGet, lpGetAllPaged } from './client'
import type { D2LOrgUnitDescendant, NormalizedCourse } from './types'

const ORG_UNIT_TYPE_COURSE_OFFERING = 3

/**
 * List all course offerings that are descendants of the given org unit.
 * Used to discover "all LE3 courses" from a single parent LE3 org unit.
 */
export async function listCoursesUnderOrgUnit(
  parentOrgUnitId: string
): Promise<NormalizedCourse[]> {
  // /lp/{ver}/orgstructure/{orgUnitId}/descendants/?ouTypeId=3
  // returns a paged list of every descendant of the given type
  const path = `/orgstructure/${parentOrgUnitId}/descendants/?ouTypeId=${ORG_UNIT_TYPE_COURSE_OFFERING}`

  let descendants: D2LOrgUnitDescendant[] = []
  try {
    descendants = await lpGetAllPaged<D2LOrgUnitDescendant>(path)
  } catch {
    // Older Valence versions return an unpaged array — fall back
    descendants = await lpGet<D2LOrgUnitDescendant[]>(path)
  }

  return descendants.map(d => ({
    orgUnitId: d.Identifier,
    name: d.Name,
    code: d.Code || null,
    active: true, // LP descendants endpoint doesn't return active state; assume active
  }))
}

/**
 * Get details for a single course offering by org unit ID.
 */
export async function getCourse(orgUnitId: string): Promise<NormalizedCourse> {
  const info = await lpGet<{
    Identifier: string
    Name: string
    Code: string | null
    IsActive: boolean
  }>(`/courses/${orgUnitId}`)

  return {
    orgUnitId: info.Identifier,
    name: info.Name,
    code: info.Code,
    active: info.IsActive,
  }
}
