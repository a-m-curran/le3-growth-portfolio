import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { getValenceConfig, isValenceConfigured } from '@/lib/d2l/config'
import { getValenceToken, clearValenceTokenCache } from '@/lib/d2l/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/valence-diag
 *
 * Diagnostic endpoint for debugging Valence connectivity failures.
 * Runs a sequence of probe calls against progressively deeper Valence
 * endpoints and reports which succeed and which fail. Used to pinpoint
 * the root cause when a sync errors out — e.g. is it auth? is the org
 * unit inaccessible? is the path wrong?
 *
 * Each probe is wrapped in try/catch so one failure doesn't halt the
 * others. Response is a JSON report listing, for each probe, the HTTP
 * status, body excerpt (first 200 chars), and timing.
 *
 * Coach-authenticated, like /api/admin/sync-le3.
 */
export async function GET() {
  // ─── Auth ──────────────────────────────────────
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

  // ─── Config check ─────────────────────────────
  if (!isValenceConfigured()) {
    return NextResponse.json({
      error: 'Valence not configured',
      configured: false,
    })
  }

  const config = getValenceConfig()

  // ─── Run probes ───────────────────────────────
  // Fresh token each run so we're exercising the full auth path too.
  clearValenceTokenCache()

  const results: ProbeResult[] = []

  // Probe 1: get a token (exercises JWT client assertion)
  let token: string | null = null
  try {
    const t0 = Date.now()
    token = await getValenceToken()
    results.push({
      probe: 'oauth_token',
      url: config.tokenUrl,
      status: 'ok',
      message: `Got access token (length ${token.length})`,
      ms: Date.now() - t0,
    })
  } catch (err) {
    results.push({
      probe: 'oauth_token',
      url: config.tokenUrl,
      status: 'error',
      message: String(err),
      ms: 0,
    })
    // Can't continue without a token
    return NextResponse.json({
      summary: 'Auth failed — cannot continue',
      config: {
        instanceUrl: config.instanceUrl,
        clientId: config.clientId,
        tokenUrl: config.tokenUrl,
        apiVersion: config.apiVersion,
        le3OrgUnitId: config.le3OrgUnitId,
      },
      probes: results,
    })
  }

  // Probe 2: /whoami — simplest sanity check that the token works at all
  await probe(results, token, config, 'whoami', `/d2l/api/lp/${config.apiVersion}/users/whoami`)

  // Probe 3: get the configured LE3 org unit itself
  //   404 here = org unit ID wrong OR service user can't see it
  //   200 here = org unit exists and service user has some access
  await probe(
    results,
    token,
    config,
    'orgunit_root',
    `/d2l/api/lp/${config.apiVersion}/orgstructure/${config.le3OrgUnitId}`
  )

  // Probe 4: children of the LE3 org unit (one level deep)
  //   More commonly supported than descendants
  await probe(
    results,
    token,
    config,
    'orgunit_children',
    `/d2l/api/lp/${config.apiVersion}/orgstructure/${config.le3OrgUnitId}/children/`
  )

  // Probe 5: children filtered to CourseOffering type (3)
  await probe(
    results,
    token,
    config,
    'orgunit_children_courses',
    `/d2l/api/lp/${config.apiVersion}/orgstructure/${config.le3OrgUnitId}/children/?ouTypeId=3`
  )

  // Probe 6: descendants (this is what the sync engine currently uses)
  //   Reproduces the failure we saw
  await probe(
    results,
    token,
    config,
    'orgunit_descendants',
    `/d2l/api/lp/${config.apiVersion}/orgstructure/${config.le3OrgUnitId}/descendants/`
  )

  // Probe 7: descendants with course type filter (exact failing call)
  await probe(
    results,
    token,
    config,
    'orgunit_descendants_courses',
    `/d2l/api/lp/${config.apiVersion}/orgstructure/${config.le3OrgUnitId}/descendants/?ouTypeId=3`
  )

  // Probe 8: paged-descendants variant (some instances use this path)
  await probe(
    results,
    token,
    config,
    'orgunit_paged_descendants',
    `/d2l/api/lp/${config.apiVersion}/orgstructure/${config.le3OrgUnitId}/descendants/paged/`
  )

  // ─── Summary ──────────────────────────────────
  const succeeded = results.filter(r => r.status === 'ok').length
  const failed = results.filter(r => r.status === 'error').length
  const diagnosis = diagnose(results)

  return NextResponse.json({
    summary: `${succeeded} succeeded, ${failed} failed`,
    diagnosis,
    config: {
      instanceUrl: config.instanceUrl,
      clientId: config.clientId,
      tokenUrl: config.tokenUrl,
      apiVersion: config.apiVersion,
      le3OrgUnitId: config.le3OrgUnitId,
    },
    probes: results,
  })
}

