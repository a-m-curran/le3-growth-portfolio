/**
 * Shared LE3 sync type definitions. Leaf module — imports nothing.
 *
 * SyncCounts and SyncError are consumed by both sync-course.ts and
 * sync-run.ts; housing them here (rather than in either module) keeps
 * those two files from importing each other.
 */

export interface SyncCounts {
  coursesSynced: number
  studentsSynced: number
  assignmentsSynced: number
  submissionsSynced: number
  submissionsSkipped: number
  errorsCount: number
}

export interface SyncError {
  stage: string
  context: string
  message: string
}
