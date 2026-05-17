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

interface EmptyRow {
  id: string
  externalId: string
}

/**
 * Per-course recovery. READ-only except for one content-only UPDATE per
 * recovered row (skipped entirely when dryRun). Re-list each folder once
 * (rows are grouped by folderId), match the submission by id, download
 * its first file, re-extract with the fixed extractor.
 */
export async function recoverCourseExtractions(params: {
  admin: SupabaseClient
  orgUnitId: string
  dryRun: boolean
  /** Seam (default false). When false the LLM auto-tag branch is skipped
   *  entirely — no cost, no work_skill_tag writes. Body intentionally
   *  unimplemented (spec out-of-scope); enabling later is additive. */
  runAutoTag?: boolean
}): Promise<CourseRecoveryResult> {
  const { admin, orgUnitId, dryRun } = params
  const runAutoTag = params.runAutoTag ?? false

  const result: CourseRecoveryResult = {
    orgUnitId,
    scanned: 0,
    recovered: 0,
    stillEmpty: { unsupported: 0, noFile: 0, submissionGone: 0, emptyText: 0, downloadError: 0 },
    errors: [],
  }

  // Collect this course's empty rows (paginated, JS-side empty filter).
  const empties: EmptyRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('student_work')
      .select('id, external_id, content')
      .eq('source', 'd2l_valence_sync')
      .like('external_id', `d2l:${orgUnitId}:%`)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`recover select failed (ou=${orgUnitId}): ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data) {
      if (!isEmpty(row.content as string | null)) continue
      empties.push({ id: row.id as string, externalId: row.external_id as string })
    }
    if (data.length < PAGE) break
  }
  result.scanned = empties.length

  // Group rows by folder so each folder is listed exactly once.
  const byFolder = new Map<string, { folderId: string; rows: { id: string; submissionId: string }[] }>()
  for (const row of empties) {
    const coords = parseWorkExternalId(row.externalId)
    if (!coords) {
      result.errors.push(`unparseable external_id: ${row.externalId}`)
      continue
    }
    const g = byFolder.get(coords.folderId) ?? { folderId: coords.folderId, rows: [] }
    g.rows.push({ id: row.id, submissionId: coords.submissionId })
    byFolder.set(coords.folderId, g)
  }

  for (const group of byFolder.values()) {
    let submissions
    try {
      submissions = await listAssignmentSubmissions(orgUnitId, group.folderId)
    } catch (err) {
      result.errors.push(`folder ${group.folderId} list failed: ${String(err)}`)
      continue
    }
    const byId = new Map(submissions.map(s => [s.submissionId, s]))

    for (const row of group.rows) {
      const submission = byId.get(row.submissionId)
      if (!submission) {
        result.stillEmpty.submissionGone++
        continue
      }
      if (submission.files.length === 0) {
        result.stillEmpty.noFile++
        continue
      }
      const file = submission.files[0]
      let extracted = ''
      try {
        const downloaded = await downloadSubmissionFile(
          orgUnitId, group.folderId, submission.submissionId, file.fileId
        )
        if (isSupported(downloaded.filename)) {
          extracted = await extractText(downloaded.buffer, downloaded.filename)
        } else if (downloaded.contentType.startsWith('text/')) {
          extracted = downloaded.buffer.toString('utf-8').substring(0, 8000)
        } else {
          result.stillEmpty.unsupported++
          continue
        }
      } catch (err) {
        result.stillEmpty.downloadError++
        result.errors.push(
          `download/extract failed (sub=${submission.submissionId} file=${file.fileName}): ${String(err)}`
        )
        continue
      }

      if (!extracted || extracted.trim().length === 0) {
        result.stillEmpty.emptyText++
        continue
      }

      result.recovered++
      if (dryRun) continue

      const { error: updErr } = await admin
        .from('student_work')
        .update({ content: extracted })
        .eq('id', row.id)
      if (updErr) {
        result.recovered--
        result.errors.push(`update failed (work=${row.id}): ${updErr.message}`)
        continue
      }

      if (runAutoTag) {
        // SEAM (intentionally unimplemented; default-off, spec out-of-
        // scope). Future: autoTagWork(work) + work_skill_tag insert.
      }
    }
  }

  return result
}

/** Sum per-course results into one run summary. Pure. */
export function aggregateRecoveryResults(
  results: CourseRecoveryResult[]
): RecoverySummary {
  const stillEmpty = {
    unsupported: 0, noFile: 0, submissionGone: 0, emptyText: 0, downloadError: 0,
  }
  let scanned = 0
  let recovered = 0
  let errorCount = 0
  for (const r of results) {
    scanned += r.scanned
    recovered += r.recovered
    errorCount += r.errors.length
    stillEmpty.unsupported += r.stillEmpty.unsupported
    stillEmpty.noFile += r.stillEmpty.noFile
    stillEmpty.submissionGone += r.stillEmpty.submissionGone
    stillEmpty.emptyText += r.stillEmpty.emptyText
    stillEmpty.downloadError += r.stillEmpty.downloadError
  }
  return {
    orgUnitsProcessed: results.length,
    scanned,
    recovered,
    stillEmpty,
    errorCount,
    perCourse: results,
  }
}
