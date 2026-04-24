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
        lpVersion: config.lpVersion,
        leVersion: config.leVersion,
        le3OrgUnitId: config.le3OrgUnitId,
      },
      probes: results,
    })
  }

  // Probe 1.5: /d2l/api/versions — UNAUTHENTICATED discovery endpoint
  // Tells us which API versions the instance supports. Runs without a
  // token so it doesn't care about scopes.
  await probeAbsoluteNoAuth(
    results,
    'versions_list',
    `${config.instanceUrl}/d2l/api/versions`,
    // Bumped from 400 → 4000 so we can parse the full LP SupportedVersions
    // array. D2L's versions response lists every namespace and its full
    // history; 400 chars barely gets through LP's first few entries.
    4000
  )

  // Probe 1.6: decode the access token JWT payload so we can see which
  // scopes were actually granted and which tenant it's scoped to. The
  // JWT is just base64url-encoded JSON, no signature check needed.
  try {
    const parts = token.split('.')
    if (parts.length >= 2) {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8')
      const payload = JSON.parse(payloadJson) as Record<string, unknown>
      const excerpt = {
        iss: payload.iss,
        aud: payload.aud,
        sub: payload.sub,
        scope: payload.scope,
        exp: payload.exp,
        tenantid: payload.tenantid,
      }
      results.push({
        probe: 'jwt_decoded',
        url: '(access token payload)',
        status: 'ok',
        message: 'decoded',
        bodyExcerpt: JSON.stringify(excerpt),
        ms: 0,
      })
    }
  } catch (err) {
    results.push({
      probe: 'jwt_decoded',
      url: '(access token payload)',
      status: 'error',
      message: String(err),
      ms: 0,
    })
  }

  // ─── LP namespace probes (use lpVersion) ────
  //
  // These all use /d2l/api/lp/{lpVersion}/...
  // On NLU's d2ltest, LP plateaus at v1.50.

  // Probe 2: /whoami — simplest sanity check that the token works at all
  await probe(results, token, config, 'whoami', `/d2l/api/lp/${config.lpVersion}/users/whoami`)

  // Probe 3: get the configured LE3 org unit itself
  //   404 here = org unit ID wrong OR service user can't see it
  //   200 here = org unit exists and service user has some access
  await probe(
    results,
    token,
    config,
    'orgunit_root',
    `/d2l/api/lp/${config.lpVersion}/orgstructure/${config.le3OrgUnitId}`
  )

  // Probe 4: children of the LE3 org unit (one level deep)
  await probe(
    results,
    token,
    config,
    'orgunit_children',
    `/d2l/api/lp/${config.lpVersion}/orgstructure/${config.le3OrgUnitId}/children/`
  )

  // Probe 5: children filtered to CourseOffering type (3)
  await probe(
    results,
    token,
    config,
    'orgunit_children_courses',
    `/d2l/api/lp/${config.lpVersion}/orgstructure/${config.le3OrgUnitId}/children/?ouTypeId=3`
  )

  // Probe 6: descendants (what sync engine uses for course discovery)
  await probe(
    results,
    token,
    config,
    'orgunit_descendants',
    `/d2l/api/lp/${config.lpVersion}/orgstructure/${config.le3OrgUnitId}/descendants/`
  )

  // Probe 7: descendants with course type filter
  await probe(
    results,
    token,
    config,
    'orgunit_descendants_courses',
    `/d2l/api/lp/${config.lpVersion}/orgstructure/${config.le3OrgUnitId}/descendants/?ouTypeId=3`
  )

  // Probe 8: paged-descendants variant
  await probe(
    results,
    token,
    config,
    'orgunit_paged_descendants',
    `/d2l/api/lp/${config.lpVersion}/orgstructure/${config.le3OrgUnitId}/descendants/paged/`
  )

  // ─── LE namespace probes (use leVersion) ────
  //
  // These use /d2l/api/le/{leVersion}/... — dropbox, classlist, discussions.
  // LE supports up to v1.93 on NLU's d2ltest. The dropbox submissions
  // endpoint specifically requires v1.82+.

  // Pick the first course offering as a probe target.
  // Probe 6 already hit descendants, so look for that probe's body excerpt
  // and extract the first course org unit ID. If that probe failed, fall
  // back to probing one known test course ID hardcoded for context.
  const firstCourseOuId = extractFirstCourseOuId(results) ?? '242430'

  // Probe 9: classlist for the first course — shows us the full roster
  // including whether emails are populated. This is the critical probe
  // for debugging "why no students synced." Returns full JSON body (up
  // to 2000 chars) so we can inspect email fields on each user.
  await probeWithLongBody(
    results,
    token,
    'classlist_for_first_course',
    `${config.instanceUrl}/d2l/api/le/${config.leVersion}/${firstCourseOuId}/classlist/`,
    2000
  )

  // Probe 9.5: get a single user's profile directly via the LP users
  // endpoint. If classlist returns anonymized data but this endpoint
  // returns real data, we know classlist-specific anonymization is
  // enabled. If both return null PII, the scrubbing is user-level or
  // instance-wide. Crucial for writing the precise fix request to NLU.
  const firstStudentId = extractFirstStudentIdentifier(results)
  if (firstStudentId) {
    await probeWithLongBody(
      results,
      token,
      'user_profile_direct',
      `${config.instanceUrl}/d2l/api/lp/${config.lpVersion}/users/${firstStudentId}`,
      1000
    )

    // Probe 9.6: sweep user profile across every LP version the instance
    // supports ≥ 1.50. If we're pinned to an outdated LP version and a
    // newer one returns real data, the 403 is our fault (wrong version).
    // If every supported version returns 403, it's definitively a
    // permissions issue on NLU's side, not a version issue on ours.
    const lpVersions = extractLpSupportedVersions(results)
    const versionsToTry = lpVersions.filter(v => v !== config.lpVersion)

    // Emit a synthetic probe row summarizing what we discovered, so the
    // result is visible even when zero sweep probes fire (which is the
    // case when the only supported LP version is the one we're already
    // pinned to — a meaningful signal, not a bug).
    results.push({
      probe: 'user_profile_lp_sweep_plan',
      url: `${config.instanceUrl}/d2l/api/versions`,
      status: 'ok',
      message:
        lpVersions.length === 0
          ? 'No LP versions extracted from /d2l/api/versions body — check versions_list bodyExcerpt above. Sweep skipped.'
          : versionsToTry.length === 0
          ? `LP supported versions found: [${lpVersions.join(', ')}]. Only the already-pinned lpVersion (${config.lpVersion}) is supported on this instance — no higher LP version to try, so the 403 cannot be a version issue on our side.`
          : `LP supported versions found: [${lpVersions.join(', ')}]. Sweeping user_profile at: [${versionsToTry.join(', ')}].`,
      ms: 0,
    })

    for (const v of versionsToTry) {
      await probeAbsolute(
        results,
        token,
        `user_profile_lp_v${v}`,
        `${config.instanceUrl}/d2l/api/lp/${v}/users/${firstStudentId}`
      )
    }
  } else {
    results.push({
      probe: 'user_profile_direct',
      url: '(skipped)',
      status: 'error',
      message: 'No student Identifier extractable from classlist probe',
      ms: 0,
    })
  }

  // Probe 10: dropbox folders for the first course
  await probeWithLongBody(
    results,
    token,
    'dropbox_folders_for_first_course',
    `${config.instanceUrl}/d2l/api/le/${config.leVersion}/${firstCourseOuId}/dropbox/folders/`,
    2000
  )

  // Probe 11: if we can find a folder ID, probe submissions for it
  const firstFolderId = extractFirstFolderId(results)
  if (firstFolderId) {
    await probeWithLongBody(
      results,
      token,
      'submissions_for_first_folder',
      `${config.instanceUrl}/d2l/api/le/${config.leVersion}/${firstCourseOuId}/dropbox/folders/${firstFolderId}/submissions/`,
      3000
    )

    // Probe 11.5: attempt a file download for the first submission's
    // first file. student_work rows are being created with content_len=0,
    // which means downloadSubmissionFile or extractText is silently
    // failing inside the sync's per-submission try/catch. This probe
    // bypasses both and surfaces exactly what D2L returns when we ask
    // for the file — including redirect chains, auth challenges, or
    // content-type mismatches.
    const firstSubIds = extractFirstSubmissionAndFileIds(results)
    if (firstSubIds) {
      await probeFileDownload(
        results,
        token,
        'file_download_first_submission',
        `${config.instanceUrl}/d2l/api/le/${config.leVersion}/${firstCourseOuId}/dropbox/folders/${firstFolderId}/submissions/${firstSubIds.submissionId}/files/${firstSubIds.fileId}`
      )
    } else {
      results.push({
        probe: 'file_download_first_submission',
        url: '(skipped)',
        status: 'error',
        message: 'Could not extract submission/file IDs from submissions probe body',
        ms: 0,
      })
    }
  } else {
    results.push({
      probe: 'submissions_for_first_folder',
      url: '(skipped)',
      status: 'error',
      message: 'No folder ID extractable from dropbox_folders probe body',
      ms: 0,
    })
  }

  // ─── Tenancy probes ──────────────────────────
  // If whoami/orgunit_root failed, try the same token against known
  // production hostnames to see if the token was scoped to a different
  // tenant than we're hitting. A success here = instance URL mismatch.
  if (byProbeHelper(results, 'whoami')?.status !== 'ok') {
    // Try whoami at a spread of API versions to find any that work.
    // If any return 200, we've found a supported version.
    // If they return 403, that's a permissions issue (path exists).
    // If they return 404, version doesn't exist on this instance.
    const versionsToTry = ['1.0', '1.9', '1.20', '1.30', '1.40', '1.50', '1.60', '1.70', '1.80']
    for (const v of versionsToTry) {
      await probeAbsolute(
        results,
        token,
        `whoami_v${v}`,
        `${config.instanceUrl}/d2l/api/lp/${v}/users/whoami`
      )
    }
  }

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
      lpVersion: config.lpVersion,
      leVersion: config.leVersion,
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

