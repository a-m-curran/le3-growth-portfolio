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
  try {
    const formData = await req.formData()
    const idToken = formData.get('id_token') as string
    const state = formData.get('state') as string

    if (!idToken || !state) {
      return NextResponse.json(
        { error: 'Missing id_token or state' },
        { status: 400 }
      )
    }

    // Verify state matches the cookie we set during login init
    const cookieState = req.cookies.get('lti_state')?.value
    const cookieNonce = req.cookies.get('lti_nonce')?.value

    if (!cookieState || cookieState !== state) {
      return NextResponse.json({ error: 'State mismatch' }, { status: 401 })
    }

    // Verify JWT (signature, iss, aud, exp, nonce)
    const payload = await verifyPlatformJwt(idToken, cookieNonce)

    const messageType = getMessageType(payload)

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
      return NextResponse.json(
        { error: 'LTI JWT missing email claim — tool requires email scope' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Instructor launch — send to coach dashboard
    if (isInstructor(payload)) {
      const { data: coach } = await admin
        .from('coach')
        .select('id, auth_user_id')
        .eq('email', email)
        .single()

      if (coach && coach.auth_user_id) {
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

      return redirectWithSession(admin, email, '/coach', req.nextUrl.origin)
    }

    // Student launch
    if (!isStudent(payload)) {
      return NextResponse.json(
        { error: 'LTI role not recognized as student or instructor' },
        { status: 403 }
      )
    }

    // Find or provision the student record
    const { data: existing } = await admin
      .from('student')
      .select('id, auth_user_id')
      .eq('email', email)
      .single()

    if (!existing) {
      // Create Supabase auth user
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      })

      if (!created.data.user) {
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
        .single()

      if (!defaultCoach) {
        return NextResponse.json(
          {
            error:
              'Cannot provision student: no active coach found. Please have an administrator create a coach record first.',
          },
          { status: 500 }
        )
      }

      // Generate a stable NLU ID from the LTI sub claim (unique per platform user)
      const nluId = `lti:${payload.sub.substring(0, 32)}`

      await admin.from('student').insert({
        auth_user_id: created.data.user.id,
        nlu_id: nluId,
        first_name: firstName,
        last_name: lastName || 'Student',
        email,
        coach_id: defaultCoach.id,
        cohort: getCurrentQuarter(),
        program_start_date: new Date().toISOString().split('T')[0],
        status: 'active',
      })
    }

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
