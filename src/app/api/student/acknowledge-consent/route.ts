import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { log } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getAuthClient() {
  const cookieStore = cookies()
  return createServerClient(
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
}

/**
 * GET /api/student/acknowledge-consent
 *
 * Returns whether the authenticated student has already acknowledged
 * the data-handling notice. Used by the consent modal to decide
 * whether to render itself.
 */
export async function GET() {
  const supabase = getAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: student } = await admin
    .from('student')
    .select('id, data_consent_acknowledged_at')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!student) {
    // Not a student (could be a coach). Treat as "no acknowledgement
    // needed" so the consent modal stays out of non-student flows.
    return NextResponse.json({ acknowledged: true, acknowledgedAt: null })
  }

  return NextResponse.json({
    acknowledged: !!student.data_consent_acknowledged_at,
    acknowledgedAt: student.data_consent_acknowledged_at,
  })
}

/**
 * POST /api/student/acknowledge-consent
 *
 * Records that the authenticated student saw and acknowledged the
 * data-handling notice on their first portfolio visit. Idempotent —
 * if already acknowledged, this is a no-op (the existing timestamp
 * is preserved so the audit trail reflects when they FIRST saw it,
 * not the most recent time they re-clicked it).
 *
 * Returns the existing or new timestamp so the client can stop
 * showing the modal.
 */
export async function POST() {
  const supabase = getAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: student } = await admin
    .from('student')
    .select('id, data_consent_acknowledged_at')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!student) {
    return NextResponse.json(
      { error: 'Student record not found' },
      { status: 404 }
    )
  }

  // Idempotent: only set the timestamp on the first acknowledgement.
  // Preserves the audit trail of when they originally saw it.
  if (student.data_consent_acknowledged_at) {
    return NextResponse.json({
      acknowledgedAt: student.data_consent_acknowledged_at,
      alreadyAcknowledged: true,
    })
  }

  const now = new Date().toISOString()
  const { error: updateErr } = await admin
    .from('student')
    .update({ data_consent_acknowledged_at: now })
    .eq('id', student.id)

  if (updateErr) {
    await log.error('consent.acknowledge_failed', {
      studentId: student.id as string,
      actorType: 'student',
      actorId: user.id,
      message: `Failed to update student.data_consent_acknowledged_at: ${updateErr.message}`,
      context: { db_error: updateErr.message },
    })
    return NextResponse.json(
      { error: `Failed to record acknowledgement: ${updateErr.message}` },
      { status: 500 }
    )
  }

  await log.info('consent.acknowledged', {
    studentId: student.id as string,
    actorType: 'student',
    actorId: user.id,
    message: 'Student acknowledged data-handling notice',
    context: { acknowledged_at: now },
  })

  return NextResponse.json({ acknowledgedAt: now, alreadyAcknowledged: false })
}
