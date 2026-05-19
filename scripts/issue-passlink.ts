/**
 * Issue (or rotate) a permanent per-coach login link — the no-email
 * staff auth bridge. Coach-only (instructors are coach rows in v2;
 * students are LTI-only and must never be issued links).
 *
 * Writes (prod): ensures a Supabase auth user + an ACTIVE coach row for
 * <email> (so /api/auth/callback links the coach instead of deleting
 * the user), then mints one auth_passlink row (only the SHA-256 hash of
 * the token is stored) and prints the permanent URL ONCE — save it, it
 * is unrecoverable afterward.
 *
 * Idempotent: if an active (non-revoked) link already exists and
 * --rotate is NOT passed, prints a status report and exits WITHOUT
 * minting or rotating (the existing bookmark keeps working forever).
 * --rotate revokes the coach's active links and mints a fresh one.
 *
 * Requires env (.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, LTI_TOOL_URL.
 *
 * Run: npx tsx scripts/issue-passlink.ts <email> [--name "Full Name"] [--rotate]
 */

// Load .env.local before importing the supabase client (dotenv/config
// defaults to .env which Next.js doesn't use).
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.LTI_TOOL_URL
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!baseUrl) {
  console.error('Missing LTI_TOOL_URL (deployed origin used to build the link URL)')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// Verbatim from src/app/api/auth/callback/route.ts:257-266 (local,
// unexported there) — kept in sync so issued coaches get the same
// display name the callback's admin path would derive.
function deriveNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'Admin'
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Admin'
  )
}

function sha256hex(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const target = email.toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const users = data?.users ?? []
    const hit = users.find(u => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit.id
    if (users.length < 1000) break
  }
  return null
}

async function main() {
  const args = process.argv.slice(2)
  const positionals = args.filter(a => !a.startsWith('--'))
  const email = positionals[0]
  if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx scripts/issue-passlink.ts <email> [--name "Full Name"] [--rotate]')
    process.exit(1)
  }
  const rotate = args.includes('--rotate')
  const nameIdx = args.indexOf('--name')
  const nameArg = nameIdx >= 0 ? args[nameIdx + 1] : undefined

  console.log('▶ Ensuring Supabase auth user…')
  let authUserId = await findAuthUserIdByEmail(email)
  if (authUserId) {
    console.log(`  reused existing auth user ${authUserId}`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (error || !data?.user) {
      throw new Error(`Failed to create auth user for ${email}: ${error?.message ?? 'no user'}`)
    }
    authUserId = data.user.id
    console.log(`  created auth user ${authUserId}`)
  }

  console.log('▶ Ensuring active coach row…')
  const { data: coachRow, error: coachErr } = await supabase
    .from('coach')
    .select('id, auth_user_id, status')
    .eq('email', email)
    .maybeSingle()
  if (coachErr) throw coachErr

  let coachId: string
  if (coachRow?.id) {
    coachId = coachRow.id as string
    const patch: Record<string, unknown> = {}
    if (!coachRow.auth_user_id) patch.auth_user_id = authUserId
    if (coachRow.status !== 'active') patch.status = 'active'
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('coach').update(patch).eq('id', coachId)
      if (error) throw error
      console.log(`  updated coach ${coachId} ${JSON.stringify(patch)}`)
    } else {
      console.log(`  reused coach ${coachId}`)
    }
  } else {
    const { data: inserted, error } = await supabase
      .from('coach')
      .insert({
        auth_user_id: authUserId,
        name: nameArg || deriveNameFromEmail(email),
        email,
        status: 'active',
      })
      .select('id')
      .single()
    if (error || !inserted) throw new Error(`Failed to insert coach: ${error?.message ?? 'no row'}`)
    coachId = inserted.id as string
    console.log(`  created coach ${coachId}`)
  }

  const { data: active, error: activeErr } = await supabase
    .from('auth_passlink')
    .select('id, created_at, last_used_at')
    .eq('coach_id', coachId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (activeErr) throw activeErr

  if (active && active.length > 0 && !rotate) {
    console.log('\n● An active link already exists — NOT minting (idempotent).')
    for (const l of active) {
      console.log(`  • created ${l.created_at}  last_used ${l.last_used_at ?? 'never'}`)
    }
    console.log('\nThe existing bookmarked URL still works. To invalidate it and')
    console.log('issue a NEW url, re-run with --rotate. (The old URL cannot be')
    console.log('reprinted — only its hash is stored.)')
    return
  }

  if (rotate && active && active.length > 0) {
    const { error } = await supabase
      .from('auth_passlink')
      .update({ revoked_at: new Date().toISOString() })
      .eq('coach_id', coachId)
      .is('revoked_at', null)
    if (error) throw error
    console.log(`▶ Rotated: revoked ${active.length} prior link(s).`)
  }

  const token = randomBytes(32).toString('base64url')
  const { error: insErr } = await supabase.from('auth_passlink').insert({
    coach_id: coachId,
    token_hash: sha256hex(token),
  })
  if (insErr) throw insErr

  const link = `${baseUrl!.replace(/\/+$/, '')}/api/auth/passlink?t=${token}`
  console.log('\n✅ Permanent login link issued (save this — shown once):\n')
  console.log(`  ${link}\n`)
  console.log(`  coach: ${email} (${coachId})`)
  console.log(`  Revoke anytime: npx tsx scripts/revoke-passlink.ts ${email}`)
}

main().catch(err => {
  console.error('✖ issue-passlink failed:', err)
  process.exit(1)
})
