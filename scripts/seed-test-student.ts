/**
 * Seed a dedicated REAL magic-link test student ("Andrew — Test
 * Student") plus a few structurally-faithful assignments, so the v2
 * conversation/reflection loop can be driven end-to-end *as yourself*
 * (a genuine authed student, not a demo-persona puppet).
 *
 * Why this exists: getV2Identity() resolves coach BEFORE student
 * (src/lib/v2-auth.ts) — your normal andrewmcurran@gmail.com account
 * has a coach row, so it can never resolve as a student. A separate
 * `+student` Gmail alias has no coach row on its auth id, so it
 * resolves role:'student' and exercises the real magic-link path.
 *
 * What it writes (prod):
 *   - one Supabase auth user for TEST_EMAIL (email_confirm:true so the
 *     magic link works with no extra confirmation step)
 *   - one `student` row (is_demo=FALSE — a real student, not a demo
 *     persona), coach_id = your own coach row so your coach view sees it
 *   - 3 `student_work` rows (source='d2l_valence_sync' to mirror the
 *     real synced path the engine + v2 Today/reflect-start consume).
 *     Content is freshly written in the style of real assignments —
 *     NO real student's submission text is copied.
 *
 * Idempotent: the student is anchored by the unique sentinel
 * nlu_id/email; assignments are anchored by sentinel external_id, so
 * re-running never duplicates and never destroys a conversation you
 * already started against a seeded assignment.
 *
 * Fully reversible: `npx tsx scripts/teardown-test-student.ts`.
 *
 * Requires env (.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY.
 *
 * Run: `npx tsx scripts/seed-test-student.ts`
 */

// Load .env.local explicitly — dotenv/config defaults to .env which
// Next.js doesn't use; the project's env lives in .env.local.
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// ─── Sentinels (also used verbatim by teardown-test-student.ts) ──────
export const TEST_EMAIL = 'andrewmcurran+student@gmail.com'
export const TEST_NLU_ID = 'TEST-ANDREW-STUDENT'
const COACH_ID = 'a4f866a1-3321-4560-9e47-d45caafbd518' // "Andrew Curran" (your own coach row)
const COHORT = 'Spring 2026'
const QUARTER = 'Spring 2026'
const PROGRAM_START = '2026-01-06'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

/**
 * Three freshly-authored assignments modeled on the *shape* of real
 * d2l_valence_sync work (reflective PFS/HUM prompts, ~0.8–1.5k chars).
 * Deliberately generic so they contain zero real student data while
 * still giving the excavation engine rich, real-feeling material.
 */