function byProbeHelper(results: ProbeResult[], name: string): ProbeResult | undefined {
  return results.find(r => r.probe === name)
}

/**
 * Make an authenticated GET and capture a large chunk of the response
 * body for inspection. Used for classlist + submissions probes where
 * the shape of the response is critical to debugging.
 */
async function probeWithLongBody(
  results: ProbeResult[],
  token: string,
  label: string,
  url: string,
  excerptLength: number
): Promise<void> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    const bodyText = await res.text().catch(() => '')
    results.push({
      probe: label,
      url,
      status: res.ok ? 'ok' : 'error',
      httpStatus: res.status,
      message: `${res.status} ${res.statusText}`,
      bodyExcerpt: bodyText.substring(0, excerptLength),
      ms: Date.now() - t0,
    })
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

/**
 * Try to extract the first course org unit ID from the descendants
 * probe body. Returns null if we can't find one — caller falls back to
 * a hardcoded default.
 */
function extractFirstCourseOuId(results: ProbeResult[]): string | null {
  const descProbe =
    results.find(r => r.probe === 'orgunit_descendants_courses') ||
    results.find(r => r.probe === 'orgunit_children_courses') ||
    results.find(r => r.probe === 'orgunit_descendants')
  if (!descProbe?.bodyExcerpt) return null
  const match = descProbe.bodyExcerpt.match(/"Identifier":"(\d+)"/)
  return match ? match[1] : null
}

