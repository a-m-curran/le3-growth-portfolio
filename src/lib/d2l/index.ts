/**
 * D2L Valence API client — public exports.
 *
 * Import from here rather than individual modules so consumers get a
 * single, stable surface:
 *
 *   import { listCoursesUnderOrgUnit, listCourseStudents, ... } from '@/lib/d2l'
 */

export { getValenceConfig, isValenceConfigured } from './config'
export type { D2LValenceConfig } from './config'
export { getValenceToken, clearValenceTokenCache } from './auth'

export { listCoursesUnderOrgUnit, getCourse } from './courses'
export {
  listCourseEnrollments,
  listCourseStudents,
  listCourseInstructors,
} from './enrollments'
export {
  listCourseAssignments,
  getAssignment,
  inferWorkType,
} from './assignments'
export {
  listAssignmentSubmissions,
  downloadSubmissionFile,
} from './submissions'

export type {
  NormalizedCourse,
  NormalizedEnrollment,
  NormalizedAssignment,
  NormalizedSubmission,
} from './types'