const ASSIGNMENTS = [
  {
    externalId: 'test-andrew-w1-orientation',
    title: 'Week 1 Assignment: Orientation Reflection & Slack Intro',
    courseName: 'PFS-100-0',
    courseCode: '31623.202530',
    workType: 'other',
    weekNumber: 1,
    description:
      'Welcome to the program. For this first reflection, introduce ' +
      'yourself to your cohort in Slack, then write a short reflection ' +
      '(300–500 words) responding to the following: What brought you ' +
      'to this program right now? Describe a moment in the last year ' +
      'when you had to learn something hard and unfamiliar — what did ' +
      'you actually do, and what did it show you about how you work? ' +
      'Finally, name one thing you want to be true about yourself by ' +
      'the end of this term, and why it matters to you specifically.',
    content:
      'I came into this program after spending two years doing support ' +
      'work where I was good at the day-to-day but felt like I had ' +
      'stopped growing. The hard, unfamiliar thing I had to learn last ' +
      'year was taking over our team’s onboarding docs after the person ' +
      'who owned them left with no handoff. I started by just reading ' +
      'every old ticket to reconstruct why things were the way they ' +
      'were, then rewrote one section at a time and asked two coworkers ' +
      'to try following it cold. Watching them get stuck where I ' +
      'thought it was obvious was uncomfortable but it taught me I ' +
      'default to assuming people share my context. By the end of this ' +
      'term I want it to be true that I can explain my thinking clearly ' +
      'enough that someone can act on it without me in the room — that ' +
      'matters because every job I actually want depends on it.',
  },
  {
    externalId: 'test-andrew-w6-team-conflict',
    title: 'Week 6: Navigating a Team Conflict',
    courseName: 'PFS-100-0',
    courseCode: '31623.202530',
    workType: 'other',
    weekNumber: 6,
    description:
      'Think about a time you were part of a group or team where there ' +
      'was real disagreement about how to proceed — not a minor ' +
      'difference, but something where people were genuinely invested ' +
      'in different outcomes. In 400–600 words, describe the situation ' +
      'concretely: who was involved, what the disagreement was actually ' +
      'about (look past the surface), what you did, and what you would ' +
      'do differently. Be specific about your own role, including the ' +
      'parts you are less proud of.',
    content:
      'On a class project our group of four split over scope: two of us ' +
      'wanted to ship something small and finished, two wanted to ' +
      'attempt the ambitious version. I was in the "small" camp. The ' +
      'real disagreement wasn’t about the project — it was that the ' +
      'ambitious pair felt the safe version wasted the chance to do ' +
      'something they could be proud of, and I was mostly afraid of ' +
      'turning in something broken. I called a meeting and tried to ' +
      'broker a compromise, but looking back I was really just ' +
      'lobbying for my option with extra steps. What actually moved us ' +
      'was when I stopped defending and asked the other pair to walk ' +
      'through exactly what "ambitious" required, hour by hour. Once it ' +
      'was concrete we could all see one feature was the real value and ' +
      'the rest was risk, and we cut to that. What I’d do differently: ' +
      'get to the concrete version first instead of arguing about ' +
      'abstractions, and say out loud that I was anxious rather than ' +
      'dressing it up as pragmatism.',
  },
  {
    externalId: 'test-andrew-w1-ethical-leadership',
    title: 'Week 1 Assignment 1: Exploring Ethical Leadership Through Personal Values',
    courseName: 'HUM-150-0',
    courseCode: '31624.202530',
    workType: 'essay',
    weekNumber: 1,
    description:
      'This course examines leadership as an ethical practice. For this ' +
      'first essay (600–800 words), identify one value you would say ' +
      'genuinely guides how you act — not one you think you should ' +
      'have. Tell the story of a specific decision where that value ' +
      'cost you something. Analyze: what did the value actually demand, ' +
      'what was the cheaper alternative, and how did you decide? ' +
      'Connect this to what you think ethical leadership requires of a ' +
      'person when no one is checking.',
    content:
      'The value I’d actually defend is not leaving people worse off ' +
      'than I found them, even quietly. The decision that cost me: I ' +
      'was the most senior person on a shift when a newer coworker made ' +
      'an error that I caught before it reached the customer. The ' +
      'cheap, frankly normal, option was to fix it silently and move ' +
      'on, which would have made me look fast and left them never ' +
      'knowing. Instead I flagged it to them directly and privately, ' +
      'which meant a longer, more awkward shift and them being briefly ' +
      'upset with me. I decided based on what I’d want if it were ' +
      'reversed — I would rather know. I think ethical leadership when ' +
      'no one is checking mostly comes down to refusing the version of ' +
      'events that is most flattering to you, especially when it’s ' +
      'available for free and no one would ever catch the substitution.',
  },
] as const

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  // supabase-js admin listUsers is paginated; walk pages until we find
  // the email or run out.
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
  console.log('▶ Provisioning the test student auth user…')
  let authUserId = await findAuthUserIdByEmail(TEST_EMAIL)
  if (authUserId) {
    console.log(`  reused existing auth user ${authUserId} (${TEST_EMAIL})`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      email_confirm: true,
    })
    if (error || !data?.user) {
      throw new Error(
        `Failed to create auth user for ${TEST_EMAIL}: ${error?.message ?? 'no user returned'}`
      )
    }
    authUserId = data.user.id
    console.log(`  created auth user ${authUserId} (${TEST_EMAIL})`)
  }

  console.log('▶ Upserting the student row (is_demo=false, real student)…')
  const { data: existing, error: findErr } = await supabase
    .from('student')
    .select('id')
    .eq('nlu_id', TEST_NLU_ID)
    .maybeSingle()
  if (findErr) throw findErr

  let studentId: string
  if (existing?.id) {
    studentId = existing.id as string
    const { error: updErr } = await supabase
      .from('student')
      .update({
        auth_user_id: authUserId,
        email: TEST_EMAIL,
        first_name: 'Andrew',
        last_name: 'Curran (Test Student)',
        coach_id: COACH_ID,
        cohort: COHORT,
        program_start_date: PROGRAM_START,
        status: 'active',
        is_demo: false,
        demo_slug: null,
        data_consent_acknowledged_at: new Date().toISOString(),
      })
      .eq('id', studentId)
    if (updErr) throw updErr
    console.log(`  reused + refreshed student ${studentId}`)
  } else {
    studentId = randomUUID()
    const { error: insErr } = await supabase.from('student').insert({
      id: studentId,
      auth_user_id: authUserId,
      nlu_id: TEST_NLU_ID,
      first_name: 'Andrew',
      last_name: 'Curran (Test Student)',
      email: TEST_EMAIL,
      coach_id: COACH_ID,
      cohort: COHORT,
      program_start_date: PROGRAM_START,
      status: 'active',
      is_demo: false,
      demo_slug: null,
      data_consent_acknowledged_at: new Date().toISOString(),
    })
    if (insErr) throw insErr
    console.log(`  inserted student ${studentId}`)
  }

  console.log('▶ Seeding assignments (idempotent by external_id)…')
  const submittedBase = Date.now()
  const workUrls: string[] = []
  for (let i = 0; i < ASSIGNMENTS.length; i++) {
    const a = ASSIGNMENTS[i]
    const { data: priorWork, error: pwErr } = await supabase
      .from('student_work')
      .select('id')
      .eq('student_id', studentId)
      .eq('external_id', a.externalId)
      .maybeSingle()
    if (pwErr) throw pwErr

    let workId: string
    if (priorWork?.id) {
      workId = priorWork.id as string
      console.log(`  kept existing "${a.title}" (${workId}) — preserves any conversation already started`)
    } else {
      workId = randomUUID()
      const submittedAt = new Date(
        submittedBase - (ASSIGNMENTS.length - i) * 86_400_000
      ).toISOString()
      const { error: wErr } = await supabase.from('student_work').insert({
        id: workId,
        student_id: studentId,
        title: a.title,
        description: a.description,
        content: a.content,
        work_type: a.workType,
        course_name: a.courseName,
        course_code: a.courseCode,
        submitted_at: submittedAt,
        quarter: QUARTER,
        week_number: a.weekNumber,
        source: 'd2l_valence_sync',
        external_id: a.externalId,
        imported_at: new Date().toISOString(),
      })
      if (wErr) throw wErr
      console.log(`  inserted "${a.title}" (${workId})`)
    }
    workUrls.push(`  • ${a.title}\n      /v2/reflect/start?work=${workId}`)
  }

  console.log('\n✅ Done.\n')
  console.log('Log in as yourself (real magic-link student):')
  console.log(`  1. Open /login and enter:  ${TEST_EMAIL}`)
  console.log('     (Gmail +alias — the magic link lands in your normal inbox.)')
  console.log('  2. You will resolve as role:student (no coach row on this auth id).')
  console.log(`  3. Student id: ${studentId}  |  Coach view: your own "Andrew Curran" coach sees this student.`)
  console.log('\nWork-based loop — open any of these directly:')
  console.log(workUrls.join('\n'))
  console.log('\nOpen-reflection loop — no work item needed:')
  console.log('  • /v2/journal → the composer → write anything → it stays in v2')
  console.log('\nReminder: the v2 start surfaces only work once the feature branch')
  console.log('is deployed/merged (PR #6). On main today /v2/reflect/start is the')
  console.log('old stub. The data above is deploy-independent and ready when it ships.')
  console.log('\nTear down anytime:  npx tsx scripts/teardown-test-student.ts')
}

main().catch(err => {
  console.error('✖ seed-test-student failed:', err)
  process.exit(1)
})
