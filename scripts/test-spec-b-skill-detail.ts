/**
 * Structural invariants for Spec B — student-owned skill detail.
 * Routes/components can't run under tsx; comment-stripped source scan.
 * USAGE: npx tsx scripts/test-spec-b-skill-detail.ts
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { assertEqual, section, finish } from './_sync-test-harness'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (rel: string): string =>
  existsSync(resolve(__dirname, '..', rel))
    ? readFileSync(resolve(__dirname, '..', rel), 'utf-8')
    : ''
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

section('Task 1: POST /api/student/skill-definition')
{
  const r = stripComments(read('src/app/api/student/skill-definition/route.ts'))
  assertEqual(/export async function POST/.test(r), true, 'exports POST')
  assertEqual(/export const runtime = 'nodejs'/.test(r) && /export const dynamic = 'force-dynamic'/.test(r), true, 'runtime/dynamic set')
  assertEqual(/getV2StudentId/.test(r), true, 'resolves student via getV2StudentId (self-scoped)')
  assertEqual(/student_skill_definition/.test(r), true, 'writes student_skill_definition')
  assertEqual(/is_current/.test(r) && /false/.test(r), true, 'demotes prior is_current')
  assertEqual(/prompted_by/.test(r) && /self_initiated/.test(r), true, "prompted_by 'self_initiated'")
  assertEqual(/definitionText|definition_text/.test(r) && /trim\(\)/.test(r), true, 'validates non-empty definition')
  assertEqual(/student_id:\s*studentId|student_id:\s*resolved/.test(r), true, 'writes resolved student id, not a body-supplied one')
}

section('Task 2: GET /api/student/skill/[skillId]/unreflected-work')
{
  const r = stripComments(read('src/app/api/student/skill/[skillId]/unreflected-work/route.ts'))
  assertEqual(/export async function GET/.test(r), true, 'exports GET')
  assertEqual(/export const runtime = 'nodejs'/.test(r) && /export const dynamic = 'force-dynamic'/.test(r), true, 'runtime/dynamic set')
  assertEqual(/getV2StudentId/.test(r), true, 'student-scoped via getV2StudentId')
  assertEqual(/work_skill_tag/.test(r), true, 'reads work_skill_tag for the skill')
  assertEqual(/activeInProgress/.test(r) && /items/.test(r), true, 'returns { activeInProgress, items }')
  assertEqual(/in_progress/.test(r) && /completed/.test(r), true, 'excludes work with in_progress/completed conversations')
  assertEqual(/slice\(0, 5\)|limit\(5\)|\.slice\(0,5\)/.test(r), true, 'caps at 5')
  assertEqual(/status:\s*'unreflected'/.test(r), true, 'items carry status unreflected')
}

section('Task 3: SkillDefinitionEditor + editable definition')
{
  const e = stripComments(read('src/components/panels/SkillDefinitionEditor.tsx'))
  assertEqual(/'use client'/.test(e), true, 'editor is client component')
  assertEqual(/export function SkillDefinitionEditor/.test(e), true, 'SkillDefinitionEditor exported')
  assertEqual(/\/api\/student\/skill-definition/.test(e), true, 'posts to skill-definition endpoint')
  assertEqual(/definitionText/.test(e) && /personalExample/.test(e) && /whyItMatters/.test(e), true, 'three fields')
  const p = stripComments(read('src/components/panels/SkillPanel.tsx'))
  assertEqual(/editable\??:\s*boolean/.test(p), true, 'SkillPanel takes editable prop')
  assertEqual(/SkillDefinitionEditor/.test(p), true, 'renders the editor when editing')
  assertEqual(/editable\s*&&/.test(p), true, 'gates editor affordance on editable')
  assertEqual(/router\.refresh\(\)/.test(p), true, 'refreshes after save')
  // Re-edit data-loss guard: the editor writes a FULL new version, so it must be
  // pre-filled with the student's current example/why — not blank (which would
  // silently wipe them on save). See GardenPlant.currentPersonalExample/currentWhyItMatters.
  assertEqual(/initialPersonalExample=\{plant\.currentPersonalExample\}/.test(p), true, 'editor fed current personal example (guards re-edit data loss)')
  assertEqual(/initialWhyItMatters=\{plant\.currentWhyItMatters\}/.test(p), true, 'editor fed current why-it-matters (guards re-edit data loss)')
}

section('Task 4: SkillPanel work-to-reflect section')
{
  const p = stripComments(read('src/components/panels/SkillPanel.tsx'))
  assertEqual(/unreflected-work/.test(p), true, 'fetches unreflected-work endpoint')
  assertEqual(/useStartReflection/.test(p), true, 'uses useStartReflection')
  assertEqual(/InProgressInterstitial/.test(p), true, 'renders InProgressInterstitial')
  assertEqual(/SubmissionRow/.test(p), true, 'renders SubmissionRow rows')
  assertEqual(/Work to reflect on/.test(p), true, 'section heading present')
  assertEqual(/editable\s*&&/.test(p), true, 'section gated on editable')
}

section('Task 5: GrowthGrid editable threading + nudge')
{
  const g = stripComments(read('src/components/v2/growth/GrowthGrid.tsx'))
  assertEqual(/editable\??:\s*boolean/.test(g), true, 'GrowthGrid takes editable prop')
  assertEqual(/editable=\{editable\}|editable=\{true\}/.test(g) || /editable\}/.test(g), true, 'passes editable to SkillPanel')
  assertEqual(/currentDefinition/.test(g) && /editable\s*&&/.test(g), true, 'nudge gated on editable, keys off missing definition')
  const v = stripComments(read('src/app/v2/(student)/growth/GrowthView.tsx'))
  assertEqual(/<GrowthGrid[\s\S]{0,120}editable/.test(v), true, 'student GrowthView passes editable')
  const sd = stripComments(read('src/app/v2/(coach)/coach/[studentId]/StudentDetailView.tsx'))
  assertEqual(/<GrowthGrid[^>]*editable/.test(sd), false, 'coach StudentDetailView does NOT pass editable (stays read-only)')
}

section('Hide SDT assessment from students (showCoachAssessment gate)')
{
  const p = stripComments(read('src/components/panels/SkillPanel.tsx'))
  assertEqual(/showCoachAssessment\??:\s*boolean/.test(p), true, 'SkillPanel takes showCoachAssessment prop')
  assertEqual(/showCoachAssessment\s*&&[\s\S]{0,800}Coach:/.test(p), true, 'SDT block (Coach: ...) gated on showCoachAssessment')

  const g = stripComments(read('src/components/v2/growth/GrowthGrid.tsx'))
  assertEqual(/showCoachAssessment\??:\s*boolean/.test(g), true, 'GrowthGrid takes showCoachAssessment prop')
  assertEqual(/showCoachAssessment=\{showCoachAssessment\}/.test(g), true, 'threads showCoachAssessment to SkillCard + SkillPanel')
  assertEqual(/showCoachAssessment\s*\?[\s\S]{0,200}config\.name/.test(g), true, 'SkillCard level name gated on showCoachAssessment')

  const sd = stripComments(read('src/app/v2/(coach)/coach/[studentId]/StudentDetailView.tsx'))
  assertEqual(/<GrowthGrid[^>]*showCoachAssessment/.test(sd), true, 'coach StudentDetailView opts in to showCoachAssessment')

  const v = stripComments(read('src/app/v2/(student)/growth/GrowthView.tsx'))
  assertEqual(/showCoachAssessment/.test(v), false, 'student GrowthView does NOT pass showCoachAssessment (SDT stays hidden)')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