// ─── Helpers ───────────────────────────────────

interface ProbeResult {
  probe: string
  url: string
  status: 'ok' | 'error'
  httpStatus?: number
  message: string
  bodyExcerpt?: string
  ms: number
}

async function probe(
  results: ProbeResult[],
  token: string,
  config: ReturnType<typeof getValenceConfig>,
  label: string,
  path: string
): Promise<void> {
  const url = `${config.instanceUrl}${path}`
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    const bodyText = await res.text().catch(() => '')
    const ms = Date.now() - t0

    if (res.ok) {
      results.push({
        probe: label,
        url,
        status: 'ok',
        httpStatus: res.status,
        message: `${res.status} OK`,
        bodyExcerpt: bodyText.substring(0, 200),
        ms,
      })
    } else {
      results.push({
        probe: label,
        url,
        status: 'error',
        httpStatus: res.status,
        message: `${res.status} ${res.statusText}`,
        bodyExcerpt: bodyText.substring(0, 200),
        ms,
      })
    }
  } catch (err) {
    results.push({
      probe: label,
      url,
      status: 'error',
      message: String(err),
      ms: Date.now() - t0,
    })
  }
}

function diagnose(results: ProbeResult[]): string {
  const byProbe = (name: string) => results.find(r => r.probe === name)

  const token = byProbe('oauth_token')
  const whoami = byProbe('whoami')
  const orgRoot = byProbe('orgunit_root')
  const children = byProbe('orgunit_children')
  const descendants = byProbe('orgunit_descendants')
  const descCourses = byProbe('orgunit_descendants_courses')
  const pagedDesc = byProbe('orgunit_paged_descendants')

  if (token?.status !== 'ok') {
    return 'OAuth token request failed — JWT client assertion is not being accepted. Check that the JWK URL matches our /api/lti/jwks and that the Client ID is correct.'
  }

  if (whoami?.status !== 'ok') {
    return `Token was issued but /whoami returns ${whoami?.httpStatus}. The token may be scoped-out of LP endpoints entirely, or the service user has been disabled.`
  }

  if (orgRoot?.status !== 'ok') {
    if (orgRoot?.httpStatus === 404) {
      return `Org unit ${byProbe('oauth_token') && '(configured ID)'} returns 404 on the most basic get. Either (a) the org unit ID is wrong for this instance, or (b) the service user does not have read access to it. Ask NLU to confirm the correct ID for d2ltest.nl.edu and to verify the service user's enrollments.`
    }
    return `Org unit fetch failed with ${orgRoot?.httpStatus}. Likely a permissions issue on the service user.`
  }

  if (children?.status === 'ok' && descendants?.status !== 'ok') {
    return 'Children endpoint works but descendants does not. This instance may not support /descendants/ at this path. Recommend switching the sync engine to use children recursively instead.'
  }

  if (pagedDesc?.status === 'ok' && descendants?.status !== 'ok') {
    return 'Paged descendants endpoint works but unpaged descendants does not. Switch the sync engine to use /descendants/paged/ instead of /descendants/.'
  }

  if (descCourses?.status === 'ok') {
    return 'All probes healthy. The descendants endpoint works. If the sync is still failing, the error is downstream (classlist, dropbox, submissions).'
  }

  return 'Inconclusive — see individual probe results.'
}
