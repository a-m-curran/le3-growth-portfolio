import { NextRequest, NextResponse } from 'next/server'
import { verifyPlatformJwt } from '@/lib/lti/jwt'
import { createAdminClient } from '@/lib/supabase-admin'
import { subscribeAll } from '@/lib/lti/notice-subscription'
import {
  LTI_CLAIMS,
  getMessageType,
  isStudent,
  isInstructor,
} from '@/lib/lti/claims'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Data accumulated over the course of a launch attempt that we want
 * recorded in lti_launch_log regardless of outcome. Populated
 * progressively as we pull values out of the JWT; flushed to the DB
 * in a finally block so even unexpected throws are observable.
 */
interface LaunchLogEntry {
  status:
    | 'success'
    | 'jwt_error'
    | 'config_error'
    | 'provision_error'
    | 'other_error'
  error_stage:
    | 'state_mismatch'
    | 'jwt_verify'
    | 'claim_extract'
    | 'provision_user'
    | 'session_create'
    | 'other'
    | null
  error_message: string | null
  message_type: string | null
  platform_issuer: string | null
  client_id: string | null
  deployment_id: string | null
  resource_link_id: string | null
  resource_link_title: string | null
  context_id: string | null
  context_title: string | null
  user_sub: string | null
  user_email: string | null
  user_name: string | null
  student_id: string | null
}

async function writeLaunchLog(
  admin: ReturnType<typeof createAdminClient>,
  entry: LaunchLogEntry,
  durationMs: number
): Promise<void> {
  try {
    await admin.from('lti_launch_log').insert({
      status: entry.status,
      error_stage: entry.error_stage,
      error_message: entry.error_message,
      message_type: entry.message_type,
      platform_issuer: entry.platform_issuer,
      client_id: entry.client_id,
      deployment_id: entry.deployment_id,
      resource_link_id: entry.resource_link_id,
      resource_link_title: entry.resource_link_title,
      context_id: entry.context_id,
      context_title: entry.context_title,
      user_sub: entry.user_sub,
      user_email: entry.user_email,
      user_name: entry.user_name,
      student_id: entry.student_id,
      duration_ms: durationMs,
    })
  } catch (logErr) {
    // Never let logging break the launch itself — but complain loudly.
    console.error('Failed to write lti_launch_log row:', logErr)
  }
}

function getCurrentQuarter(): string {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  if (month < 3) return `Winter ${year}`
  if (month < 6) return `Spring ${year}`
  if (month < 9) return `Summer ${year}`
  return `Fall ${year}`
}

