/**
 * D2L Valence — assignments (dropbox folders).
 *
 * In Brightspace, assignments are "dropbox folders" under a course.
 * Each folder has submissions from enrolled users.
 */

import { leGet } from './client'
import type { D2LDropboxFolder, NormalizedAssignment } from './types'

/**
 * List all dropbox folders (assignments) for a course.
 * Filters out hidden folders since students can't submit to them.
 */
export async function listCourseAssignments(
  orgUnitId: string
): Promise<NormalizedAssignment[]> {
  const folders = await leGet<D2LDropboxFolder[]>(`/${orgUnitId}/dropbox/folders/`)

  return folders
    .filter(f => !f.IsHidden)
    .map(f => normalizeFolder(orgUnitId, f))
}

/**
 * Get details for a single assignment.
 */
export async function getAssignment(
  orgUnitId: string,
  folderId: string
): Promise<NormalizedAssignment> {
  const folder = await leGet<D2LDropboxFolder>(
    `/${orgUnitId}/dropbox/folders/${folderId}`
  )
  return normalizeFolder(orgUnitId, folder)
}

function normalizeFolder(
  orgUnitId: string,
  f: D2LDropboxFolder
): NormalizedAssignment {
  return {
    folderId: String(f.Id),
    orgUnitId,
    name: f.Name,
    description: f.CustomInstructions?.Text || null,
    dueDate: f.DueDate,
    active: !f.IsHidden,
    submissionType: mapSubmissionType(f.SubmissionType),
    maxPoints: f.Assessment?.ScoreDenominator ?? null,
  }
}

function mapSubmissionType(
  type: number
): NormalizedAssignment['submissionType'] {
  switch (type) {
    case 0: return 'file'
    case 1: return 'text'
    case 2: return 'on_paper'
    case 3: return 'observed'
    case 4: return 'file_or_text'
    default: return 'unknown'
  }
}

/**
 * Infer a portfolio work_type from an assignment's title.
 * Shared with the LTI notice handler path for consistency.
 */
export function inferWorkType(title: string): string {
  const lower = title.toLowerCase()
  if (lower.includes('discussion')) return 'discussion_post'
  if (lower.includes('presentation')) return 'presentation'
  if (lower.includes('exam') || lower.includes('quiz') || lower.includes('test')) return 'exam'
  if (lower.includes('lab')) return 'lab_report'
  if (lower.includes('essay') || lower.includes('paper') || lower.includes('report')) return 'essay'
  if (lower.includes('project')) return 'project'
  if (lower.includes('portfolio')) return 'portfolio_piece'
  return 'other'
}
