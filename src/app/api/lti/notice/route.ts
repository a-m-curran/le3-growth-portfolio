import { NextRequest, NextResponse } from 'next/server'
import { verifyPlatformJwt } from '@/lib/lti/jwt'
import { createAdminClient } from '@/lib/supabase-admin'
import { downloadAsset } from '@/lib/lti/asset'
import { sendReadyReport, sendFailureReport } from '@/lib/lti/report'
import { extractText, isSupported } from '@/lib/extract-text'
import { autoTagWork } from '@/lib/conversation-engine-live'
import {
  LTI_CLAIMS,
  isAssetProcessorSubmissionNotice,
  type LtiAsset,
  type LtiJwtPayload,
} from '@/lib/lti/claims'
import type { WorkType } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/lti/notice
 *
 * LTI Platform Notification Service webhook. This endpoint is PUBLIC by
 * design (per PNS spec) — security comes from verifying the signed JWT
 * in each incoming notice against the platform's JWKS.
 *
 * Brightspace POSTs here when a student submits an assignment that has
 * the Growth Portfolio attached as an Asset Processor. Body format:
 *
 *   { "notices": [ "<signed-jwt>", "<signed-jwt>", ... ] }
 *
 * For each LtiAssetProcessorSubmissionNotice we:
 *   1. Verify the JWT signature and claims
 *   2. Look up the student by LTI sub (requires prior launch)
 *   3. Download each asset via the asset service URL
 *   4. Extract text content
 *   5. Create a student_work record with external_id for dedup
 *   6. Auto-tag with skills via LLM
 *   7. Send a "ready for reflection" report back to the platform
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { notices: string[] }
    if (!body.notices || !Array.isArray(body.notices)) {
      return NextResponse.json(
        { error: 'Invalid notice body — expected { notices: [] }' },
        { status: 400 }
      )
    }

    const results: { assetId: string; status: 'ok' | 'skipped' | 'error'; message?: string }[] = []

    for (const jwt of body.notices) {
      let payload: LtiJwtPayload
      try {
        payload = await verifyPlatformJwt(jwt)
      } catch (err) {
        console.error('Failed to verify notice JWT:', err)
        results.push({ assetId: 'unknown', status: 'error', message: 'JWT verification failed' })
        continue
      }

      if (!isAssetProcessorSubmissionNotice(payload)) {
        // Not a submission notice — may be HelloWorldNotice or others. Ignore.
        results.push({ assetId: 'unknown', status: 'skipped', message: `Notice type not handled: ${payload[LTI_CLAIMS.NOTICE]?.type}` })
        continue
      }

      await processSubmissionNotice(payload, results)
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error('LTI notice handler error:', error)
    return NextResponse.json(
      { error: 'Notice processing failed: ' + String(error) },
      { status: 500 }
    )
  }
}

/**
 * Process a single LtiAssetProcessorSubmissionNotice.
 * Downloads assets, upserts course/assignment rows, creates student_work
 * records (deduped via brightspace_submission_id which is shared with the
 * Valence sync path), auto-tags, and reports back to the platform.
 */
