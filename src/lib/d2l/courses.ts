/**
 * D2L Valence — course (org unit) discovery.
 *
 * Courses in Brightspace are represented as org units of type "CourseOffering"
 * (type ID 3). To find all LE3 courses, we walk the descendants of the
 * configured LE3 org unit and filter for course offerings.
 */

import { lpGet, lpGetAllPaged, ValenceRateLimitError } from './client'
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
    // The descendants endpoint returns lightweight rows (no Semester /
    // StartDate). Round-trip getCourse() per descendant to enrich each
    // one with the full CourseOffering payload, so callers always see
    // a fully-shaped NormalizedCourse (with derived quarter).
    // Bounded by ~47 today; one extra HTTP per discovered course is
    // acceptable at this scale. If a per-course fetch fails, fall
    // back to a minimal NormalizedCourse with currentQuarter() so the
    // sync isn't blocked.
    const enriched: NormalizedCourse[] = []
    for (const d of descendants) {
        try {
          enriched.push(await getCourse(d.Identifier))
        } catch (err) {
          // Sustained D2L rate-limiting: surface so the parent task's
          // retry policy can apply tuned backoff. Silently degrading
          // every descendant to currentQuarter() fallback would produce
          // 47 low-quality records when the data is actually fetchable
          // after a brief backoff.
          if (err instanceof ValenceRateLimitError) throw err
          // Other failures (transient 5xx, schema mismatch on one record,
          // etc.): degrade this single descendant to a minimal record so
          // the rest of the sync isn't blocked, but log for ops visibility.
          console.warn('listCoursesUnderOrgUnit: enrichment failed, using fallback', {
            orgUnitId: d.Identifier,
            name: d.Name,
            err: err instanceof Error ? err.message : String(err),
          })
          enriched.push(normalizeCourseOffering({
            Identifier: d.Identifier,
            Name: d.Name,
            Code: d.Code || null,
            IsActive: true,
            Path: '',
            StartDate: null,
            EndDate: null,
            Semester: null,
          }))
        }
      }
    return enriched
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
    // Self-as-course: enrich via getCourse() so we get the full
    // CourseOffering (Semester / StartDate) and the derived quarter.
    return [await getCourse(self.Identifier)]
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