/**
 * Try to extract the first folder ID from the dropbox folders probe body.
 * Returns null if no folder was found in the response.
 */
function extractFirstFolderId(results: ProbeResult[]): string | null {
  const foldersProbe = results.find(r => r.probe === 'dropbox_folders_for_first_course')
  if (!foldersProbe?.bodyExcerpt || foldersProbe.status !== 'ok') return null
  const match = foldersProbe.bodyExcerpt.match(/"Id":\s*(\d+)/)
  return match ? match[1] : null
}

/**
 * Pull out the first user Identifier from the classlist probe body,
 * so we can probe that specific user's profile via the LP endpoint and
 * compare to what the classlist endpoint returned.
 */
function extractFirstStudentIdentifier(results: ProbeResult[]): string | null {
  const classlistProbe = results.find(r => r.probe === 'classlist_for_first_course')
  if (!classlistProbe?.bodyExcerpt || classlistProbe.status !== 'ok') return null
  const match = classlistProbe.bodyExcerpt.match(/"Identifier":"(\d+)"/)
  return match ? match[1] : null
}

/**
 * Pull out the first submissionId + fileId from the submissions probe
 * body. Used to drive the file-download probe, which isolates whether
 * downloadSubmissionFile is where content goes missing.
 */
function extractFirstSubmissionAndFileIds(
  results: ProbeResult[]
): { submissionId: string; fileId: string } | null {
  const subsProbe = results.find(r => r.probe === 'submissions_for_first_folder')
  if (!subsProbe?.bodyExcerpt || subsProbe.status !== 'ok') return null
  // The shape is [{Entity: {...}, Submissions: [{Id: 4721796, Files: [{FileId: 23958830, ...}]}]}]
  // Match the first "Id" that's followed later by a Files/FileId pair.
  const submissionMatch = subsProbe.bodyExcerpt.match(/"Id"\s*:\s*(\d+)/)
  const fileMatch = subsProbe.bodyExcerpt.match(/"FileId"\s*:\s*(\d+)/)
  if (!submissionMatch || !fileMatch) return null
  return { submissionId: submissionMatch[1], fileId: fileMatch[1] }
}

