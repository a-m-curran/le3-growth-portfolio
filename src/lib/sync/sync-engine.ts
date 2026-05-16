/**
 * LE3 sync engine — shared type definitions consumed by sync-run.ts
 * and sync-course.ts.
 *
 * The monolithic runLe3Sync function has been removed; orchestration
 * now lives in the Trigger.dev parent task (src/trigger/sync-le3.ts).
 * This file is kept as the canonical home for the cross-cutting types
 * SyncCounts and SyncError, which sync-run.ts and sync-course.ts both
 * import. Moving them here avoids a circular import between those two
 * files.
 */

// ─── SHARED TYPES ────────────────────────────────────

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