/**
 * POST /api/lti/launch
 *
 * LTI 1.3 launch endpoint. Brightspace posts here after the OIDC auth
 * redirect with a signed id_token. We verify the token, provision the
 * student if needed, establish a Supabase session, and redirect to the
 * portfolio (or deep linking flow for instructors).
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  const admin = createAdminClient()
  const logEntry: LaunchLogEntry = {
    status: 'other_error',
    error_stage: 'other',
    error_message: null,
    message_type: null,
    platform_issuer: null,
    client_id: null,
    deployment_id: null,
    resource_link_id: null,
    resource_link_title: null,
    context_id: null,
    context_title: null,
    user_sub: null,
    user_email: null,
    user_name: null,
    student_id: null,
  }

  try {
    const formData = await req.formData()
    const idToken = formData.get('id_token') as string
    const state = formData.get('state') as string

    if (!idToken || !state) {
      logEntry.status = 'jwt_error'
      logEntry.error_stage = 'jwt_verify'
      logEntry.error_message = 'Missing id_token or state'
      await writeLaunchLog(admin, logEntry, Date.now() - startedAt)
      return NextResponse.json(
        { error: 'Missing id_token or state' },
        { status: 400 }
      )
    }

    // Verify state matches the cookie we set during login init
    const cookieState = req.cookies.get('lti_state')?.value
    const cookieNonce = req.cookies.get('lti_nonce')?.value

    if (!cookieState || cookieState !== state) {
      logEntry.status = 'jwt_error'
      logEntry.error_stage = 'state_mismatch'
      logEntry.error_message = 'State cookie mismatch with form-posted state'
      await writeLaunchLog(admin, logEntry, Date.now() - startedAt)
      return NextResponse.json({ error: 'State mismatch' }, { status: 401 })
    }

    // Verify JWT (signature, iss, aud, exp, nonce)
    const payload = await verifyPlatformJwt(idToken, cookieNonce)

    // Capture platform/deployment/message info as early as possible so
    // even downstream failures have useful breadcrumbs in the log.
    logEntry.platform_issuer = (payload.iss as string) ?? null
    logEntry.client_id = Array.isArray(payload.aud)
      ? (payload.aud[0] as string)
      : ((payload.aud as string) ?? null)
    logEntry.deployment_id =
      (payload[LTI_CLAIMS.DEPLOYMENT_ID] as string) ?? null
    logEntry.user_sub = (payload.sub as string) ?? null
    logEntry.user_email =
      (payload.email as string | undefined)?.toLowerCase() ?? null
    logEntry.user_name = (payload.name as string) ?? null
    const rLink = payload[LTI_CLAIMS.RESOURCE_LINK]
    if (rLink) {
      logEntry.resource_link_id = rLink.id ?? null
      logEntry.resource_link_title = rLink.title ?? null
    }
    const cx = payload[LTI_CLAIMS.CONTEXT]
    if (cx) {
      logEntry.context_id = cx.id ?? null
      logEntry.context_title = cx.title ?? null
    }

    const messageType = getMessageType(payload)
    logEntry.message_type = messageType ?? null

    // Opportunistically subscribe to the Platform Notification Service
    // whenever we see a launch with the PNS endpoint claim. The platform
    // treats re-subscribing as idempotent, and subscribing on every launch
    // means the first instructor who launches the tool self-provisions
    // the notice handler without needing a manual admin trigger.
    const pnsEndpoint = payload[LTI_CLAIMS.PNS_ENDPOINT]
    if (pnsEndpoint?.platform_notification_service_url) {
      subscribeAll(pnsEndpoint).catch(err => {
        console.error('PNS subscription failed (non-fatal):', err)
      })
    }

    // Deep linking request — route to the deep link flow
    if (messageType === 'LtiDeepLinkingRequest') {
      // Deep linking is treated as a successful launch for observability.
      // The per-resource DB row for what the instructor picks gets written
      // later in /api/lti/deep-link, not here.
      logEntry.status = 'success'
      logEntry.error_stage = null
      await writeLaunchLog(admin, logEntry, Date.now() - startedAt)

      // Stash the verified JWT payload in a short-lived cookie so the
      // deep link form can read it
      const response = NextResponse.redirect(
        new URL('/lti/deep-link', req.nextUrl.origin),
        302
      )
      response.cookies.set('lti_deep_link_jwt', idToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 600,
        path: '/',
      })
      return response
    }

    // Resource link launch — the normal student flow
    if (messageType !== 'LtiResourceLinkRequest') {
      logEntry.status = 'other_error'
      logEntry.error_stage = 'claim_extract'
      logEntry.error_message = `Unsupported LTI message type: ${messageType}`
      await writeLaunchLog(admin, logEntry, Date.now() - startedAt)
      return NextResponse.json(
        { error: `Unsupported LTI message type: ${messageType}` },
        { status: 400 }
      )
    }

    // Extract identity + context
    const email = payload.email?.toLowerCase()
    const firstName = payload.given_name || 'Student'
    const lastName = payload.family_name || ''
    const resourceLink = payload[LTI_CLAIMS.RESOURCE_LINK]
    const context = payload[LTI_CLAIMS.CONTEXT]

    if (!email) {
      logEntry.status = 'jwt_error'
      logEntry.error_stage = 'claim_extract'
      logEntry.error_message = 'LTI JWT missing email claim — tool requires email scope'
      await writeLaunchLog(admin, logEntry, Date.now() - startedAt)
      return NextResponse.json(
        { error: 'LTI JWT missing email claim — tool requires email scope' },
        { status: 400 }
      )
    }

    // Instructor launch — send to coach dashboard
    if (isInstructor(payload)) {
      const { data: coach } = await admin
        .from('coach')
        .select('id, auth_user_id')
        .eq('email', email)
        .single()

      if (coach && coach.auth_user_id) {
        logEntry.status = 'success'
        logEntry.error_stage = null
        await writeLaunchLog(admin, logEntry, Date.now() - startedAt)
        return redirectWithSession(admin, email, '/coach', req.nextUrl.origin)
      }

      // Auto-provision coach if they don't exist yet
      if (!coach) {
        const name = `${firstName} ${lastName}`.trim() || 'Coach'
        const created = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
        })
        if (created.data.user) {
          await admin.from('coach').insert({
            auth_user_id: created.data.user.id,
            name,
            email,
            status: 'active',
          })
        }
      }

      logEntry.status = 'success'
      logEntry.error_stage = null
      await writeLaunchLog(admin, logEntry, Date.now() - startedAt)
      return redirectWithSession(admin, email, '/coach', req.nextUrl.origin)
    }

    // Student launch
    if (!isStudent(payload)) {
      logEntry.status = 'other_error'
      logEntry.error_stage = 'claim_extract'
      logEntry.error_message = 'LTI role not recognized as student or instructor'
      await writeLaunchLog(admin, logEntry, Date.now() - startedAt)
      return NextResponse.json(
        { error: 'LTI role not recognized as student or instructor' },
        { status: 403 }
      )
    }

    // Find or provision the student record
    const { data: existing } = await admin
      .from('student')
      .select('id, auth_user_id, nlu_id')
      .eq('email', email)
      .maybeSingle()

    const ltiNluId = `lti:${payload.sub.substring(0, 32)}`
    let studentId: string | null = existing?.id ?? null

    if (existing) {
      // Student was pre-imported (Valence sync, CSV, or previous LTI launch).
      // Claim the record if needed: ensure auth_user_id is set and nlu_id
      // is in the lti: form so future Asset Processor notices can find them.
      const updates: Record<string, unknown> = {}

      if (!existing.auth_user_id) {
        // Pre-imported record without a Supabase auth account yet. Create one
        // and link it so the student can actually be logged in.
        const created = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
        })
        if (!created.data.user) {
          logEntry.status = 'provision_error'
          logEntry.error_stage = 'provision_user'
          logEntry.error_message =
            'Failed to create Supabase auth user for pre-imported student'
          logEntry.student_id = existing.id
          await writeLaunchLog(admin, logEntry, Date.now() - startedAt)
          return NextResponse.json(
            { error: 'Failed to create Supabase auth user for pre-imported student' },
            { status: 500 }
          )
        }
        updates.auth_user_id = created.data.user.id
      }

      if (existing.nlu_id !== ltiNluId && !existing.nlu_id?.startsWith('lti:')) {
        // Claim the nlu_id on first LTI launch. Any submissions that arrive
        // via Asset Processor notices from this point forward will be able
        // to look up the student by lti:{sub}.
        updates.nlu_id = ltiNluId
      }

      // Always refresh the name from LTI since Brightspace has the canonical
      // spelling and pre-imported records might have placeholder values.
      updates.first_name = firstName
      updates.last_name = lastName || existing.nlu_id || 'Student'

      if (Object.keys(updates).length > 0) {
        await admin.from('student').update(updates).eq('id', existing.id)
      }
    } else {
      // No pre-imported record — provision fresh
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      })

      if (!created.data.user) {
        logEntry.status = 'provision_error'
        logEntry.error_stage = 'provision_user'
        logEntry.error_message = 'Failed to create Supabase auth user for new student'
        await writeLaunchLog(admin, logEntry, Date.now() - startedAt)
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        )
      }

      // Find a default coach to assign — first active coach, or null
      const { data: defaultCoach } = await admin
        .from('coach')
        .select('id')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (!defaultCoach) {
        logEntry.status = 'provision_error'
        logEntry.error_stage = 'provision_user'
        logEntry.error_message =
          'No active coach available to assign new student to'
        await writeLaunchLog(admin, logEntry, Date.now() - startedAt)
        return NextResponse.json(
          {
            error:
              'Cannot provision student: no active coach found. Please have an administrator create a coach record first.',
          },
          { status: 500 }
        )
      }

      const { data: inserted } = await admin
        .from('student')
        .insert({
          auth_user_id: created.data.user.id,
          nlu_id: ltiNluId,
          first_name: firstName,
          last_name: lastName || 'Student',
          email,
          coach_id: defaultCoach.id,
          cohort: getCurrentQuarter(),
          program_start_date: new Date().toISOString().split('T')[0],
          status: 'active',
        })
        .select('id')
        .single()
      studentId = inserted?.id ?? null
    }

    logEntry.student_id = studentId
    logEntry.status = 'success'
    logEntry.error_stage = null
    await writeLaunchLog(admin, logEntry, Date.now() - startedAt)

    // Store the LTI resource link in a cookie so /conversation can
    // feature it at the top of the hub
    const redirectPath = resourceLink?.id
      ? `/conversation?lti_resource=${encodeURIComponent(resourceLink.id)}`
      : '/garden'

    // Store LTI context in a cookie for later use (AGS file sync, etc.)
    const ltiContext = {
      issuer: payload.iss,
      resourceLinkId: resourceLink?.id,
      resourceLinkTitle: resourceLink?.title,
      contextId: context?.id,
      contextTitle: context?.title,
      agsEndpoint: payload[LTI_CLAIMS.AGS_ENDPOINT]?.lineitems || null,
    }

    const response = await redirectWithSession(
      admin,
      email,
      redirectPath,
      req.nextUrl.origin
    )

    response.cookies.set('lti_context', JSON.stringify(ltiContext), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 86400,
      path: '/',
    })

    // Clear state/nonce cookies
    response.cookies.delete('lti_state')
    response.cookies.delete('lti_nonce')

    return response
  } catch (error) {
    console.error('LTI launch error:', error)
    // Unexpected throw — most commonly from verifyPlatformJwt (signature
    // failure, missing JWKS, nonce mismatch) or Supabase admin calls.
    // Record what we know so far so the failure is visible in the
    // Sync Inspector's LTI tab.
    if (logEntry.error_stage === 'other' || logEntry.error_stage === null) {
      // Classify as jwt_error if we hadn't yet extracted claims; otherwise
      // leave whatever stage was in progress.
      if (!logEntry.platform_issuer) {
        logEntry.status = 'jwt_error'
        logEntry.error_stage = 'jwt_verify'
      } else {
        logEntry.status = 'other_error'
        logEntry.error_stage = 'other'
      }
    }
    logEntry.error_message = String(error).slice(0, 1000)
    await writeLaunchLog(admin, logEntry, Date.now() - startedAt)
    return NextResponse.json(
      { error: 'LTI launch failed: ' + String(error) },
      { status: 500 }
    )
  }
}

/**
 * Generate a Supabase magic-link session for the user and redirect
 * through Supabase's verify endpoint so cookies get set properly.
 */
async function redirectWithSession(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  redirectPath: string,
  origin: string
): Promise<NextResponse> {
  // Use Supabase's magic link generator to produce a sign-in URL.
  // The user lands at /api/auth/callback which exchanges the code for a session.
  const callbackUrl = `${origin}/api/auth/callback`
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${callbackUrl}?next=${encodeURIComponent(redirectPath)}`,
    },
  })

  if (error || !data.properties?.action_link) {
    console.error('Failed to generate magic link:', error)
    return NextResponse.redirect(new URL('/login', origin), 302)
  }

  return NextResponse.redirect(data.properties.action_link, 302)
}
