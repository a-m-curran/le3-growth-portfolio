import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { isAdminEmail } from '@/lib/v2-auth'
import { tasks } from '@trigger.dev/sdk'
import type { recoverEmptyExtractionsTask } from '@/trigger/recover-empty-extractions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/recover-extractions
 *
 * Enqueues the one-time empty-extraction recovery via Trigger.dev.
 * Trigger.dev is REQUIRED: if TRIGGER_SECRET_KEY is unset, returns 503.
 *
 * Access control (defense-in-depth; the Tools page is already
 * ADMIN_EMAILS-gated): authenticated coach AND isAdminEmail(coach.email).
 *
 * Body (all optional):
 *   { "dryRun": boolean (default true), "runAutoTag": boolean (default false) }
 */
export async function POST(req: NextRequest) {
  try {
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
      .select('id, email, name')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!coach) {
      return NextResponse.json(
        { error: 'Recovery can only be triggered by coaches' },
        { status: 403 }
      )
    }

    if (!isAdminEmail(coach.email as string)) {
      return NextResponse.json(
        { error: 'Recovery is limited to designated administrators' },
        { status: 403 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as {
      dryRun?: boolean
      runAutoTag?: boolean
    }
    const dryRun = body.dryRun !== false // default true
    const runAutoTag = body.runAutoTag === true // default false

    if (!process.env.TRIGGER_SECRET_KEY) {
      return NextResponse.json(
        {
          error:
            'Recovery requires Trigger.dev. TRIGGER_SECRET_KEY is not set on this deployment.',
        },
        { status: 503 }
      )
    }

    const handle = await tasks.trigger<typeof recoverEmptyExtractionsTask>(
      'recover-empty-extractions',
      { dryRun, runAutoTag, triggeredBy: coach.email as string }
    )

    return NextResponse.json({
      status: 'enqueued',
      dryRun,
      triggerRunId: handle.id,
      message: `Recovery task enqueued via Trigger.dev (dryRun=${dryRun})`,
    })
  } catch (error) {
    console.error('Recovery trigger error:', error)
    return NextResponse.json(
      { error: 'Recovery trigger failed: ' + String(error) },
      { status: 500 }
    )
  }
}
