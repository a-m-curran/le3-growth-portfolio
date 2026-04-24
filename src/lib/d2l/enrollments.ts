/**
 * D2L Valence — enrollment / classlist.
 *
 * Given a course org unit ID, return the list of enrolled users
 * (students and instructors), with normalized role classification.
 */

import { leGet } from './client'
import type { D2LClasslistUser, NormalizedEnrollment } from './types'

/**
 * Role classification. We've learned from NLU's d2ltest that RoleId is
 * NOT portable across instances — their instructors come through with
 * RoleId=null and students with 103, which doesn't match the documented
 * 117/118/110 defaults on a fresh Brightspace install.
 *
 * `ClasslistRoleDisplayName` is the authoritative, human-readable field
 * and is stable across instances. We use keyword matching on that as
 * the primary signal, with RoleId sets kept only as a fallback in case
 * a very old Brightspace version ever omits the display name.
 */
const INSTRUCTOR_NAME_PATTERN = /instructor|teacher|professor|faculty|teaching assistant|\bta\b|course lead/i
const STUDENT_NAME_PATTERN = /student|learner|participant/i

// Legacy fallbacks only — never relied on by default.
const INSTRUCTOR_ROLE_IDS_FALLBACK = new Set<number>([117, 118])
const STUDENT_ROLE_IDS_FALLBACK = new Set<number>([110])

/**
 * Fetch the classlist for a course and normalize.
 */
export async function listCourseEnrollments(
  orgUnitId: string
): Promise<NormalizedEnrollment[]> {
  const users = await leGet<D2LClasslistUser[]>(`/${orgUnitId}/classlist/`)
  return users.map(normalizeClasslistUser)
}

/**
 * Filter a classlist down to just students (excluding instructors/TAs/auditors).
 */
export async function listCourseStudents(
  orgUnitId: string
): Promise<NormalizedEnrollment[]> {
  const all = await listCourseEnrollments(orgUnitId)
  return all.filter(e => e.isStudent)
}

/**
 * Filter a classlist down to just instructors.
 */
export async function listCourseInstructors(
  orgUnitId: string
): Promise<NormalizedEnrollment[]> {
  const all = await listCourseEnrollments(orgUnitId)
  return all.filter(e => e.isInstructor)
}

function normalizeClasslistUser(u: D2LClasslistUser): NormalizedEnrollment {
  const displayName = u.ClasslistRoleDisplayName ?? ''

  // Primary: use the human-readable role name. This is stable across
  // Brightspace instances — RoleId is not.
  let isInstructor = INSTRUCTOR_NAME_PATTERN.test(displayName)
  let isStudent = STUDENT_NAME_PATTERN.test(displayName)

  // Fallback 1: if we have a RoleId and no display-name match, use the
  // legacy hardcoded sets.
  if (!isInstructor && !isStudent && u.RoleId != null) {
    isInstructor = INSTRUCTOR_ROLE_IDS_FALLBACK.has(u.RoleId)
    isStudent = STUDENT_ROLE_IDS_FALLBACK.has(u.RoleId)
  }

  // Fallback 2: if we still can't classify, default to student (the
  // safer default — worst case we create a student record we didn't
  // need, vs. missing an instructor we did).
  if (!isInstructor && !isStudent) {
    isStudent = true
  }

  return {
    userId: u.Identifier,
    orgDefinedId: u.OrgDefinedId,
    email: u.Email,
    firstName: u.FirstName ?? '',
    lastName: u.LastName ?? '',
    displayName: u.DisplayName,
    roleId: u.RoleId ?? 0,
    isStudent,
    isInstructor,
  }
}
