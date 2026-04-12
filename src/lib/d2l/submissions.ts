/**
 * D2L Valence — submissions.
 *
 * For each dropbox folder (assignment), list every student's submission state.
 * Supports downloading individual submission files as buffers.
 */

import { leGet, leGetBuffer } from './client'
import type {
  D2LEntityDropbox,
  D2LSubmissionRecord,
  NormalizedSubmission,
} from './types'

/**
 * List all submissions for a dropbox folder.
 * Returns one normalized record per (user, attempt) pair.
 * Skips group submissions.
 */
export async function listAssignmentSubmissions(
  orgUnitId: string,
  folderId: string
): Promise<NormalizedSubmission[]> {
  const entities = await leGet<D2LEntityDropbox[]>(
    `/${orgUnitId}/dropbox/folders/${folderId}/submissions/`
  )

  const results: NormalizedSubmission[] = []

  for (const entity of entities) {
    if (entity.Entity.EntityType !== 'User') continue
    if (!entity.Submissions || entity.Submissions.length === 0) continue

    // Submissions are ordered oldest-first; attempt is 1-indexed
    entity.Submissions.forEach((sub, i) => {
      results.push(normalizeSubmission(entity, sub, orgUnitId, folderId, i + 1))
    })
  }

  return results
}

/**
 * Download a specific file from a submission.
 * Returns the raw buffer + content type + filename so the caller can
 * feed it into text extraction.
 */
export async function downloadSubmissionFile(
  orgUnitId: string,
  folderId: string,
  submissionId: string,
  fileId: string
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  return leGetBuffer(
    `/${orgUnitId}/dropbox/folders/${folderId}/submissions/${submissionId}/files/${fileId}`
  )
}

function normalizeSubmission(
  entity: D2LEntityDropbox,
  sub: D2LSubmissionRecord,
  orgUnitId: string,
  folderId: string,
  attempt: number
): NormalizedSubmission {
  return {
    submissionId: String(sub.Id),
    folderId,
    orgUnitId,
    studentUserId: String(entity.Entity.EntityId),
    studentDisplayName: entity.Entity.DisplayName,
    submittedAt: sub.SubmissionDate,
    attempt,
    grade: entity.Feedback?.Score ?? null,
    isGraded: entity.Feedback?.IsGraded ?? false,
    comment: sub.Comment?.Text ?? null,
    files: sub.Files.map(f => ({
      fileId: String(f.FileId),
      fileName: f.FileName,
      size: f.Size,
    })),
  }
}