/**
 * Probe a file download endpoint. Unlike probeAbsolute, this avoids
 * loading the (potentially large, definitely binary) body into memory —
 * we only want to know: does it succeed, what content-type did we get,
 * was the filename in Content-Disposition parsed correctly, and how
 * many redirects happened.
 */
async function probeFileDownload(
  results: ProbeResult[],
  token: string,
  label: string,
  url: string
): Promise<void> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: '*/*',
      },
      redirect: 'follow',
    })
    const contentType = res.headers.get('content-type') || '(missing)'
    const contentLength = res.headers.get('content-length') || '(missing)'
    const disposition = res.headers.get('content-disposition') || '(missing)'
    // Peek first 200 bytes as UTF-8; for binary this will be gibberish
    // but the first bytes of a .docx (PK zip signature) are still
    // recognizable and confirm we got the real file.
    const buf = await res.arrayBuffer()
    const firstBytes = Buffer.from(buf.slice(0, 8)).toString('hex')
    results.push({
      probe: label,
      url,
      status: res.ok ? 'ok' : 'error',
      httpStatus: res.status,
      message: `${res.status} ${res.statusText}`,
      bodyExcerpt: `content-type=${contentType} | content-length=${contentLength} | disposition=${disposition} | size_actual=${buf.byteLength} | first8bytes=${firstBytes} | redirected=${res.redirected} | final_url=${res.url}`,
      ms: Date.now() - t0,
    })
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

/**
 * Extract the LP namespace's supported versions ≥ 1.50 from the
 * /d2l/api/versions discovery probe. Used to sweep the user profile
 * endpoint across every LP version the instance actually exposes.
 *
 * D2L's versions endpoint returns an array like:
 *   [{ ProductCode: "lp", LatestVersion: "1.50",
 *      SupportedVersions: ["1.0", "1.1", ..., "1.50"] }, ...]
 *
 * We filter to versions ≥ 1.50 because earlier versions are unlikely
 * to have different auth behavior, and we cap at 10 versions to keep
 * the diag response bounded.
 */
