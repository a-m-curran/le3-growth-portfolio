/**
 * Revoke ALL active permanent login links for a coach (by email).
 * Sets revoked_at=now(); the /api/auth/passlink endpoint filters
 * revoked_at is null, so the link dies immediately on next use.
 *
 * Requires env (.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY.
 *
 * Run: npx tsx scripts/revoke-passlink.ts <email>
 *
 * SQL fallback:
 *   update auth_passlink set revoked_at=now()
 *   where coach_id=(select id from coach where email='<email>')
 *     and revoked_at is null;
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  const email = process.argv.slice(2).find(a => !a.startsWith('--'))
  if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx scripts/revoke-passlink.ts <email>')
    process.exit(1)
  }

  const { data: coach, error: cErr } = await supabase
    .from('coach')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (cErr) throw cErr
  if (!coach?.id) {
    console.error(`No coach row for ${email} — nothing to revoke.`)
    process.exit(1)
  }

  const { data: revoked, error: rErr } = await supabase
    .from('auth_passlink')
    .update({ revoked_at: new Date().toISOString() })
    .eq('coach_id', coach.id as string)
    .is('revoked_at', null)
    .select('id')
  if (rErr) throw rErr

  console.log(`✅ Revoked ${revoked?.length ?? 0} active link(s) for ${email}.`)
}

main().catch(err => {
  console.error('✖ revoke-passlink failed:', err)
  process.exit(1)
})
