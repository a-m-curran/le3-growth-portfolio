import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/sync-inspect/clear-empty
 *
 * Deletes student_work rows imported via D2L Valence sync where
 * content is empty (extraction failed). Used to unblock re-sync —
 * because submissions are deduped by brightspace_submission_id, a
 * row with empty content from a failed earlier extraction would
 * otherwise be skipped on the next sync, and the real text would
 * never be pulled in.
 *
 * Narrowly scoped to source='d2l_valence_sync' and empty-or-null
 * content so uploaded work and successful imports are never touched.
 *
 * Coach-only.
 */
export async function POST() {
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

  // Find the IDs first so we can report exactly which rows got deleted
  // (and so the subsequent delete by ID list is precise rather than a
  // broad filter that could accidentally match future non-empty rows
  // between the filter and the actual delete).
  const { data: emptyRows, error: selectErr } = await admin
    .from('student_work')
    .select('id, brightspace_submission_id')
    .eq('source', 'd2l_valence_sync')
    .or('content.is.null,content.eq.')

  if (selectErr) {
    return NextResponse.json(
      { error: `Failed to list empty work rows: ${selectErr.message}` },
      { status: 500 }
    )
  }

  const ids = (emptyRows ?? []).map(r => r.id)

  if (ids.length === 0) {
    return NextResponse.json({ deleted: 0, ids: [] })
  }

  // Also remove any work_skill_tag rows that reference these works
  // (auto-tag rows that got created before extraction failed). The
  // foreign key uses ON DELETE CASCADE in most cases but we do it
  // explicitly to be safe and to surface any error.
  const { error: tagErr } = await admin
    .from('work_skill_tag')
    .delete()
    .in('work_id', ids)

  if (tagErr) {
    // Log but continue — the work row delete below will fail loudly
    // if it's actually a FK problem we need to fix.
    console.warn('work_skill_tag cleanup warning:', tagErr.message)
  }

  const { error: deleteErr } = await admin
    .from('student_work')
    .delete()
    .in('id', ids)

  if (deleteErr) {
    return NextResponse.json(
      { error: `Failed to delete empty work rows: ${deleteErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    deleted: ids.length,
    submissionIds: (emptyRows ?? []).map(r => r.brightspace_submission_id),
  })
}