function extractLpSupportedVersions(results: ProbeResult[]): string[] {
  const versionsProbe = results.find(r => r.probe === 'versions_list')
  if (!versionsProbe?.bodyExcerpt || versionsProbe.status !== 'ok') return []

  try {
    // Body may be truncated at 400 chars — parse what we can, falling
    // back to regex if JSON.parse fails on the truncated tail.
    let lp: { SupportedVersions?: string[] } | undefined
    try {
      const parsed = JSON.parse(versionsProbe.bodyExcerpt) as Array<{
        ProductCode: string
        SupportedVersions?: string[]
      }>
      lp = parsed.find(p => p.ProductCode === 'lp')
    } catch {
      // truncated JSON — extract LP's SupportedVersions array via regex
      const lpBlock = versionsProbe.bodyExcerpt.match(
        /"ProductCode"\s*:\s*"lp"[^}]*"SupportedVersions"\s*:\s*\[([^\]]+)\]/
      )
      if (lpBlock) {
        const versions = Array.from(lpBlock[1].matchAll(/"([\d.]+)"/g)).map(m => m[1])
        lp = { SupportedVersions: versions }
      }
    }

    if (!lp?.SupportedVersions) return []

    // Filter to ≥ 1.50, sort ascending, cap at 10
    const atLeast150 = lp.SupportedVersions.filter(v => {
      const [maj, min] = v.split('.').map(Number)
      return maj > 1 || (maj === 1 && min >= 50)
    })
    atLeast150.sort((a, b) => {
      const [am, an] = a.split('.').map(Number)
      const [bm, bn] = b.split('.').map(Number)
      return am !== bm ? am - bm : an - bn
    })
    return atLeast150.slice(0, 10)
  } catch {
    return []
  }
}

async function probeAbsolute(
  results: ProbeResult[],
  token: string,
  label: string,
  url: string
): Promise<void> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    const bodyText = await res.text().catch(() => '')
    results.push({
      probe: label,
      url,
      status: res.ok ? 'ok' : 'error',
      httpStatus: res.status,
      message: `${res.status} ${res.statusText}`,
      bodyExcerpt: bodyText.substring(0, 200),
      ms: Date.now() - t0,
    })
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

async function probeAbsoluteNoAuth(
  results: ProbeResult[],
  label: string,
  url: string,
  excerptLength: number = 400
): Promise<void> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
    const bodyText = await res.text().catch(() => '')
    results.push({
      probe: label,
      url,
      status: res.ok ? 'ok' : 'error',
      httpStatus: res.status,
      message: `${res.status} ${res.statusText}`,
      bodyExcerpt: bodyText.substring(0, excerptLength),
      ms: Date.now() - t0,
    })
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
    // Look at the tenancy probes if present
    const whoamiProd = byProbe('whoami_on_nlu_prod')
    const whoamiV10 = byProbe('whoami_api_version_1_0')

    if (whoamiProd?.status === 'ok') {
      return `CONFIRMED: the OAuth token works against nlu.brightspace.com but NOT against ${
        results[0] ? new URL(results[0].url).host : 'the configured instance'
      }. The OAuth 2.0 app is registered on production, not on the test instance. Either (a) re-register the app on the test instance and get a new Client ID, or (b) change D2L_VALENCE_INSTANCE_URL to https://nlu.brightspace.com and test against production.`
    }
    if (whoamiV10?.status === 'ok') {
      return 'API v1.82 returns 404 on this instance but v1.0 works. Change D2L_VALENCE_API_VERSION to 1.0 (or the highest version the instance supports).'
    }
    return `Token was issued but every API call returns ${whoami?.httpStatus}. Check: (1) is the instance URL correct? Try opening it in a browser. (2) is this actually a Brightspace instance with the Valence API enabled? (3) was the OAuth app registered on a different instance than the one we're calling?`
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