async function processSubmissionNotice(
  payload: LtiJwtPayload,
  results: { assetId: string; status: 'ok' | 'skipped' | 'error'; message?: string }[]
): Promise<void> {
  const forUser = payload[LTI_CLAIMS.FOR_USER]
  const activity = payload[LTI_CLAIMS.ACTIVITY]
  const submission = payload[LTI_CLAIMS.SUBMISSION]
  const assetService = payload[LTI_CLAIMS.ASSET_SERVICE]
  const assetReport = payload[LTI_CLAIMS.ASSET_REPORT]
  const context = payload[LTI_CLAIMS.CONTEXT]

  if (!forUser?.user_id || !assetService?.assets) {
    results.push({
      assetId: 'unknown',
      status: 'error',
      message: 'Notice missing required claims (for_user, assetservice)',
    })
    return
  }

  const admin = createAdminClient()

  // Look up student by LTI sub (stored as nlu_id = 'lti:{sub}' on launch provisioning).
  // Valence sync may have pre-created this student with nlu_id = 'd2l:{userId}' or
  // their OrgDefinedId — first LTI launch is responsible for claiming the record
  // and updating nlu_id. Here we only look up by the lti: form.
  const ltiNluId = `lti:${forUser.user_id.substring(0, 32)}`
  const { data: student } = await admin
    .from('student')
    .select('id')
    .eq('nlu_id', ltiNluId)
    .maybeSingle()

  if (!student) {
    console.warn(
      `Asset processor notice for unknown LTI user ${forUser.user_id} — ` +
      `student must launch Growth Portfolio first (or run Valence sync).`
    )
    results.push({
      assetId: assetService.assets[0]?.asset_id || 'unknown',
      status: 'skipped',
      message: 'Student has not launched Growth Portfolio yet',
    })
    return
  }

  // Try to link to the course and assignment rows if Valence sync has
  // already created them. If not, we'll skip the linkage and let a later
  // Valence sync backfill the assignment_id via brightspace_submission_id.
  const courseRowId = await lookupCourseByLtiContext(context?.id)
  const assignmentRowId = courseRowId
    ? await lookupOrCreateAssignment({
        courseRowId,
        folderId: activity?.id,
        title: activity?.title,
        description: activity?.description,
        orgUnitId: context?.id,
      })
    : null

  // Determine quarter
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  let quarter: string
  if (month < 3) quarter = `Winter ${year}`
  else if (month < 6) quarter = `Spring ${year}`
  else if (month < 9) quarter = `Summer ${year}`
  else quarter = `Fall ${year}`

  // Process each asset in the notice
  for (const asset of assetService.assets) {
    try {
      await processAsset({
        asset,
        studentId: student.id,
        assignmentRowId,
        activityTitle: activity?.title,
        activityDescription: activity?.description,
        submissionId: submission?.id,
        attemptNumber: submission?.attempt,
        contextTitle: context?.title,
        contextLabel: context?.label,
        platformIssuer: payload.iss,
        reportUrl: assetReport?.report_url,
        quarter,
      })
      results.push({ assetId: asset.asset_id, status: 'ok' })
    } catch (err) {
      const msg = String(err)
      console.error(`Failed to process asset ${asset.asset_id}:`, err)
      results.push({ assetId: asset.asset_id, status: 'error', message: msg })

      // Send failure report back to platform
      if (assetReport?.report_url) {
        try {
          await sendFailureReport(assetReport.report_url, asset.asset_id, msg)
        } catch (reportErr) {
          console.error('Failed to send failure report:', reportErr)
        }
      }
    }
  }
}

/**
 * Look up an existing course row by Brightspace org unit ID, returning
 * null if Valence sync hasn't discovered this course yet.
 */
async function lookupCourseByLtiContext(
  orgUnitId?: string
): Promise<string | null> {
  if (!orgUnitId) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('course')
    .select('id')
    .eq('brightspace_org_unit_id', orgUnitId)
    .maybeSingle()
  return data?.id || null
}

/**
 * Look up or create an assignment row for an LTI activity. If the
 * assignment already exists (from Valence sync), returns its ID and
 * optionally updates description if the notice carries a richer prompt.
 */
