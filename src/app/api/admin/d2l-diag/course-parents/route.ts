import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { lpGet } from '@/lib/d2l/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Raw D2L OrgUnit shape returned by /orgstructure/{id}/parents/.
 * Loosely typed — the diagnostic just dumps whatever D2L returns plus
 * surfaces a few interpreted fields. D2L type IDs of interest:
 *   3 = Course Offering
 *   5 = Semester (this is what we'd derive quarter from)
 *   6 = Department
 *  25 = Program
 *  (instance-specific extras exist; we just surface raw Type.Id/Name/Code)
 */
interface D2LOrgUnit {
  Identifier?: string
  Id?: number
  Name?: string
  Code?: string | null
  Type?: { Id: number; Code: string; Name: string }
  // Other fields D2L may return that we don't interpret here.
  [extra: string]: unknown
}

interface CourseDiag {
  courseName: string
  orgUnitId: string
  parents: D2LOrgUnit[] | null
  parentSummary: Array<{ id: string | number | undefined; typeId: number | undefined; typeName: string | undefined; name: string | undefined }>
  semesterAncestor: { name: string; typeId: number; id: string | number | undefined } | null
  error: string | null
}

/**
 * GET /api/admin/d2l-diag/course-parents?ids=242936,253696&limit=5
 *
 * ADMIN-gated D2L diagnostic. For each course in the sample, calls
 *   GET /d2l/api/lp/{ver}/orgstructure/{orgUnitId}/parents/
 * (which is gated by `orgunit:children:read` per D2L's scope model
 * — the same scope we already use for discovery) and returns the raw
 * parent OrgUnit list plus a summary identifying any ancestor with
 * Type.Id=5 (Semester) so we can see if walking the org tree is a
 * viable alternative to /courses/{id} (which requires the
 * `orgunits:course:read` scope we don't yet have granted).
 *
 * Without `?ids`, samples the first `limit` (default 5) courses with a
 * brightspace_org_unit_id set. With `?ids=a,b,c`, hits exactly those.
 *
 * Returns each course's full raw parent payload (D2L may include
 * fields beyond our type) plus a `parentSummary` and a
 * `semesterAncestor` flag for fast scanning. No side effects.
 */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.res

    const url = req.nextUrl
    const idsParam = url.searchParams.get('ids')
    const limit = Number(url.searchParams.get('limit') ?? '5')

    const admin = createAdminClient()

    let targets: Array<{ name: string; orgUnitId: string }>
    if (idsParam) {
      const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
      const { data: rows } = await admin
        .from('course')
        .select('name, brightspace_org_unit_id')
        .in('brightspace_org_unit_id', ids)
      targets = (rows ?? []).map(r => ({
        name: r.name as string,
        orgUnitId: r.brightspace_org_unit_id as string,
      }))
    } else {
      const { data: rows } = await admin
        .from('course')
        .select('name, brightspace_org_unit_id')
        .not('brightspace_org_unit_id', 'is', null)
        .order('name')
        .limit(limit)
      targets = (rows ?? []).map(r => ({
        name: r.name as string,
        orgUnitId: r.brightspace_org_unit_id as string,
      }))
    }

    const results: CourseDiag[] = []

    for (const t of targets) {
      try {
        const parents = await lpGet<D2LOrgUnit[]>(`/orgstructure/${t.orgUnitId}/parents/`)
        const summary = parents.map(p => ({
          id: p.Identifier ?? p.Id,
          typeId: p.Type?.Id,
          typeName: p.Type?.Name,
          name: p.Name,
        }))
        const sem = parents.find(p => p.Type?.Id === 5)
        const semesterAncestor = sem
          ? { name: sem.Name ?? '', typeId: sem.Type!.Id, id: sem.Identifier ?? sem.Id }
          : null
        results.push({
          courseName: t.name,
          orgUnitId: t.orgUnitId,
          parents,
          parentSummary: summary,
          semesterAncestor,
          error: null,
        })
      } catch (err) {
        results.push({
          courseName: t.name,
          orgUnitId: t.orgUnitId,
          parents: null,
          parentSummary: [],
          semesterAncestor: null,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const semesterHitCount = results.filter(r => r.semesterAncestor !== null).length
    const errorCount = results.filter(r => r.error !== null).length

    return NextResponse.json({
      ok: true,
      sampled: results.length,
      semesterAncestorFound: semesterHitCount,
      errors: errorCount,
      conclusion:
        errorCount === results.length
          ? 'All requests errored — the orgunit:children:read scope may not gate /parents/, or some other issue.'
          : semesterHitCount === results.length
            ? 'Every sampled course has a Semester (Type=5) ancestor — walking parents/ is a viable alternative to /courses/{id}.'
            : semesterHitCount === 0
              ? 'No sampled course has a Semester ancestor — NLU\'s org tree does not nest courses under Semester org units, so /courses/{id} (with orgunits:course:read scope) is required.'
              : `Mixed: ${semesterHitCount}/${results.length} courses have a Semester ancestor — parents/ would work for some but not all.`,
      results,
    })
  } catch (error) {
    console.error('d2l-diag/course-parents error:', error)
    return NextResponse.json(
      { ok: false, error: 'Diagnostic failed: ' + String(error) },
      { status: 500 }
    )
  }
}
