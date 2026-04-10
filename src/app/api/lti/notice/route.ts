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
 * Downloads assets, creates student_work records, auto-tags, and reports back.
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

  // Look up student by LTI sub (stored as nlu_id = 'lti:{sub}' on launch provisioning)
  const ltiNluId = `lti:${forUser.user_id.substring(0, 32)}`
  const { data: student } = await admin
    .from('student')
    .select('id')
    .eq('nlu_id', ltiNluId)
    .single()

  if (!student) {
    // Student hasn't launched yet. Store a pending submission record so we
    // can hydrate it when they do. For MVP we log and skip.
    console.warn(
      `Asset processor notice for unknown LTI user ${forUser.user_id} — ` +
      `student must launch Growth Portfolio first.`
    )
    results.push({
      assetId: assetService.assets[0]?.asset_id || 'unknown',
      status: 'skipped',
      message: 'Student has not launched Growth Portfolio yet',
    })
    return
  }

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
        activityTitle: activity?.title,
        submissionId: submission?.id,
        contextTitle: context?.title,
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
 * Download a single asset, extract text, create student_work, auto-tag,
 * and send a ready report back to the platform.
 */
async function processAsset({
  asset,
  studentId,
  activityTitle,
  submissionId,
  contextTitle,
  platformIssuer,
  reportUrl,
  quarter,
}: {
  asset: LtiAsset
  studentId: string
  activityTitle?: string
  submissionId?: string
  contextTitle?: string
  platformIssuer: string
  reportUrl?: string
  quarter: string
}): Promise<void> {
  const admin = createAdminClient()

  // Check for existing record (dedup via external_id)
  const externalId = `lti:${platformIssuer}:${submissionId || ''}:${asset.asset_id}`
  const { data: existing } = await admin
    .from('student_work')
    .select('id')
    .eq('external_id', externalId)
    .limit(1)
    .single()

  if (existing) {
    // Already processed — just re-send the ready report
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
      title,
      description: null,
      work_type: workType,
      course_name: contextTitle || null,
      submitted_at: asset.timestamp || new Date().toISOString(),
      quarter,
      content,
      source: 'd2l_api',
      external_id: externalId,
      imported_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !work) {
    throw new Error(`DB insert failed: ${insertError?.message || 'unknown'}`)
  }

  // Auto-tag with skills
  try {
    const tags = await autoTagWork({
      id: work.id,
      studentId,
      title,
      workType,
      courseName: contextTitle,
      submittedAt: asset.timestamp || new Date().toISOString(),
      quarter,
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