async function lookupOrCreateAssignment(params: {
  courseRowId: string
  folderId?: string
  title?: string
  description?: string
  orgUnitId?: string
}): Promise<string | null> {
  if (!params.folderId || !params.title) return null
  const admin = createAdminClient()
  const externalId = `d2l:${params.orgUnitId}:${params.folderId}`

  const { data: existing } = await admin
    .from('assignment')
    .select('id, description')
    .eq('external_id', externalId)
    .maybeSingle()

  if (existing) {
    // If our existing row has no description but the notice carries one, fill it in.
    if (!existing.description && params.description) {
      await admin
        .from('assignment')
        .update({ description: params.description, synced_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
    return existing.id as string
  }

  const { data: inserted } = await admin
    .from('assignment')
    .insert({
      external_id: externalId,
      brightspace_folder_id: params.folderId,
      course_id: params.courseRowId,
      title: params.title,
      description: params.description,
      active: true,
    })
    .select('id')
    .single()

  return inserted?.id || null
}

/**
 * Download a single asset, extract text, create student_work, auto-tag,
 * and send a ready report back to the platform.
 */
async function processAsset({
  asset,
  studentId,
  assignmentRowId,
  activityTitle,
  activityDescription,
  submissionId,
  attemptNumber,
  contextTitle,
  contextLabel,
  platformIssuer,
  reportUrl,
  quarter,
}: {
  asset: LtiAsset
  studentId: string
  assignmentRowId: string | null
  activityTitle?: string
  activityDescription?: string
  submissionId?: string
  attemptNumber?: number
  contextTitle?: string
  contextLabel?: string
  platformIssuer: string
  reportUrl?: string
  quarter: string
}): Promise<void> {
  const admin = createAdminClient()

  // Dedup by the unified brightspace_submission_id key, so Valence sync and
  // Asset Processor notices converge on the same row when they see the same
  // D2L submission. Falls back to legacy external_id for older records.
  const externalId = `lti:${platformIssuer}:${submissionId || ''}:${asset.asset_id}`

  if (submissionId) {
    const { data: existingByBsId } = await admin
      .from('student_work')
      .select('id')
      .eq('brightspace_submission_id', submissionId)
      .maybeSingle()

    if (existingByBsId) {
      // Already processed by either path — just re-send the ready report
      if (reportUrl) {
        await sendReadyReport(reportUrl, asset.asset_id, activityTitle)
      }
      return
    }
  }

  // Legacy fallback: check by old-format external_id
  const { data: existingByExternalId } = await admin
    .from('student_work')
    .select('id')
    .eq('external_id', externalId)
    .maybeSingle()

  if (existingByExternalId) {
    if (reportUrl) {
      await sendReadyReport(reportUrl, asset.asset_id, activityTitle)
    }
    return
  }

  // Download the asset file
  const downloaded = await downloadAsset(asset)

  // Extract text if supported
  let content: string | null = null
  const filename = downloaded.filename
  if (isSupported(filename)) {
    try {
      content = await extractText(downloaded.buffer, filename)
    } catch (err) {
      console.error(`Text extraction failed for ${filename}:`, err)
    }
  } else if (downloaded.contentType.startsWith('text/')) {
    // Canvas sends text submissions as text/html — handle them
    content = downloaded.buffer.toString('utf-8').substring(0, 8000)
  }

  // Infer work type from title
  const title = activityTitle || asset.title || 'Assignment'
  const workType = inferWorkType(title) as WorkType

  // Create the student_work record
  const { data: work, error: insertError } = await admin
    .from('student_work')
    .insert({
      student_id: studentId,
      assignment_id: assignmentRowId,
      title,
      description: activityDescription || null,
      work_type: workType,
      course_name: contextTitle || null,
      course_code: contextLabel || null,
      submitted_at: asset.timestamp || new Date().toISOString(),
      quarter,
      attempt_number: attemptNumber || null,
      content,
      source: 'd2l_lti_notice',
      external_id: externalId,
      brightspace_submission_id: submissionId || null,
      imported_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !work) {
    // 23505 = unique_violation. Race condition: Valence sync or another
    // concurrent notice beat us to the same brightspace_submission_id. Treat
    // as idempotent success.
    if (insertError?.code === '23505') {
      if (reportUrl) {
        await sendReadyReport(reportUrl, asset.asset_id, activityTitle)
      }
      return
    }
    throw new Error(`DB insert failed: ${insertError?.message || 'unknown'}`)
  }

  // Auto-tag with skills — include assignment description so the LLM
  // can use the instructor's prompt as context for skill inference
  try {
    const tags = await autoTagWork({
      id: work.id,
      studentId,
      assignmentId: assignmentRowId || undefined,
      title,
      description: activityDescription || undefined,
      workType,
      courseName: contextTitle,
      courseCode: contextLabel,
      submittedAt: asset.timestamp || new Date().toISOString(),
      quarter,
      attemptNumber: attemptNumber,
      content: content || undefined,
    })

    if (tags.length > 0) {
      await admin.from('work_skill_tag').insert(
        tags.map(t => ({
          work_id: work.id,
          skill_id: t.skillId,
          confidence: t.confidence,
          rationale: t.rationale,
          source: 'llm_auto',
        }))
      )
    }
  } catch (err) {
    console.error('Auto-tagging failed (non-fatal):', err)
  }

  // Send ready report back to platform
  if (reportUrl) {
    await sendReadyReport(reportUrl, asset.asset_id, title)
  }
}

function inferWorkType(title: string): string {
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
