/**
 * Seed demo personas into the live Supabase DB.
 *
 * Inserts every row from src/data/*.ts into the real tables with
 * `is_demo = true` and a `demo_slug` set to the static seed's slug
 * id (e.g. 'stu_aja', 'coach_elizabeth'). After this runs, every v2
 * API route exercises the real DB query paths — there's nothing
 * "demo specific" downstream of auth.
 *
 * Idempotent: deletes all existing demo rows first, then re-inserts.
 * Safe to re-run any time the static seed changes.
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run with: `npx tsx scripts/seed-demo-data.ts`
 */

// Load .env.local explicitly — dotenv/config defaults to .env which
// Next.js doesn't use; the project's env lives in .env.local.
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

import { coaches as staticCoaches } from '../src/data/coaches'
import { students as staticStudents } from '../src/data/students'
import { skills as staticSkills } from '../src/data/skills'
import { studentWork as staticWork } from '../src/data/student-work'
import { conversations as staticConvos } from '../src/data/conversations'
import { assessments as staticAssessments } from '../src/data/assessments'
import { skillDefinitions as staticDefs } from '../src/data/skill-definitions'
import { skillNarratives as staticNarratives } from '../src/data/skill-narratives'
import { careerOutputs as staticCareerOutputs } from '../src/data/career-output'
import { coachNotes as staticNotes } from '../src/data/coach-notes'
import { goals as staticGoals } from '../src/data/goals'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// Slug → UUID map. Pillar + skill slugs get pre-populated from the
// existing DB rows by name lookup; everything else is freshly minted
// per-run (since we DELETE + INSERT all demo rows each run).
const idMap = new Map<string, string>()
function uuidFor(slug: string): string {
  const existing = idMap.get(slug)
  if (existing) return existing
  const fresh = randomUUID()
  idMap.set(slug, fresh)
  return fresh
}

