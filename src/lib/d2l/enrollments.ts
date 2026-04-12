/**
 * D2L Valence — enrollment / classlist.
 *
 * Given a course org unit ID, return the list of enrolled users
 * (students and instructors), with normalized role classification.
 */

import { leGet } from './client'
import type { D2LClasslistUser, NormalizedEnrollment } from './types'

// D2L role IDs vary by instance. These are the defaults on a fresh
// Brightspace install but can be overridden per-tenant. We treat anything
// that looks instructor-ish as instructor and everything else as student.
//
// Real installations should probably make this configurable — for now,
// we use name-based heuristics as a fallback.
const INSTRUCTOR_ROLE_IDS = new Set<number>([117, 118]) // Instructor, Teaching Assistant
const STUDENT_ROLE_IDS = new Set<number>([110]) // Student

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
  const isInstructor = INSTRUCTOR_ROLE_IDS.has(u.RoleId)
  // If explicitly a student role, trust it; otherwise default to student
  // unless the role is a known instructor role.
  const isStudent = STUDENT_ROLE_IDS.has(u.RoleId) || !isInstructor

  return {
    userId: u.Identifier,
    orgDefinedId: u.OrgDefinedId,
    email: u.Email,
    firstName: u.FirstName,
    lastName: u.LastName,
    displayName: u.DisplayName,
    roleId: u.RoleId,
    isStudent,
    isInstructor,
  }
}
