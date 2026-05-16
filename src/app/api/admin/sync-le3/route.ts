import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { tasks } from '@trigger.dev/sdk'
import { isValenceConfigured } from '@/lib/d2l'
import type { syncLe3Task } from '@/trigger/sync-le3'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/sync-le3
 *
 * Triggers an LE3 data sync via Trigger.dev. Trigger.dev is REQUIRED:
 * if TRIGGER_SECRET_KEY is not set on this deployment, the route returns
 * 503 immediately. There is no inline fallback.
 *
 * The sync parent task fans out one child task per course. Providing
 * `le3OrgUnitId` in the request body causes the parent to fan out exactly
 * one child (for that single course override) rather than all configured
 * courses.
 *
 * Access control: only authenticated coaches can trigger a sync.
 *
 * Body (all optional):
 *   {
 *     "mode": "full" | "incremental",       // default "incremental"
 *     "source": "d2l_valence_manual" | ...   // default "d2l_valence_manual"
 *     "le3OrgUnitId": "12345"               // override env default (single-course fan-out)
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    // ─── Auth: only coaches can trigger a sync ─────
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
        { error: 'Sync can only be triggered by coaches' },
        { status: 403 }
      )
    }

    // ─── Config check ─────────────────────────────
    if (!isValenceConfigured()) {
      return NextResponse.json(
        {
          error:
            'D2L Valence is not configured on this deployment. Set D2L_VALENCE_* environment variables.',
        },
        { status: 503 }
      )
    }

    // ─── Parse body ───────────────────────────────
    const body = (await req.json().catch(() => ({}))) as {
      mode?: 'full' | 'incremental'
      source?: 'd2l_valence_manual' | 'd2l_valence_backfill'
      le3OrgUnitId?: string
    }

    const mode = body.mode || 'incremental'
    const source = body.source || 'd2l_valence_manual'
    const triggeredBy = coach.email

    // ─── Trigger.dev enqueue (required) ──────────
    if (!process.env.TRIGGER_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Sync requires Trigger.dev. TRIGGER_SECRET_KEY is not set on this deployment.' },
        { status: 503 }
      )
    }
    const handle = await tasks.trigger<typeof syncLe3Task>('sync-le3', {
      mode,
      source,
      triggeredBy,
      le3OrgUnitId: body.le3OrgUnitId,
    })
    return NextResponse.json({
      status: 'enqueued',
      triggerRunId: handle.id,
      message: 'Sync task enqueued via Trigger.dev',
    })
  } catch (error) {
    console.error('Sync trigger error:', error)
    return NextResponse.json(
      { error: 'Sync trigger failed: ' + String(error) },
      { status: 500 }
    )
  }
}