async function main() {
  console.log('▶ Resolving pillar + skill UUIDs from DB…')
  const { data: pillarRows, error: pillarErr } = await supabase
    .from('pillar')
    .select('id, name')
  if (pillarErr) throw pillarErr
  const { data: skillRows, error: skillErr } = await supabase
    .from('durable_skill')
    .select('id, name')
  if (skillErr) throw skillErr

  // The static seed uses slug ids ('pillar_creative', 'skill_resilience')
  // but the live DB uses UUIDs. Resolve by name match.
  const staticPillarsByName: Record<string, string> = {
    'Creative & Curious Thinkers': 'pillar_creative',
    'Leaders with Purpose & Agency': 'pillar_lead',
    'Thrivers in Change': 'pillar_thrive',
    'Network Builders': 'pillar_network',
  }
  for (const p of pillarRows ?? []) {
    const slug = staticPillarsByName[p.name]
    if (slug) idMap.set(slug, p.id as string)
  }
  for (const s of skillRows ?? []) {
    // Match static skills by name → DB UUID
    const staticSkill = staticSkills.find(ss => ss.name === s.name)
    if (staticSkill) idMap.set(staticSkill.id, s.id as string)
  }

  console.log(`  ${pillarRows?.length ?? 0} pillars, ${skillRows?.length ?? 0} skills mapped`)

  // ─── Delete existing demo rows (reverse dependency order) ───
  console.log('▶ Clearing existing demo data…')

  // Find demo student + coach ids first so we can use them in filters
  const { data: existingDemoStudents } = await supabase
    .from('student')
    .select('id')
    .eq('is_demo', true)
  const { data: existingDemoCoaches } = await supabase
    .from('coach')
    .select('id')
    .eq('is_demo', true)
  const demoStudentIds = (existingDemoStudents ?? []).map(r => r.id as string)
  const demoCoachIds = (existingDemoCoaches ?? []).map(r => r.id as string)

  if (demoStudentIds.length > 0) {
    // Get conversation IDs so we can clean child tables
    const { data: existingConvos } = await supabase
      .from('growth_conversation')
      .select('id')
      .in('student_id', demoStudentIds)
    const convoIds = (existingConvos ?? []).map(c => c.id as string)

    if (convoIds.length > 0) {
      await del('conversation_skill_tag', 'conversation_id', convoIds)
      await del('conversation_output', 'conversation_id', convoIds)
    }
    await del('career_output', 'student_id', demoStudentIds)
    await del('coach_note', 'student_id', demoStudentIds)
    await del('student_goal', 'student_id', demoStudentIds)
    await del('skill_narrative', 'student_id', demoStudentIds)
    await del('growth_conversation', 'student_id', demoStudentIds)
    await del('skill_assessment', 'student_id', demoStudentIds)
    await del('student_skill_definition', 'student_id', demoStudentIds)
    await del('student_work', 'student_id', demoStudentIds)
  }
  await supabase.from('student').delete().eq('is_demo', true)
  await supabase.from('coach').delete().eq('is_demo', true)

  // ─── Insert fresh demo data ───
  console.log('▶ Inserting coaches…')
  const coachRows = staticCoaches.map(c => ({
    id: uuidFor(c.id),
    name: c.name,
    email: demoEmail(c.email),
    status: c.status,
    is_demo: true,
    demo_slug: c.id,
  }))
  await insert('coach', coachRows)

  console.log('▶ Inserting students…')
  const studentRows = staticStudents.map(s => ({
    id: uuidFor(s.id),
    nlu_id: s.nluId,
    first_name: s.firstName,
    last_name: s.lastName,
    email: demoEmail(s.email),
    coach_id: uuidFor(s.coachId),
    cohort: s.cohort,
    program_start_date: s.programStartDate,
    status: s.status,
    is_demo: true,
    demo_slug: s.id,
  }))
  await insert('student', studentRows)

  console.log('▶ Inserting student work…')
  const workRows = staticWork.map(w => ({
    id: uuidFor(w.id),
    student_id: uuidFor(w.studentId),
    title: w.title,
    description: w.description ?? null,
    work_type: w.workType,
    course_name: w.courseName ?? null,
    course_code: w.courseCode ?? null,
    submitted_at: w.submittedAt,
    quarter: w.quarter,
    week_number: w.weekNumber ?? null,
    attempt_number: w.attemptNumber ?? null,
    content: w.content ?? null,
    grade: w.grade ?? null,
    source: w.source ?? 'manual',
    external_id: w.externalId ?? null,
    imported_at: w.importedAt ?? null,
  }))
  await insert('student_work', workRows)

  console.log('▶ Inserting conversations…')
  const convoRows = staticConvos.map(c => ({
    id: uuidFor(c.id),
    student_id: uuidFor(c.studentId),
    work_id: c.workId ? uuidFor(c.workId) : null,
    quarter: c.quarter,
    week_number: c.weekNumber ?? null,
    status: c.status,
    started_at: c.startedAt,
    completed_at: c.completedAt ?? null,
    duration_seconds: c.durationSeconds ?? null,
    work_context: c.workContext ?? null,
    prompt_phase_1: c.promptPhase1 ?? null,
    response_phase_1: c.responsePhase1 ?? null,
    prompt_phase_2: c.promptPhase2 ?? null,
    response_phase_2: c.responsePhase2 ?? null,
    prompt_phase_3: c.promptPhase3 ?? null,
    response_phase_3: c.responsePhase3 ?? null,
    synthesis_text: c.synthesisText ?? null,
    suggested_insight: c.suggestedInsight ?? null,
    conversation_type: c.conversationType ?? 'work_based',
    reflection_description: c.reflectionDescription ?? null,
    student_tagged_skill_id: c.studentTaggedSkillId ? uuidFor(c.studentTaggedSkillId) : null,
  }))
  await insert('growth_conversation', convoRows)

  console.log('▶ Inserting conversation skill tags…')
  const tagRows: Array<Record<string, unknown>> = []
  for (const c of staticConvos) {
    for (const t of c.skillTags ?? []) {
      tagRows.push({
        id: randomUUID(),
        conversation_id: uuidFor(c.id),
        skill_id: uuidFor(t.skillId),
        confidence: t.confidence,
        student_confirmed: t.studentConfirmed,
        rationale: t.rationale ?? null,
      })
    }
  }
  if (tagRows.length > 0) await insert('conversation_skill_tag', tagRows)

  console.log('▶ Inserting skill assessments…')
  const assessRows = staticAssessments.map(a => ({
    id: uuidFor(a.id),
    student_id: uuidFor(a.studentId),
    skill_id: uuidFor(a.skillId),
    assessor_type: a.assessorType,
    assessor_id: a.assessorId ? uuidFor(a.assessorId) : null,
    sdt_level: a.sdtLevel,
    rationale: a.rationale ?? null,
    confidence: a.confidence ?? null,
    quarter: a.quarter,
    assessed_at: a.assessedAt,
  }))
  await insert('skill_assessment', assessRows)

  console.log('▶ Inserting skill definitions…')
  const defRows = staticDefs.map(d => ({
    id: uuidFor(d.id),
    student_id: uuidFor(d.studentId),
    skill_id: uuidFor(d.skillId),
    definition_text: d.definitionText,
    personal_example: d.personalExample ?? null,
    why_it_matters: d.whyItMatters ?? null,
    version: d.version,
    is_current: d.isCurrent,
    prompted_by: d.promptedBy ?? null,
    created_at: d.createdAt,
  }))
  await insert('student_skill_definition', defRows)

  console.log('▶ Inserting skill narratives…')
  const narrativeRows = staticNarratives.map(n => ({
    id: randomUUID(),
    student_id: uuidFor(n.studentId),
    skill_id: uuidFor(n.skillId),
    version: n.version,
    narrative_text: n.narrativeText,
    narrative_richness: n.narrativeRichness,
    // Map the slug-style conversationId in each annotation to the
    // real DB UUID we minted above.
    narrative_annotations: n.annotations
      ? n.annotations.map(a => ({
          sentence: a.sentence,
          conversationId: uuidFor(a.conversationId),
        }))
      : null,
  }))
  await insert('skill_narrative', narrativeRows)

  console.log('▶ Inserting career outputs…')
  const careerRows = staticCareerOutputs.map(co => ({
    id: randomUUID(),
    student_id: uuidFor(co.studentId),
    version: co.version,
    resume_summary: co.resumeSummary,
    skill_descriptions: co.skillDescriptions.map(sd => ({
      // Resolve skillId in the JSONB blob to the DB UUID so the
      // career view can do its pillar enrichment lookup correctly.
      skillId: uuidFor(sd.skillId),
      skillName: sd.skillName,
      resumeLanguage: sd.resumeLanguage,
      talkingPoints: sd.talkingPoints,
    })),
  }))
  await insert('career_output', careerRows)

  console.log('▶ Inserting coach notes…')
  const noteRows = staticNotes.map(n => ({
    id: uuidFor(n.id),
    coach_id: uuidFor(n.coachId),
    student_id: uuidFor(n.studentId),
    note_text: n.noteText,
    bright_spot: n.brightSpot ?? null,
    next_step: n.nextStep ?? null,
    session_date: n.sessionDate,
    quarter: n.quarter,
    contact_method: n.contactMethod,
  }))
  await insert('coach_note', noteRows)

  console.log('▶ Inserting student goals…')
  const goalRows = staticGoals.map(g => ({
    id: uuidFor(g.id),
    student_id: uuidFor(g.studentId),
    goal_text: g.goalText,
    quarter: g.quarter,
    status: g.status,
    progress_notes: g.progressNotes ?? null,
    outcome_reflection: g.outcomeReflection ?? null,
    carried_forward: g.carriedForward,
    previous_goal_id: g.previousGoalId ? uuidFor(g.previousGoalId) : null,
    // Preserve the historical timestamp from the seed so the demo
    // reads as Aja's full academic year rather than "everything just
    // happened today."
    created_at: g.createdAt,
  }))
  await insert('student_goal', goalRows)

  console.log('✓ Done')
}

/** Replace nlu.edu domain with le3demo.local so demo emails can't
 * collide with real NLU students when they onboard. */
function demoEmail(email: string): string {
  return email.replace(/@nlu\.edu$/, '@le3demo.local')
}

async function del(table: string, column: string, ids: string[]) {
  if (ids.length === 0) return
  const { error } = await supabase.from(table).delete().in(column, ids)
  if (error) console.warn(`  ! delete from ${table} failed: ${error.message}`)
}

async function insert(table: string, rows: unknown[]) {
  if (rows.length === 0) return
  // Insert in chunks to stay under Supabase's payload limits.
  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const { error } = await supabase.from(table).insert(slice)
    if (error) {
      console.error(`  ✗ insert into ${table} failed: ${error.message}`)
      throw error
    }
  }
  console.log(`  ✓ ${table}: ${rows.length} row${rows.length === 1 ? '' : 's'}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
