/**
 * Fully remove the test student created by scripts/seed-test-student.ts
 * and everything it produced — the complete reversibility guarantee.
 *
 * Deletion order (FK-correct, verified against the live schema):
 *   1. growth_conversation WHERE student_id = <test student>
 *      → conversation_output and conversation_skill_tag are
 *        ON DELETE CASCADE from growth_conversation, so they go too.
 *   2. student_work WHERE student_id = <test student>
 *   3. student row
 *   4. the Supabase auth user for TEST_EMAIL
 *
 * Safety: this script ONLY ever acts on the exact sentinel student
 * (nlu_id + email + is_demo=false). It refuses to delete anything that
 * doesn't match all three — it can never touch a real student.
 *
 * Requires env (.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY.
 *
 * Run: `npx tsx scripts/teardown-test-student.ts`
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { TEST_EMAIL, TEST_NLU_ID } from './seed-test-student'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const target = email.toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) throw error
    const users = data?.users ?? []
    const hit = users.find(u => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit.id
    if (users.length < 1000) break
  }
  return null
}

async function main() {
  console.log('▶ Locating the sentinel test student…')
  const { data: student, error: findErr } = await supabase
    .from('student')
    .select('id, email, nlu_id, is_demo')
    .eq('nlu_id', TEST_NLU_ID)
    .maybeSingle()
  if (findErr) throw findErr

  if (!student) {
    console.log('  No student row found. Checking for a stray auth user…')
    const strayAuthId = await findAuthUserIdByEmail(TEST_EMAIL)
    if (strayAuthId) {
      const { error } = await supabase.auth.admin.deleteUser(strayAuthId)
      if (error) throw error
      console.log(`  Deleted orphan auth user ${strayAuthId} (${TEST_EMAIL}).`)
    }
    console.log('\n✅ Nothing else to tear down.')
    return
  }

  // Hard safety gate: refuse unless ALL three sentinels match exactly.
  if (
    student.email !== TEST_EMAIL ||
    student.nlu_id !== TEST_NLU_ID ||
    student.is_demo !== false
  ) {
    throw new Error(
      `Refusing to delete: row ${student.id} does not match all sentinels ` +
        `(email=${student.email}, nlu_id=${student.nlu_id}, is_demo=${student.is_demo}). ` +
        `This script only ever removes the dedicated test student.`
    )
  }

  const studentId = student.id as string
  console.log(`  Target confirmed: ${studentId} (${TEST_EMAIL})`)

  const { count: convCount } = await supabase
    .from('growth_conversation')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
  const { count: workCount } = await supabase
    .from('student_work')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)

  console.log(
    `▶ Deleting ${convCount ?? 0} conversation(s) ` +
      `(cascades conversation_output + conversation_skill_tag)…`
  )
  const { error: cErr } = await supabase
    .from('growth_conversation')
    .delete()
    .eq('student_id', studentId)
  if (cErr) throw cErr

  console.log(`▶ Deleting ${workCount ?? 0} student_work row(s)…`)
  const { error: wErr } = await supabase
    .from('student_work')
    .delete()
    .eq('student_id', studentId)
  if (wErr) throw wErr

  console.log('▶ Deleting the student row…')
  const { error: sErr } = await supabase
    .from('student')
    .delete()
    .eq('id', studentId)
  if (sErr) throw sErr

  console.log('▶ Deleting the Supabase auth user…')
  const authUserId = await findAuthUserIdByEmail(TEST_EMAIL)
  if (authUserId) {
    const { error: aErr } = await supabase.auth.admin.deleteUser(authUserId)
    if (aErr) throw aErr
    console.log(`  Deleted auth user ${authUserId}.`)
  } else {
    console.log('  No auth user found (already gone).')
  }

  console.log('\n✅ Test student fully removed. Prod is back to its prior state.')
}

main().catch(err => {
  console.error('✖ teardown-test-student failed:', err)
  process.exit(1)
})
