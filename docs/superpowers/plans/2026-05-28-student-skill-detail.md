# Student-Owned Skill Detail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the student skill-definition editor and add a "work to reflect on" section, both in the SkillPanel off the Growth grid — interactive for students, read-only for coaches.

**Architecture:** Two new student-scoped API routes (`POST /api/student/skill-definition`, `GET /api/student/skill/[skillId]/unreflected-work`). `SkillPanel` gains an `editable` prop; when true it shows a definition editor (writes a new version) and a lazily-fetched "work to reflect on" list whose rows start a reflection via the shared `useStartReflection` hook. `GrowthGrid` threads `editable` and renders a "define your skills" nudge; the student `GrowthView` passes `editable`, the coach `StudentDetailView` does not. No schema changes.

**Tech Stack:** Next.js App Router, React client components, Supabase (admin client server-side; `getV2StudentId` for identity), Tailwind, framer-motion. Structural source-scan tests via `npx tsx`.

**Spec:** `docs/superpowers/specs/2026-05-28-student-skill-detail-design.md`

---

## File Structure

- **Create:** `src/app/api/student/skill-definition/route.ts` — POST, writes a new definition version (Task 1)
- **Create:** `src/app/api/student/skill/[skillId]/unreflected-work/route.ts` — GET, returns `{ activeInProgress, items }` (Task 2)
- **Create:** `src/components/panels/SkillDefinitionEditor.tsx` — the editor form (Task 3)
- **Modify:** `src/components/panels/SkillPanel.tsx` — `editable` prop, editor affordance (Task 3), work-to-reflect section (Task 4)
- **Modify:** `src/components/v2/growth/GrowthGrid.tsx` — thread `editable`, render nudge (Task 5)
- **Modify:** `src/app/v2/(student)/growth/GrowthView.tsx` — pass `editable` (Task 5)
- **Create:** `scripts/test-spec-b-skill-detail.ts` — structural tests (built up across tasks)

---

## Task 1: POST /api/student/skill-definition

**Files:**
- Create: `src/app/api/student/skill-definition/route.ts`
- Create: `scripts/test-spec-b-skill-detail.ts`

- [ ] **Step 1: Write the failing test** — Create `scripts/test-spec-b-skill-detail.ts` with EXACTLY:

```ts
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

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-b-skill-detail.ts
```
Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Create the route** — Create `src/app/api/student/skill-definition/route.ts` with EXACTLY:

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/student/skill-definition
 *
 * Create a new version of the authenticated student's definition for a
 * skill. Self-scoped: the student id comes from getV2StudentId (persona
 * cookie OR real auth) — never from the request body — so a caller can
 * only write their OWN definitions. Each save demotes the prior
 * is_current row and inserts a new is_current row at version+1, tagged
 * prompted_by='self_initiated'. The backend reflection/conversation/
 * narrative flows already read these.
 */
