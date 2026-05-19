import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  gatherPilotSubjects,
  ensureSubjectAndMint,
  prefetchAuthUserIdsByEmail,
  toCsv,
  type IssueResult,
} from '@/lib/auth/passlink-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// One up-front listUsers snapshot (prefetchAuthUserIdsByEmail) makes the
// ~81-subject bulk issue a few seconds (one paginated listUsers + ~3
// Supabase round-trips per subject) instead of ~25-50s. maxDuration is a
// generous safety margin, not load-bearing — effective on Vercel Pro;
// the optimized path also completes well within Hobby's 10s for the
// pilot size. See the Task 7 owner runbook.
export const maxDuration = 300

/**
 * POST /api/admin/passlinks/issue[?rotateAll=1]
 * Bulk-provisions + mints passlinks for the whole pilot population and
 * returns a ONE-TIME CSV (name,email,role,status,url). Subjects with an
 * active link are skipped (status 'already-active', blank url) unless
 * ?rotateAll=1. ADMIN_EMAILS-gated.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.res

    const admin = createAdminClient()
    const baseUrl = req.nextUrl.origin
    const rotateAll = req.nextUrl.searchParams.get('rotateAll') === '1'

    const authMap = await prefetchAuthUserIdsByEmail(admin)
    const subjects = await gatherPilotSubjects(admin)
    const results: IssueResult[] = []
    for (const s of subjects) {
      results.push(await ensureSubjectAndMint(admin, s, baseUrl, rotateAll, authMap))
    }

    const csv = toCsv(results)
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pilot-passlinks-${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('passlinks/issue error:', error)
    return NextResponse.json({ error: 'Issue failed: ' + String(error) }, { status: 500 })
  }
}
