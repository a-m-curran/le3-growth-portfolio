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
 * Triggers an LE3 data sync. Two modes:
 *
 *   1. Trigger.dev enqueue (preferred): if TRIGGER_SECRET_KEY is set,
 *      the sync runs as a durable Trigger.dev task with retries and
 *      progress metadata. Returns a trigger run ID immediately.
 *
 *   2. Inline fallback: if Trigger.dev isn't configured, the sync
 *      runs synchronously in this request. Response blocks until
 *      sync completes. Only suitable for small pilot cohorts; larger
 *      syncs will exceed Vercel's serverless function timeout.
 *
 * Access control: only authenticated coaches can trigger a sync.
 *
 * Body (all optional):
 *   {
 *     "mode": "full" | "incremental",       // default "incremental"
 *     "source": "d2l_valence_manual" | ...   // default "d2l_valence_manual"
 *     "le3OrgUnitId": "12345"               // override env default
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

    // ─── Trigger.dev enqueue (preferred) ─────────
    if (process.env.TRIGGER_SECRET_KEY) {
      try {
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
      } catch (err) {
        console.error('Trigger.dev enqueue failed, falling back to inline:', err)
      }
    }

    // ─── Inline fallback ─────────────────────────
    // Only suitable for small cohorts. Imports lazily so the Trigger.dev SDK
    // doesn't pull the sync engine into every request.
    const { runLe3Sync } = await import('@/lib/sync/sync-engine')
    const result = await runLe3Sync({
      mode,
      source,
      triggeredBy,
      le3OrgUnitId: body.le3OrgUnitId,
    })

    return NextResponse.json({
      status: 'completed',
      syncRunId: result.syncRunId,
      counts: result.counts,
      durationMs: result.durationMs,
      errorCount: result.errors.length,
      message: 'Sync completed inline (Trigger.dev not configured)',
    })
  } catch (error) {
    console.error('Sync trigger error:', error)
    return NextResponse.json(
      { error: 'Sync trigger failed: ' + String(error) },
      { status: 500 }
    )
  }
}