export async function POST(req: Request) {
  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ ok: false, error: 'Not a student' }, { status: 403 })
  }

  let body: {
    skillId?: string
    definitionText?: string
    personalExample?: string | null
    whyItMatters?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const skillId = body.skillId
  const definitionText = (body.definitionText ?? '').trim()
  const personalExample = body.personalExample?.trim() || null
  const whyItMatters = body.whyItMatters?.trim() || null

  if (!skillId) {
    return NextResponse.json({ ok: false, error: 'skillId is required' }, { status: 400 })
  }
  if (definitionText.length === 0) {
    return NextResponse.json({ ok: false, error: 'A definition is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Validate the skill exists.
  const { data: skill } = await admin
    .from('durable_skill')
    .select('id')
    .eq('id', skillId)
    .maybeSingle()
  if (!skill) {
    return NextResponse.json({ ok: false, error: 'Unknown skill' }, { status: 400 })
  }

  // Compute next version from existing rows for this student+skill.
  const { data: existing } = await admin
    .from('student_skill_definition')
    .select('version')
    .eq('student_id', studentId)
    .eq('skill_id', skillId)
    .order('version', { ascending: false })
    .limit(1)
  const nextVersion = ((existing?.[0]?.version as number | undefined) ?? 0) + 1

  // Demote any current row(s), then insert the new current version.
  const { error: demoteErr } = await admin
    .from('student_skill_definition')
    .update({ is_current: false })
    .eq('student_id', studentId)
    .eq('skill_id', skillId)
    .eq('is_current', true)
  if (demoteErr) {
    return NextResponse.json({ ok: false, error: `Demote failed: ${demoteErr.message}` }, { status: 500 })
  }

  const { error: insertErr } = await admin
    .from('student_skill_definition')
    .insert({
      student_id: studentId,
      skill_id: skillId,
      definition_text: definitionText,
      personal_example: personalExample,
      why_it_matters: whyItMatters,
      version: nextVersion,
      is_current: true,
      prompted_by: 'self_initiated',
    })
  if (insertErr) {
    return NextResponse.json({ ok: false, error: `Insert failed: ${insertErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run test to verify it passes**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-b-skill-detail.ts
```
Expected: 8 passed, 0 failed.

- [ ] **Step 5: Gates**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json src/app/api/student/skill-definition/route.ts scripts/test-spec-b-skill-detail.ts
```
Expected: tsc 0; eslint clean.

- [ ] **Step 6: Commit**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add src/app/api/student/skill-definition/route.ts scripts/test-spec-b-skill-detail.ts && git commit -m "feat(skill): POST /api/student/skill-definition (versioned, self-scoped)"
```

---

## Task 2: GET /api/student/skill/[skillId]/unreflected-work

**Files:**
- Create: `src/app/api/student/skill/[skillId]/unreflected-work/route.ts`
- Modify: `scripts/test-spec-b-skill-detail.ts`

- [ ] **Step 1: Write the failing test** — insert ABOVE the marker in `scripts/test-spec-b-skill-detail.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-b-skill-detail.ts
```
Expected: FAIL — route doesn't exist (8 new fails).

- [ ] **Step 3: Create the route** — Create `src/app/api/student/skill/[skillId]/unreflected-work/route.ts` with EXACTLY:

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2StudentId } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/student/skill/[skillId]/unreflected-work
 *
 * Returns the student's submissions tagged with this skill (via
 * work_skill_tag) that have NO reflection yet — i.e. no growth_
 * conversation that is in_progress or completed for the work. Newest
 * first, capped at 5. Also returns the student's current active
 * in-progress reflection so the panel can wire useStartReflection
 * (which routes through the in-progress interstitial when one exists).
 *
 * Self-scoped via getV2StudentId. Shape: { activeInProgress, items }
 * where items match SubmissionItem (status always 'unreflected').
 */
export async function GET(
  _req: Request,
  { params }: { params: { skillId: string } }
) {
  const studentId = await getV2StudentId()
  if (!studentId) {
    return NextResponse.json({ error: 'Not a student' }, { status: 403 })
  }
  const skillId = params.skillId
  const admin = createAdminClient()

  // 1. Work ids tagged with this skill, for this student.
  const { data: tagRows } = await admin
    .from('work_skill_tag')
    .select('work_id, student_work!inner(student_id)')
    .eq('skill_id', skillId)
    .eq('student_work.student_id', studentId)
  const taggedWorkIds = Array.from(
    new Set((tagRows ?? []).map(t => t.work_id as string))
  )

  // 2. Active-in-progress reflection (global for the student), used to
  //    prime useStartReflection in the panel.
  const { data: activeRow } = await admin
    .from('growth_conversation')
    .select('id, work_id, conversation_type, started_at, current_phase, student_work(title)')
    .eq('student_id', studentId)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const activeInProgress = activeRow
    ? {
        id: activeRow.id as string,
        workId: (activeRow.work_id as string | null) ?? null,
        workTitle:
          ((activeRow.student_work as { title?: string } | null)?.title as string | undefined) ?? null,
        conversationType: (activeRow.conversation_type ?? 'work_based') as
          | 'work_based'
          | 'open_reflection',
        currentPhase: ((activeRow.current_phase as number | null) ?? 1) as 1 | 2 | 3,
        startedAt: activeRow.started_at as string,
      }
    : null

  if (taggedWorkIds.length === 0) {
    return NextResponse.json({ activeInProgress, items: [] })
  }

  // 3. Work ids that already have an in_progress/completed conversation.
  const { data: convRows } = await admin
    .from('growth_conversation')
    .select('work_id, status')
    .eq('student_id', studentId)
    .in('status', ['in_progress', 'completed'])
    .in('work_id', taggedWorkIds)
  const reflectedWorkIds = new Set(
    (convRows ?? []).map(c => c.work_id as string).filter(Boolean)
  )

  // 4. Fetch the unreflected tagged work, newest first, cap 5.
  const unreflectedIds = taggedWorkIds.filter(id => !reflectedWorkIds.has(id))
  if (unreflectedIds.length === 0) {
    return NextResponse.json({ activeInProgress, items: [] })
  }
  const { data: workRows } = await admin
    .from('student_work')
    .select('id, title, course_name, course_code, week_number, submitted_at, quarter, work_type')
    .in('id', unreflectedIds)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(5)

  const items = (workRows ?? []).map(w => ({
    id: w.id as string,
    title: w.title as string,
    courseName: (w.course_name as string | null) ?? null,
    courseCode: (w.course_code as string | null) ?? null,
    weekNumber: (w.week_number as number | null) ?? null,
    submittedAt: (w.submitted_at as string | null) ?? null,
    quarter: (w.quarter as string | null) ?? '',
    workType: (w.work_type as string | null) ?? null,
    status: 'unreflected' as const,
    conversationId: null,
    primaryPillar: null,
  }))

  return NextResponse.json({ activeInProgress, items })
}
```

- [ ] **Step 4: Run test to verify it passes**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-b-skill-detail.ts
```
Expected: Tasks 1-2 = 16 passed, 0 failed.

- [ ] **Step 5: Gates**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json "src/app/api/student/skill/[skillId]/unreflected-work/route.ts" scripts/test-spec-b-skill-detail.ts
```
Expected: tsc 0; eslint clean.

- [ ] **Step 6: Commit**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add "src/app/api/student/skill/[skillId]/unreflected-work/route.ts" scripts/test-spec-b-skill-detail.ts && git commit -m "feat(skill): GET unreflected-work per skill (returns activeInProgress + items)"
```

---

## Task 3: SkillDefinitionEditor + SkillPanel editable definition

**Files:**
- Create: `src/components/panels/SkillDefinitionEditor.tsx`
- Modify: `src/components/panels/SkillPanel.tsx`
- Modify: `scripts/test-spec-b-skill-detail.ts`

- [ ] **Step 1: Write the failing test** — insert ABOVE the marker:

```ts
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
}
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-b-skill-detail.ts
```
Expected: FAIL (8 new fails).

- [ ] **Step 3: Create SkillDefinitionEditor.tsx** — Create `src/components/panels/SkillDefinitionEditor.tsx` with EXACTLY:

```tsx
'use client'

import { useState } from 'react'

/**
 * Inline editor for a student's skill definition (3 fields). Posts to
 * /api/student/skill-definition which writes a new version. On success,
 * calls onSaved (the panel triggers router.refresh()).
 */

interface SkillDefinitionEditorProps {
  skillId: string
  initialDefinition: string | null
  initialPersonalExample: string | null
  initialWhyItMatters: string | null
  onSaved: () => void
  onCancel: () => void
}

export function SkillDefinitionEditor({
  skillId,
  initialDefinition,
  initialPersonalExample,
  initialWhyItMatters,
  onSaved,
  onCancel,
}: SkillDefinitionEditorProps) {
  const [definitionText, setDefinitionText] = useState(initialDefinition ?? '')
  const [personalExample, setPersonalExample] = useState(initialPersonalExample ?? '')
  const [whyItMatters, setWhyItMatters] = useState(initialWhyItMatters ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = definitionText.trim().length > 0 && !saving

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/student/skill-definition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId,
          definitionText,
          personalExample,
          whyItMatters,
        }),
      })
      const data = (await r.json()) as { ok?: boolean; error?: string }
      if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          What this skill means to me
        </label>
        <textarea
          value={definitionText}
          onChange={e => setDefinitionText(e.target.value)}
          rows={3}
          className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-600"
          placeholder="In your own words…"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          A time it showed up <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          value={personalExample}
          onChange={e => setPersonalExample(e.target.value)}
          rows={2}
          className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-600"
          placeholder="A moment when you used it…"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Why it matters to me <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          value={whyItMatters}
          onChange={e => setWhyItMatters(e.target.value)}
          rows={2}
          className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-600"
          placeholder="What it gives you…"
        />
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-3 py-1.5 text-sm font-medium"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-gray-300 hover:bg-gray-50 px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire the editor into SkillPanel** — Read `src/components/panels/SkillPanel.tsx`. Make these edits:

(a) Replace the import block at the top:
```tsx
import { useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { GardenPlant } from '@/lib/types'
import { SDT_LEVELS } from '@/lib/constants'
import { ConversationPanel } from './ConversationPanel'
import { useState } from 'react'
```
with:
```tsx
import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import type { GardenPlant } from '@/lib/types'
import { SDT_LEVELS } from '@/lib/constants'
import { ConversationPanel } from './ConversationPanel'
import { SkillDefinitionEditor } from './SkillDefinitionEditor'
```

(b) Replace the props interface + signature:
```tsx
interface SkillPanelProps {
  plant: GardenPlant
  onClose: () => void
}

export function SkillPanel({ plant, onClose }: SkillPanelProps) {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
```
with:
```tsx
interface SkillPanelProps {
  plant: GardenPlant
  onClose: () => void
  editable?: boolean
}

export function SkillPanel({ plant, onClose, editable = false }: SkillPanelProps) {
  const router = useRouter()
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [editingDefinition, setEditingDefinition] = useState(false)
```

(c) Replace the entire "Definition Journey" block (from `{/* Definition Journey */}` through its closing `</div>` just before `{/* Conversations */}`):
```tsx
            {/* Definition Journey */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">
                Definition Journey
              </h3>

              {plant.previousDefinition && (
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1">Earlier definition</p>
                  <p className="text-sm text-gray-600 italic">
                    &ldquo;{plant.previousDefinition}&rdquo;
                  </p>
                </div>
              )}

              {plant.previousDefinition && plant.currentDefinition && (
                <div className="text-center text-xs text-green-600 my-2">
                  ↓ across {plant.conversationCount} conversations ↓
                </div>
              )}

              {plant.currentDefinition && (
                <div>
                  {plant.definitionRevised && (
                    <p className="text-xs text-gray-400 mb-1">Current definition</p>
                  )}
                  <p className="text-sm text-gray-800 italic font-medium">
                    &ldquo;{plant.currentDefinition}&rdquo;
                  </p>
                </div>
              )}

              {!plant.currentDefinition && (
                <p className="text-sm text-gray-400 italic">No definition on file yet.</p>
              )}
            </div>
```
with:
```tsx
            {/* Definition Journey */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3 border-b pb-1">
                <h3 className="text-sm font-semibold text-gray-700">Definition Journey</h3>
                {editable && !editingDefinition && (
                  <button
                    type="button"
                    onClick={() => setEditingDefinition(true)}
                    className="text-xs text-green-700 hover:text-green-900"
                  >
                    {plant.currentDefinition ? '✎ Edit' : '+ Define this skill'}
                  </button>
                )}
              </div>

              {editingDefinition ? (
                <SkillDefinitionEditor
                  skillId={plant.skillId}
                  initialDefinition={plant.currentDefinition}
                  initialPersonalExample={null}
                  initialWhyItMatters={null}
                  onSaved={() => {
                    setEditingDefinition(false)
                    router.refresh()
                  }}
                  onCancel={() => setEditingDefinition(false)}
                />
              ) : (
                <>
                  {plant.previousDefinition && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Earlier definition</p>
                      <p className="text-sm text-gray-600 italic">
                        &ldquo;{plant.previousDefinition}&rdquo;
                      </p>
                    </div>
                  )}

                  {plant.previousDefinition && plant.currentDefinition && (
                    <div className="text-center text-xs text-green-600 my-2">
                      ↓ across {plant.conversationCount} conversations ↓
                    </div>
                  )}

                  {plant.currentDefinition && (
                    <div>
                      {plant.definitionRevised && (
                        <p className="text-xs text-gray-400 mb-1">Current definition</p>
                      )}
                      <p className="text-sm text-gray-800 italic font-medium">
                        &ldquo;{plant.currentDefinition}&rdquo;
                      </p>
                    </div>
                  )}

                  {!plant.currentDefinition && (
                    <p className="text-sm text-gray-400 italic">No definition on file yet.</p>
                  )}
                </>
              )}
            </div>
```

(Note: `initialPersonalExample`/`initialWhyItMatters` are passed `null` because `GardenPlant` doesn't carry them today; the editor starts those two fields empty. The definition field pre-fills from `currentDefinition`. Pre-filling example/why is a deferred enhancement noted in the spec.)

- [ ] **Step 5: Run test to verify it passes**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-b-skill-detail.ts
```
Expected: Tasks 1-3 = 24 passed, 0 failed.

- [ ] **Step 6: Gates**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json src/components/panels/SkillDefinitionEditor.tsx src/components/panels/SkillPanel.tsx scripts/test-spec-b-skill-detail.ts
```
Expected: tsc 0; eslint clean. (SkillPanel's new `editable` prop defaults false; callers unchanged still compile.)

- [ ] **Step 7: Commit**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add src/components/panels/SkillDefinitionEditor.tsx src/components/panels/SkillPanel.tsx scripts/test-spec-b-skill-detail.ts && git commit -m "feat(skill): editable definition in SkillPanel (gated on editable)"
```

---

## Task 4: SkillPanel "work to reflect on" section

**Files:**
- Modify: `src/components/panels/SkillPanel.tsx`
- Modify: `scripts/test-spec-b-skill-detail.ts`

- [ ] **Step 1: Write the failing test** — insert ABOVE the marker:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-b-skill-detail.ts
```
Expected: FAIL (6 new fails).

- [ ] **Step 3: Add the work-to-reflect logic + section to SkillPanel.tsx**

(a) Add these imports to the existing import block (after the `SkillDefinitionEditor` import):
```tsx
import { SubmissionRow } from '@/components/v2/student/SubmissionRow'
import { InProgressInterstitial } from '@/components/v2/student/InProgressInterstitial'
import { useStartReflection } from '@/components/v2/student/use-start-reflection'
import type { ActiveInProgress, SubmissionItem } from '@/components/v2/student/types'
```

(b) Inside the component, after the `const [editingDefinition, setEditingDefinition] = useState(false)` line, add:
```tsx
  const [unreflected, setUnreflected] = useState<SubmissionItem[]>([])
  const [active, setActive] = useState<ActiveInProgress | null>(null)

  useEffect(() => {
    if (!editable) return
    let cancelled = false
    fetch(`/api/student/skill/${plant.skillId}/unreflected-work`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { activeInProgress: null, items: [] }))
      .then((d: { activeInProgress: ActiveInProgress | null; items: SubmissionItem[] }) => {
        if (cancelled) return
        setActive(d.activeInProgress ?? null)
        setUnreflected(d.items ?? [])
      })
      .catch(() => { if (!cancelled) { setActive(null); setUnreflected([]) } })
    return () => { cancelled = true }
  }, [editable, plant.skillId])

  const { onSubmissionClick, interstitialFor, closeInterstitial, startError } =
    useStartReflection({ active, onRefresh: () => router.refresh() })
```

(c) Add the section JSX immediately BEFORE the `{/* Conversations */}` block:
```tsx
            {/* Work to reflect on */}
            {editable && unreflected.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">
                  Work to reflect on ({unreflected.length})
                </h3>
                {startError && <p className="text-xs text-red-700 mb-2">{startError}</p>}
                <ul className="space-y-0.5">
                  {unreflected.map(item => (
                    <li key={item.id}>
                      <SubmissionRow item={item} surface="today" onClick={onSubmissionClick} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
```

(d) Add the interstitial render immediately AFTER the nested `{selectedConvId && (<ConversationPanel ... />)}` block (just before the final `</>`):
```tsx
      {/* In-progress interstitial when starting from a work-to-reflect row */}
      {interstitialFor && active && (
        <InProgressInterstitial
          active={active}
          newWork={interstitialFor}
          onClose={closeInterstitial}
          onStarted={() => router.refresh()}
        />
      )}
```

- [ ] **Step 4: Run test to verify it passes**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-b-skill-detail.ts
```
Expected: Tasks 1-4 = 30 passed, 0 failed.

- [ ] **Step 5: Gates**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json src/components/panels/SkillPanel.tsx scripts/test-spec-b-skill-detail.ts
```
Expected: tsc 0; eslint clean.

- [ ] **Step 6: Commit**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add src/components/panels/SkillPanel.tsx scripts/test-spec-b-skill-detail.ts && git commit -m "feat(skill): work-to-reflect section in SkillPanel (start reflection via useStartReflection)"
```

---

## Task 5: GrowthGrid editable threading + nudge; GrowthView passes editable

**Files:**
- Modify: `src/components/v2/growth/GrowthGrid.tsx`
- Modify: `src/app/v2/(student)/growth/GrowthView.tsx`
- Modify: `scripts/test-spec-b-skill-detail.ts`

- [ ] **Step 1: Write the failing test** — insert ABOVE the marker:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-b-skill-detail.ts
```
Expected: FAIL (the GrowthGrid/GrowthView assertions fail).

- [ ] **Step 3: Thread editable + add nudge in GrowthGrid.tsx**

(a) Replace the props interface + signature:
```tsx
interface Props {
  data: GardenData
  showHeader?: boolean
}

export function GrowthGrid({ data, showHeader = true }: Props) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const selected = selectedSkillId
    ? data.plants.find(p => p.skillId === selectedSkillId) ?? null
    : null

  const pillarGroups = groupByPillar(data.plants)
```
with:
```tsx
interface Props {
  data: GardenData
  showHeader?: boolean
  editable?: boolean
}

export function GrowthGrid({ data, showHeader = true, editable = false }: Props) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const selected = selectedSkillId
    ? data.plants.find(p => p.skillId === selectedSkillId) ?? null
    : null

  const pillarGroups = groupByPillar(data.plants)
  const undefinedSkills = editable
    ? data.plants.filter(p => !p.currentDefinition)
    : []
```

(b) Add the nudge immediately AFTER the `{showHeader && (...)}` block and BEFORE `<div className="space-y-6">`:
```tsx
      {editable && undefinedSkills.length > 0 && (
        <button
          type="button"
          onClick={() => setSelectedSkillId(undefinedSkills[0].skillId)}
          className="w-full mb-4 text-left rounded-xl border border-green-200 bg-green-50 px-4 py-3 hover:bg-green-100 transition-colors"
        >
          <span className="text-sm font-medium text-green-900">
            {undefinedSkills.length} skill{undefinedSkills.length === 1 ? '' : 's'} still need{undefinedSkills.length === 1 ? 's' : ''} your words
          </span>
          <span className="block text-xs text-green-700 mt-0.5">
            Tap to define what {undefinedSkills.length === 1 ? 'it means' : 'they mean'} to you →
          </span>
        </button>
      )}
```

(c) Replace the SkillPanel render:
```tsx
      {selected && (
        <SkillPanel plant={selected} onClose={() => setSelectedSkillId(null)} />
      )}
```
with:
```tsx
      {selected && (
        <SkillPanel plant={selected} onClose={() => setSelectedSkillId(null)} editable={editable} />
      )}
```

- [ ] **Step 4: Pass editable from the student GrowthView** — In `src/app/v2/(student)/growth/GrowthView.tsx`, replace:
```tsx
  return <GrowthGrid data={data} />
```
with:
```tsx
  return <GrowthGrid data={data} editable />
```

- [ ] **Step 5: Run test to verify it passes**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-b-skill-detail.ts
```
Expected: Tasks 1-5 = 36 passed, 0 failed.

- [ ] **Step 6: Full gates + regressions + build**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/growth/GrowthGrid.tsx "src/app/v2/(student)/growth/GrowthView.tsx" scripts/test-spec-b-skill-detail.ts
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-reflect-today-redesign.ts
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-a-guidance.ts
cd /Users/andrewcurran/le3-growth-portfolio && npm run build
```
Expected: tsc 0; eslint clean; reflect-today-redesign 0 failures; spec-a 20/0; build EXIT 0 "Compiled successfully".

- [ ] **Step 7: Commit**
```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add src/components/v2/growth/GrowthGrid.tsx "src/app/v2/(student)/growth/GrowthView.tsx" scripts/test-spec-b-skill-detail.ts && git commit -m "feat(skill): GrowthGrid threads editable + define-your-skills nudge (student-only)"
```

---

## Self-Review

**Spec coverage:**
- Item 4 (definition editor inline + nudge, 3 fields, silent versioning, POST endpoint) → Tasks 1, 3, 5.
- Item 3 (work-to-reflect section, GET endpoint returning {activeInProgress, items}, click→start via useStartReflection + interstitial) → Tasks 2, 4.
- Coach/student gating (editable prop, student passes, coach doesn't) → Tasks 3, 4, 5 (+ Task 5 asserts StudentDetailView does NOT pass editable).
- Testing + build → Task 5 Step 6.

**Placeholder scan:** None. All code is literal. The `initialPersonalExample/whyItMatters = null` is an explicit, documented choice (GardenPlant doesn't carry them), not a placeholder.

**Type consistency:** `editable?: boolean` consistent across GrowthGrid + SkillPanel. The unreflected-work endpoint returns `{ activeInProgress: ActiveInProgress | null, items: SubmissionItem[] }`; SkillPanel consumes that exact shape and feeds `active` to `useStartReflection({ active, onRefresh })` (matches the hook's signature) and `items` to `SubmissionRow` (matches `SubmissionItem`). `InProgressInterstitial` props `{ active, newWork, onClose, onStarted }` match its usage in ReflectView/TodayView. `prompted_by: 'self_initiated'` matches the schema enum.

**Gating defense-in-depth:** UI gates on `editable`; both endpoints independently self-scope via `getV2StudentId()` (a caller can only read/write their own data), so even without the UI gate a coach can't mutate a student's definition.
