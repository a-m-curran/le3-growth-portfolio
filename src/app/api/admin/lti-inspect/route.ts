import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/lti-inspect
 *
 * Coach-only dashboard endpoint that returns current LTI integration
 * state — tool URLs, platform config presence, recent launch attempts,
 * deep-linked resources, and LTI-provisioned students. Designed to be
 * consumed by the Sync Inspector panel's LTI tab while testing with
 * NLU IT on the Brightspace test instance.
 *
 * Env var VALUES are NOT returned — only presence indicators. The log
 * contains user-identifiable data (emails, sub IDs) which is fine for
 * coach-auth'd viewing but not for public exposure.
 */
export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: coach } = await admin
    .from('coach')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!coach) {
    return NextResponse.json({ error: 'Coach access required' }, { status: 403 })
  }

  // ─── Tool config: derived URLs and env var presence ────────
  const toolUrl =
    process.env.LTI_TOOL_URL || 'https://le3-growth-portfolio.vercel.app'

  const toolEndpoints = {
    login: `${toolUrl}/api/lti/login`,
    launch: `${toolUrl}/api/lti/launch`,
    jwks: `${toolUrl}/api/lti/jwks`,
    config: `${toolUrl}/api/lti/config`,
    register_guide: `${toolUrl}/lti/register`,
  }

  const envPresence = {
    LTI_PRIVATE_KEY: !!process.env.LTI_PRIVATE_KEY,
    LTI_PUBLIC_KEY: !!process.env.LTI_PUBLIC_KEY,
    LTI_KEY_ID: !!process.env.LTI_KEY_ID,
    LTI_PLATFORM_ISSUER: !!process.env.LTI_PLATFORM_ISSUER,
    LTI_PLATFORM_CLIENT_ID: !!process.env.LTI_PLATFORM_CLIENT_ID,
    LTI_PLATFORM_AUTH_URL: !!process.env.LTI_PLATFORM_AUTH_URL,
    LTI_PLATFORM_TOKEN_URL: !!process.env.LTI_PLATFORM_TOKEN_URL,
    LTI_PLATFORM_JWKS_URL: !!process.env.LTI_PLATFORM_JWKS_URL,
    LTI_DEPLOYMENT_ID: !!process.env.LTI_DEPLOYMENT_ID,
    LTI_TOOL_URL: !!process.env.LTI_TOOL_URL,
  }

  // Return truncated issuer value (non-sensitive) so coach can verify
  // they pasted the right one without exposing secrets.
  const nonSensitive = {
    LTI_PLATFORM_ISSUER: process.env.LTI_PLATFORM_ISSUER ?? null,
    LTI_PLATFORM_AUTH_URL: process.env.LTI_PLATFORM_AUTH_URL ?? null,
    LTI_PLATFORM_TOKEN_URL: process.env.LTI_PLATFORM_TOKEN_URL ?? null,
    LTI_PLATFORM_JWKS_URL: process.env.LTI_PLATFORM_JWKS_URL ?? null,
    LTI_TOOL_URL: process.env.LTI_TOOL_URL ?? null,
    LTI_KEY_ID: process.env.LTI_KEY_ID ?? null,
    // Only show last 4 chars of client ID / deployment ID, enough to
    // confirm which value is set without leaking to a browser console.
    LTI_PLATFORM_CLIENT_ID_suffix: process.env.LTI_PLATFORM_CLIENT_ID
      ? '…' + process.env.LTI_PLATFORM_CLIENT_ID.slice(-4)
      : null,
    LTI_DEPLOYMENT_ID_suffix: process.env.LTI_DEPLOYMENT_ID
      ? '…' + process.env.LTI_DEPLOYMENT_ID.slice(-4)
      : null,
  }

  const allRequiredEnvsPresent =
    envPresence.LTI_PRIVATE_KEY &&
    envPresence.LTI_PUBLIC_KEY &&
    envPresence.LTI_KEY_ID &&
    envPresence.LTI_PLATFORM_ISSUER &&
    envPresence.LTI_PLATFORM_CLIENT_ID &&
    envPresence.LTI_PLATFORM_AUTH_URL &&
    envPresence.LTI_PLATFORM_TOKEN_URL &&
    envPresence.LTI_PLATFORM_JWKS_URL &&
    envPresence.LTI_DEPLOYMENT_ID

  // ─── Recent launch attempts ────────────────────
  interface LaunchRow {
    id: string
    launched_at: string
    status: string
    message_type: string | null
    platform_issuer: string | null
    resource_link_id: string | null
    resource_link_title: string | null
    context_id: string | null
    context_title: string | null
    user_sub: string | null
    user_email: string | null
    user_name: string | null
    student_id: string | null
    error_stage: string | null
    error_message: string | null
    duration_ms: number | null
  }
  const { data: launchesRaw } = await admin
    .from('lti_launch_log')
    .select(
      'id, launched_at, status, message_type, platform_issuer, ' +
        'resource_link_id, resource_link_title, context_id, context_title, ' +
        'user_sub, user_email, user_name, student_id, ' +
        'error_stage, error_message, duration_ms'
    )
    .order('launched_at', { ascending: false })
    .limit(20)
  const launches = (launchesRaw ?? []) as unknown as LaunchRow[]

  const launchCounts = {
    total: launches.length,
    success: launches.filter(l => l.status === 'success').length,
    jwt_error: launches.filter(l => l.status === 'jwt_error').length,
    provision_error: launches.filter(l => l.status === 'provision_error').length,
    other_error: launches.filter(l => l.status === 'other_error').length,
  }

  // ─── Deep-linked resources ─────────────────────
  const { data: resources } = await admin
    .from('lti_resource')
    .select(
      'id, platform_issuer, resource_link_id, deployment_id, context_id, ' +
        'context_title, assignment_title, line_item_id, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(20)

  // ─── LTI-provisioned students ──────────────────
  // Students whose nlu_id was claimed via an LTI launch have the
  // 'lti:' prefix on nlu_id.
  const { data: ltiStudents } = await admin
    .from('student')
    .select('id, first_name, last_name, email, nlu_id, d2l_user_id, cohort, status, created_at')
    .like('nlu_id', 'lti:%')
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    tool: {
      url: toolUrl,
      endpoints: toolEndpoints,
    },
    env: {
      allRequiredPresent: allRequiredEnvsPresent,
      presence: envPresence,
      values: nonSensitive,
    },
    launches,
    launchCounts,
    resources: resources ?? [],
    ltiStudents: ltiStudents ?? [],
  })
}
