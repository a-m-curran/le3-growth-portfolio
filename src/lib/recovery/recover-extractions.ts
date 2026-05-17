/**
 * Empty-extraction recovery — framework-agnostic core.
 *
 * The PDF-extraction bug (pdf-parse@2 under Trigger.dev's Node 21
 * sandbox) left ~1.3k synced student_work rows with empty content.
 * Raw submission buffers were never persisted, so recovery must
 * re-fetch from D2L. This module:
 *
 *   - parseWorkExternalId    parse d2l:{ou}:{folder}:{submission}
 *   - listEmptyWorkOrgUnits  READ-only: distinct org units that still
 *                            have empty d2l_valence_sync rows
 *   - recoverCourseExtractions  per-course: re-list folder → match
 *                            submission → download first file →
 *                            re-extract with the (fixed) extractor →
 *                            single content-only UPDATE (unless dryRun)
 *   - aggregateRecoveryResults  sum child results into one summary
 *
 * WRITE DISCIPLINE (load-bearing): the ONLY database write in this
 * feature is the single `.update({ content })` in
 * recoverCourseExtractions, gated by `!dryRun`. No insert/upsert/delete
 * anywhere; no other table; no sync_run row. scripts/test-recover-
 * extractions.ts asserts this by source scan.
 *
 * runAutoTag is a seam (default false): when false the LLM auto-tag
 * branch is skipped entirely (no cost, no work_skill_tag writes). The
 * branch body is intentionally NOT implemented yet (YAGNI; spec
 * out-of-scope) — enabling it later is an additive change, not a
 * rewrite.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  listAssignmentSubmissions,
  downloadSubmissionFile,
} from '@/lib/d2l'
import { extractText, isSupported } from '@/lib/extract-text'

const PAGE = 1000

export interface WorkCoords {
  orgUnitId: string
  folderId: string
  submissionId: string
}

export interface CourseRecoveryResult {
  orgUnitId: string
  scanned: number
  recovered: number
  stillEmpty: {
    unsupported: number
    noFile: number
    submissionGone: number
    emptyText: number
    downloadError: number
  }
  errors: string[]
}

export interface RecoverySummary {
  orgUnitsProcessed: number
  scanned: number
  recovered: number
  stillEmpty: CourseRecoveryResult['stillEmpty']
  errorCount: number
  perCourse: CourseRecoveryResult[]
}

/** Parse a student_work.external_id of the form d2l:{ou}:{folder}:{submission}. */
export function parseWorkExternalId(externalId: string | null): WorkCoords | null {
  if (!externalId) return null
  const parts = externalId.split(':')
  if (parts.length !== 4) return null
  if (parts[0] !== 'd2l') return null
  const [, orgUnitId, folderId, submissionId] = parts
  if (!orgUnitId || !folderId || !submissionId) return null
  return { orgUnitId, folderId, submissionId }
}

function isEmpty(content: string | null): boolean {
  return !content || content.trim().length === 0
}

/**
 * READ-ONLY. Distinct org unit ids that still have at least one empty
 * (`content` null/blank) `student_work` row sourced from the D2L sync.
 * Paginated select; JS-side empty filter (robust vs PostgREST empty-
 * string quoting).
 */
export async function listEmptyWorkOrgUnits(
  admin: SupabaseClient
): Promise<string[]> {
  const orgUnits = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('student_work')
      .select('external_id, content')
      .eq('source', 'd2l_valence_sync')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`listEmptyWorkOrgUnits select failed: ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data) {
      if (!isEmpty(row.content as string | null)) continue
      const coords = parseWorkExternalId(row.external_id as string | null)
      if (coords) orgUnits.add(coords.orgUnitId)
    }
    if (data.length < PAGE) break
  }
  return Array.from(orgUnits)
}

export async function recoverCourseExtractions(
  _admin: SupabaseClient,
  _orgUnitId: string,
  _options?: { dryRun?: boolean; runAutoTag?: boolean }
): Promise<CourseRecoveryResult> {
  // Stub: implemented in Task 3
  throw new Error('recoverCourseExtractions: not yet implemented')
}

export function aggregateRecoveryResults(
  results: CourseRecoveryResult[]
): RecoverySummary {
  const summary: RecoverySummary = {
    orgUnitsProcessed: results.length,
    scanned: 0,
    recovered: 0,
    stillEmpty: { unsupported: 0, noFile: 0, submissionGone: 0, emptyText: 0, downloadError: 0 },
    errorCount: 0,
    perCourse: results,
  }
  for (const r of results) {
    summary.scanned += r.scanned
    summary.recovered += r.recovered
    summary.stillEmpty.unsupported += r.stillEmpty.unsupported
    summary.stillEmpty.noFile += r.stillEmpty.noFile
    summary.stillEmpty.submissionGone += r.stillEmpty.submissionGone
    summary.stillEmpty.emptyText += r.stillEmpty.emptyText
    summary.stillEmpty.downloadError += r.stillEmpty.downloadError
    summary.errorCount += r.errors.length
  }
  return summary
}

// Prevent unused-import lint errors for imports consumed in Task 3
void listAssignmentSubmissions
void downloadSubmissionFile
void extractText
void isSupported
