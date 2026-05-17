# Conversation Validator (Dry-Run) Implementation Plan

> **⚠️ PARKED 2026-05-17 — DO NOT EXECUTE AS-IS.** A blocking architectural
> defect was found during implementation: the engine's LLM client
> unconditionally writes an `event_log` row (with real student name +
> assignment text) on every call, falsifying this plan's "zero-write by
> construction" premise and the structural test's adequacy. Tasks 1 + the
> pagination fix are committed and sound on branch `feat/conversation-validator`
> (`f5ea6d5`, `562f7a0`); Task 2 (`eadbf64`) carries the latent violation;
> Tasks 3–5 not started. See the **⚠️ PARKED — blocking defect** section at the
> top of the spec (`docs/superpowers/specs/2026-05-16-conversation-validator-design.md`)
> for the verified call chain and resolution options A/B/C. A future
> brainstorm must pick a resolution before any resume.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin-only, ephemeral tool that walks a real student + real synced assignment through the Phase1→synthesis conversation engine for manual quality validation, writing nothing to the DB and never associating with the student.

**Architecture:** A new stateless, step-discriminated route `POST /api/admin/validate-conversation` re-enforces the existing ADMIN_EMAILS gate, builds a production-faithful `ConversationContext` from **read-only** selects (mirroring `api/conversation/start`'s context assembly but with the admin client + an arbitrary `studentId`), and calls the engine functions in `conversation-engine-live.ts` **directly** — never the persisting `api/conversation/*` routes. The route contains zero write operations (a structural test asserts this). A new ToolsView panel holds the transcript in React state and posts it back each step.

**Tech Stack:** Next.js 14 App Router route handler, `@/lib/conversation-engine-live` (engine), `@/lib/llm-prompts` (`ConversationContext`, `determineTargetSkill`, `buildSkillLevelMap`), `@/lib/v2-auth` (`getV2Identity`, `isAdminEmail`), `@/lib/supabase-admin` (`createAdminClient`), React panel in ToolsView, tsx test script (no module-mocking framework exists — see Task 5).

**Spec:** `docs/superpowers/specs/2026-05-16-conversation-validator-design.md`

---

## File Structure

**New:**
- `src/app/api/admin/validate-conversation/route.ts` — the stateless zero-write route: admin gate, step dispatch, the private read-only context builder + small local `snakeToCamel`/`getCurrentQuarter` helpers (copied from `api/conversation/start/route.ts`, consistent with the codebase's per-route duplication of these — do NOT refactor into a shared util; that's out of scope).
- `src/app/v2/(coach)/coach/tools/ConversationValidatorPanel.tsx` — the panel component (dropdowns, stepper, per-step fetch, DRY-RUN banner, reset). One responsibility: the validator UI.
- `scripts/test-validate-conversation.ts` — structural zero-write source scan + shape sanity (tsx convention).

**Modified:**
- `src/app/v2/(coach)/coach/tools/ToolsView.tsx` — mount `<ConversationValidatorPanel />` following the existing panel pattern.

**Conventions (read before starting):**
- Run a test script: `npx tsx scripts/<name>.ts`. Typecheck: `npx tsc --noEmit` (exit 0).
- **Lint:** `npx next lint` is environmentally broken in this repo's worktrees (dual `@next/next` plugin). Use `npx eslint --no-eslintrc --config .eslintrc.json <files>` (exit 0, no warnings).
- One commit per task; message ends with the standard `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- The single load-bearing invariant: **the route file contains zero `.insert(` / `.update(` / `.upsert(` / `.delete(` calls and never imports a persisting helper.** Every task must preserve this; Task 1's test enforces it from the first commit.

---

## Task 1: Route skeleton — admin gate + `pickers` step + the zero-write structural test

**Files:**
- Create: `src/app/api/admin/validate-conversation/route.ts`
- Create: `scripts/test-validate-conversation.ts`

- [ ] **Step 1: Write the failing structural test**

Create `scripts/test-validate-conversation.ts`. Copy the assertion-helper scaffold (`assertEqual`, `section`, `passed`/`failed`, `process.exit(failed>0?1:0)`) from the top of `scripts/test-sync-run.ts` (it needs NO mock-valence / NO env bootstrap — it's a pure source scan + a Supabase read). Then:

```ts
import { readFileSync } from 'node:fs'
import { createAdminClient } from '@/lib/supabase-admin'

const ROUTE = 'src/app/api/admin/validate-conversation/route.ts'

async function main(): Promise<void> {
  section('validate-conversation route: zero-write structural invariant')
  const src = readFileSync(ROUTE, 'utf8')

  // Hard invariant: the route must never write. Any of these = fail.
  const forbidden = [/\.insert\s*\(/, /\.update\s*\(/, /\.upsert\s*\(/, /\.delete\s*\(/]
  for (const re of forbidden) {
    assertEqual(re.test(src), false, `route source contains no ${re}`)
  }
  // It must not import the persisting conversation routes/helpers.
  assertEqual(/api\/conversation\//.test(src), false, 'route does not reference api/conversation/* (persisting routes)')
  // It must re-enforce the admin gate server-side.
  assertEqual(/isAdminEmail\s*\(/.test(src), true, 'route calls isAdminEmail() server-side')
  assertEqual(/getV2Identity\s*\(/.test(src), true, 'route resolves identity via getV2Identity()')
  // It must export POST.
  assertEqual(/export\s+async\s+function\s+POST\s*\(/.test(src), true, 'route exports async POST')

  section('pickers step returns real (non-demo) students with synced work')
  const admin = createAdminClient()
  // Sanity: there is at least one is_demo=false student with synced work to pick
  // (this is a read-only sanity check; it does not exercise the handler).
  const { data: anyStudent } = await admin
    .from('student').select('id').eq('is_demo', false).limit(1)
  assertEqual(Array.isArray(anyStudent), true, 'student table reachable for pickers')

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
main()
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `npx tsx scripts/test-validate-conversation.ts`
Expected: FAIL — `readFileSync` throws `ENOENT ... validate-conversation/route.ts` (route not created yet).

- [ ] **Step 3: Create the route with the admin gate + `pickers` step**

Create `src/app/api/admin/validate-conversation/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getV2Identity, isAdminEmail } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/validate-conversation — ADMIN-ONLY, EPHEMERAL, ZERO-WRITE.
 *
 * Dry-run walkthrough of the reflection/conversation engine against a
 * REAL student + REAL synced assignment, for manual quality validation.
 * Calls the engine functions in conversation-engine-live.ts DIRECTLY and
 * never the persisting api/conversation/* routes. This file performs
 * ONLY read selects — it MUST NOT contain insert/update/upsert/delete.
 * Nothing is persisted; nothing is associated with the student.
 *
 * Stateless + step-discriminated; the client holds the transcript and
 * posts prior responses back each step.
 */
type Body =
  | { step: 'pickers'; studentId?: string }
  | { step: 'phase1'; studentId: string; workId: string }
  | { step: 'phase2'; studentId: string; workId: string; phase1Response: string }
  | { step: 'phase3'; studentId: string; workId: string; phase1Response: string; phase2Response: string }
  | {
      step: 'finish'
      studentId: string
      workId: string
      phase1Response: string
      phase2Response: string
      phase3Response: string
    }

export async function POST(request: Request) {
  // ─── Admin gate (re-enforced server-side; never trust the panel) ───
  const identity = await getV2Identity()
  if (!identity || identity.role !== 'coach' || !isAdminEmail(identity.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    if (body.step === 'pickers') {
      if (!body.studentId) {
        // List real (non-demo) students that have ≥1 synced assignment.
        const { data: workRows } = await admin
          .from('student_work')
          .select('student_id')
          .eq('source', 'd2l_valence_sync')
        const studentIds = Array.from(
          new Set((workRows ?? []).map((w: Record<string, unknown>) => w.student_id as string))
        )
        if (studentIds.length === 0) return NextResponse.json({ students: [] })
        const { data: students } = await admin
          .from('student')
          .select('id, first_name, last_name, cohort')
          .eq('is_demo', false)
          .in('id', studentIds)
          .order('first_name')
        return NextResponse.json({
          students: (students ?? []).map((s: Record<string, unknown>) => ({
            id: s.id,
            name: `${s.first_name} ${s.last_name}`,
            cohort: s.cohort,
          })),
        })
      }
      // Assignments for the chosen student (synced only).
      const { data: work } = await admin
        .from('student_work')
        .select('id, title, course_name, submitted_at')
        .eq('student_id', body.studentId)
        .eq('source', 'd2l_valence_sync')
        .order('submitted_at', { ascending: true })
      return NextResponse.json({
        assignments: (work ?? []).map((w: Record<string, unknown>) => ({
          id: w.id,
          title: w.title,
          courseName: w.course_name,
          submittedAt: w.submitted_at,
        })),
      })
    }

    // phase1/2/3/finish handled in Task 2 & 3.
    return NextResponse.json({ error: `Unknown step: ${(body as { step: string }).step}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: `validator error at step '${body.step}': ${String(err).slice(0, 300)}` },
      { status: 502 }
    )
  }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx tsx scripts/test-validate-conversation.ts`
Expected: PASS — all structural assertions ✓, student table reachable.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json src/app/api/admin/validate-conversation/route.ts scripts/test-validate-conversation.ts` → no warnings

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/validate-conversation/route.ts scripts/test-validate-conversation.ts
git commit -m "$(cat <<'EOF'
admin: validate-conversation route skeleton (gate + pickers, zero-write)

ADMIN_EMAILS-gated server-side; pickers step lists real synced
students/assignments. Structural test asserts the route contains no
insert/update/upsert/delete — the load-bearing zero-write invariant.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `phase1`/`phase2`/`phase3` steps — read-only context build + engine calls

**Files:**
- Modify: `src/app/api/admin/validate-conversation/route.ts`

- [ ] **Step 1: Read the authoritative context-assembly to mirror**

Read `src/app/api/conversation/start/route.ts` lines ~119–180 (the read-only context assembly: the `Promise.all` of `growth_conversation`(+`student_work`, status=completed, limit 10) / `student_skill_definition`(is_current) / `skill_assessment`(assessor_type=coach); the `snakeToCamel` maps; `determineTargetSkill`; `buildSkillLevelMap`; the `ConversationContext` object literal with `conversation: {}`), and copy the small local helpers `snakeToCamel` and `getCurrentQuarter` from the bottom of that same file (≈ lines 248–280) **verbatim** (the codebase defines these per-route; copying is consistent — do NOT extract a shared util).

- [ ] **Step 2: Add the read-only context builder + phase steps**

In `src/app/api/admin/validate-conversation/route.ts`: add imports
```ts
import { generatePhase1Question, generatePhase2Question, generatePhase3Question } from '@/lib/conversation-engine-live'
import { determineTargetSkill, buildSkillLevelMap, type ConversationContext } from '@/lib/llm-prompts'
import type { Student, StudentWork, SkillAssessment, GrowthConversation } from '@/lib/types'
```
Paste the verbatim-copied `snakeToCamel` and `getCurrentQuarter` helpers (from Step 1) at the bottom of the file. Add a private builder that mirrors `api/conversation/start`'s assembly but uses the admin client + an arbitrary `studentId` (NO insert afterward):

```ts
async function buildValidatorContext(
  admin: ReturnType<typeof createAdminClient>,
  studentId: string,
  workId: string
): Promise<{ context: ConversationContext } | { error: string; status: number }> {
  const { data: studentRow } = await admin
    .from('student').select('*').eq('id', studentId).single()
  if (!studentRow) return { error: 'Student not found', status: 404 }
  if (studentRow.is_demo === true)
    return { error: 'Validator is for real (non-demo) students only', status: 400 }

  const { data: workRow } = await admin
    .from('student_work').select('*').eq('id', workId).single()
  if (!workRow) return { error: 'Assignment not found', status: 404 }
  if (workRow.student_id !== studentId)
    return { error: 'Assignment does not belong to that student', status: 400 }
  if (workRow.source !== 'd2l_valence_sync')
    return { error: 'Assignment is not a synced assignment', status: 400 }

  const [prevConvosResult, definitionsResult, assessmentsResult] = await Promise.all([
    admin.from('growth_conversation')
      .select('*, student_work(*)')
      .eq('student_id', studentId).eq('status', 'completed')
      .order('started_at', { ascending: false }).limit(10),
    admin.from('student_skill_definition')
      .select('*').eq('student_id', studentId).eq('is_current', true),
    admin.from('skill_assessment')
      .select('*').eq('student_id', studentId).eq('assessor_type', 'coach')
      .order('assessed_at', { ascending: false }),
  ])

  const previousConversations = (prevConvosResult.data || []).map((c: Record<string, unknown>) => ({
    ...(snakeToCamel(c) as unknown as GrowthConversation),
    work: c.student_work
      ? (snakeToCamel(c.student_work as Record<string, unknown>) as unknown as StudentWork)
      : null,
  }))
  const assessments = (assessmentsResult.data || []).map(
    (a: Record<string, unknown>) => snakeToCamel(a) as unknown as SkillAssessment
  )
  const work = snakeToCamel(workRow) as unknown as StudentWork
  const targetSkillId = determineTargetSkill(work, assessments)
  const skillLevels = buildSkillLevelMap(assessments)

  const context: ConversationContext = {
    student: snakeToCamel(studentRow) as unknown as Student,
    work,
    conversation: {},
    previousConversations,
    currentDefinitions: (definitionsResult.data || []).map(
      (d: Record<string, unknown>) => snakeToCamel(d)
    ) as unknown as ConversationContext['currentDefinitions'],
    skillLevels,
    targetSkillId,
    targetSkillLevel: skillLevels.get(targetSkillId) || 'external',
    quarter: getCurrentQuarter(),
  }
  return { context }
}
```

Replace the `// phase1/2/3/finish handled in Task 2 & 3.` line with phase handling (still inside the existing `try`):

```ts
if (body.step === 'phase1' || body.step === 'phase2' || body.step === 'phase3') {
  const built = await buildValidatorContext(admin, body.studentId, body.workId)
  if ('error' in built)
    return NextResponse.json({ error: built.error }, { status: built.status })
  const { context } = built

  if (body.step === 'phase1') {
    const question = await generatePhase1Question(context)
    return NextResponse.json({
      question,
      contextEcho: {
        assignment: context.work.title,
        snippet: (context.work.content || context.work.description || '').slice(0, 600),
        targetSkillId: context.targetSkillId,
        targetSkillLevel: context.targetSkillLevel,
      },
    })
  }
  if (body.step === 'phase2') {
    const question = await generatePhase2Question(context, body.phase1Response)
    return NextResponse.json({ question })
  }
  // phase3
  const question = await generatePhase3Question(
    context, body.phase1Response, body.phase2Response
  )
  return NextResponse.json({ question })
}

// finish handled in Task 3.
return NextResponse.json({ error: `Unknown step: ${(body as { step: string }).step}` }, { status: 400 })
```

- [ ] **Step 3: Structural test still green (zero-write preserved)**

Run: `npx tsx scripts/test-validate-conversation.ts`
Expected: PASS — the new code added only `.select(...)`; the `.insert/.update/.upsert/.delete` assertions still pass.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json src/app/api/admin/validate-conversation/route.ts` → no warnings

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/validate-conversation/route.ts
git commit -m "$(cat <<'EOF'
admin/validate-conversation: read-only context build + phase1/2/3

Mirrors api/conversation/start's context assembly (admin client,
arbitrary studentId, zero writes) and calls the engine phase
generators directly. Structural zero-write test still green.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `finish` step — synthesis + skill-tags + conversation-output (production-faithful, zero-write)

**Files:**
- Modify: `src/app/api/admin/validate-conversation/route.ts`

- [ ] **Step 1: Add finish-step engine imports**

Add to the engine import in the route:
```ts
import {
  generatePhase1Question, generatePhase2Question, generatePhase3Question,
  generateSynthesis, suggestSkillTags, generateConversationOutput,
} from '@/lib/conversation-engine-live'
```

- [ ] **Step 2: Implement the `finish` step**

Replace `// finish handled in Task 3.` and the trailing `Unknown step` return with:

```ts
if (body.step === 'finish') {
  const built = await buildValidatorContext(admin, body.studentId, body.workId)
  if ('error' in built)
    return NextResponse.json({ error: built.error }, { status: built.status })
  const { context } = built

  const phases = {
    p1: body.phase1Response,
    p2: body.phase2Response,
    p3: body.phase3Response,
  }
  const synthesis = await generateSynthesis(context, phases)
  const skillTags = await suggestSkillTags(context, phases, synthesis.synthesisText)

  // Production (api/conversation/[id]/next-phase) passes {} for rubric
  // descriptors (a documented TODO there) — replicate EXACTLY so the
  // dry-run matches production behavior; do not invent rubric data.
  const conversationOutput = await generateConversationOutput(
    {
      promptPhase1: context.conversation.promptPhase1 ?? undefined,
      responsePhase1: body.phase1Response,
      promptPhase2: context.conversation.promptPhase2 ?? undefined,
      responsePhase2: body.phase2Response,
      promptPhase3: context.conversation.promptPhase3 ?? undefined,
      responsePhase3: body.phase3Response,
      synthesisText: synthesis.synthesisText,
    },
    skillTags.map(t => ({ skillId: t.skillId })),
    {}, // rubric descriptors — matches production next-phase (TODO there)
    context.previousConversations.map(c => ({
      synthesisText: (c as unknown as { synthesisText?: string }).synthesisText,
      suggestedInsight: (c as unknown as { suggestedInsight?: string }).suggestedInsight,
    }))
  )

  return NextResponse.json({ synthesis, skillTags, conversationOutput })
}

return NextResponse.json({ error: `Unknown step: ${(body as { step: string }).step}` }, { status: 400 })
```

Note: the engine's `generateConversationOutput` prompt strings (`promptPhase1` etc.) aren't persisted in a dry-run; the engine only needs the responses + synthesisText to produce key_moments/voice markers, so passing the prompts as `undefined` (they were never stored) is faithful and harmless — the same `conversation` arg shape production uses, minus the stored prompts.

- [ ] **Step 3: Structural test still green**

Run: `npx tsx scripts/test-validate-conversation.ts`
Expected: PASS — still zero write calls; `generateConversationOutput` is an engine call, not a DB write, and its result is **returned**, never `.insert`ed (unlike production's next-phase which inserts it — the validator deliberately does not).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json src/app/api/admin/validate-conversation/route.ts` → no warnings

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/validate-conversation/route.ts
git commit -m "$(cat <<'EOF'
admin/validate-conversation: finish step (synthesis+tags+output)

Returns generateSynthesis + suggestSkillTags + generateConversationOutput
(empty rubric descriptors, matching production next-phase). Result is
returned to the panel, never inserted — zero-write invariant intact.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: ToolsView panel

**Files:**
- Create: `src/app/v2/(coach)/coach/tools/ConversationValidatorPanel.tsx`
- Modify: `src/app/v2/(coach)/coach/tools/ToolsView.tsx`

- [ ] **Step 1: Inspect the existing panel pattern**

Read `src/app/v2/(coach)/coach/tools/ToolsView.tsx`. Note how existing panels (e.g. the sync status / inspector panels) are imported and rendered (the container/section wrapper, heading style, `'use client'` usage). The new panel must follow that exact pattern (same wrapper element/classes) so it visually matches.

- [ ] **Step 2: Create `ConversationValidatorPanel.tsx`**

```tsx
'use client'

import { useState } from 'react'

type Picker = { id: string; name?: string; cohort?: string; title?: string; courseName?: string; submittedAt?: string }
type Phase = 'idle' | 'phase1' | 'phase2' | 'phase3' | 'finished'

async function call(body: unknown) {
  const res = await fetch('/api/admin/validate-conversation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export default function ConversationValidatorPanel() {
  const [students, setStudents] = useState<Picker[]>([])
  const [assignments, setAssignments] = useState<Picker[]>([])
  const [studentId, setStudentId] = useState('')
  const [workId, setWorkId] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [questions, setQuestions] = useState<{ p1?: string; p2?: string; p3?: string }>({})
  const [responses, setResponses] = useState<{ p1: string; p2: string; p3: string }>({ p1: '', p2: '', p3: '' })
  const [contextEcho, setContextEcho] = useState<Record<string, unknown> | null>(null)
  const [result, setResult] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function reset() {
    setPhase('idle'); setQuestions({}); setResponses({ p1: '', p2: '', p3: '' })
    setContextEcho(null); setResult(null); setErr(null); setWorkId('')
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null)
    try { await fn() } catch (e) { setErr(String(e instanceof Error ? e.message : e)) }
    finally { setBusy(false) }
  }

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-amber-800">
        Conversation Validator — DRY RUN
      </h2>
      <p className="mt-1 text-xs font-semibold text-amber-700">
        Ephemeral. Nothing here is saved or associated with any student. For validation only.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded bg-amber-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          disabled={busy}
          onClick={() => run(async () => {
            const d = await call({ step: 'pickers' })
            setStudents(d.students); setAssignments([]); reset()
          })}
        >Load students</button>

        {students.length > 0 && (
          <select
            className="rounded border border-amber-300 px-2 py-1.5 text-xs"
            value={studentId}
            onChange={e => run(async () => {
              const sid = e.target.value
              setStudentId(sid); setWorkId(''); setAssignments([]); reset(); setStudentId(sid)
              if (sid) { const d = await call({ step: 'pickers', studentId: sid }); setAssignments(d.assignments) }
            })}
          >
            <option value="">— pick student —</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.cohort})</option>)}
          </select>
        )}

        {assignments.length > 0 && (
          <select
            className="rounded border border-amber-300 px-2 py-1.5 text-xs"
            value={workId}
            onChange={e => setWorkId(e.target.value)}
          >
            <option value="">— pick assignment —</option>
            {assignments.map(a => <option key={a.id} value={a.id}>{a.title} · {a.courseName}</option>)}
          </select>
        )}

        {studentId && workId && phase === 'idle' && (
          <button
            className="rounded bg-amber-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => run(async () => {
              const d = await call({ step: 'phase1', studentId, workId })
              setQuestions({ p1: d.question }); setContextEcho(d.contextEcho); setPhase('phase1')
            })}
          >Start walkthrough</button>
        )}

        {phase !== 'idle' && (
          <button className="rounded border border-amber-400 px-3 py-1.5 text-xs text-amber-800" onClick={reset}>
            Reset / new run
          </button>
        )}
      </div>

      {err && <p className="mt-2 rounded bg-red-100 p-2 text-xs text-red-700">{err}</p>}

      {contextEcho && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-amber-800">What the engine saw (real assignment context)</summary>
          <pre className="mt-1 overflow-auto rounded bg-white p-2">{JSON.stringify(contextEcho, null, 2)}</pre>
        </details>
      )}

      {(['phase1', 'phase2', 'phase3'] as const).map(p => {
        const idx = p === 'phase1' ? 'p1' : p === 'phase2' ? 'p2' : 'p3'
        const q = (questions as Record<string, string | undefined>)[idx]
        if (!q) return null
        const answered = phase === 'phase2' && p === 'phase1'
          ? true : phase === 'phase3' && (p === 'phase1' || p === 'phase2')
          ? true : phase === 'finished'
        return (
          <div key={p} className="mt-3 rounded bg-white p-3">
            <p className="text-xs font-semibold text-amber-900">{p.toUpperCase()} question</p>
            <p className="mt-1 text-sm">{q}</p>
            <textarea
              className="mt-2 w-full rounded border border-amber-300 p-2 text-sm"
              rows={3}
              placeholder="Type a response as if you were the student…"
              value={(responses as Record<string, string>)[idx]}
              disabled={answered || busy}
              onChange={e => setResponses(r => ({ ...r, [idx]: e.target.value }))}
            />
            {!answered && (
              <button
                className="mt-2 rounded bg-amber-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                disabled={busy || !(responses as Record<string, string>)[idx].trim()}
                onClick={() => run(async () => {
                  if (p === 'phase1') {
                    const d = await call({ step: 'phase2', studentId, workId, phase1Response: responses.p1 })
                    setQuestions(qq => ({ ...qq, p2: d.question })); setPhase('phase2')
                  } else if (p === 'phase2') {
                    const d = await call({ step: 'phase3', studentId, workId, phase1Response: responses.p1, phase2Response: responses.p2 })
                    setQuestions(qq => ({ ...qq, p3: d.question })); setPhase('phase3')
                  } else {
                    const d = await call({ step: 'finish', studentId, workId, phase1Response: responses.p1, phase2Response: responses.p2, phase3Response: responses.p3 })
                    setResult(d); setPhase('finished')
                  }
                })}
              >Submit response</button>
            )}
          </div>
        )
      })}

      {result != null && (
        <div className="mt-3 rounded bg-white p-3">
          <p className="text-xs font-semibold text-amber-900">Synthesis + Skill Tags + Conversation Output</p>
          <pre className="mt-1 overflow-auto rounded bg-amber-50 p-2 text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Mount it in `ToolsView.tsx`**

Add `import ConversationValidatorPanel from './ConversationValidatorPanel'` with the other panel imports, and render `<ConversationValidatorPanel />` in the panel list, following the exact placement/wrapper pattern observed in Step 1 (match how the sibling panels are laid out — same grid/stack container).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json src/app/v2/\(coach\)/coach/tools/ConversationValidatorPanel.tsx src/app/v2/\(coach\)/coach/tools/ToolsView.tsx` → no warnings
Run: `npx tsx scripts/test-validate-conversation.ts` → still PASS (route untouched; invariant intact)

- [ ] **Step 5: Commit**

```bash
git add src/app/v2/\(coach\)/coach/tools/ConversationValidatorPanel.tsx src/app/v2/\(coach\)/coach/tools/ToolsView.tsx
git commit -m "$(cat <<'EOF'
tools: Conversation Validator dry-run panel

Admin-only ToolsView panel: pick real student+assignment, step through
Phase1→finish playing the student, view synthesis/tags/output. Loud
DRY-RUN banner; transcript in React state only; nothing persisted.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Final verification + zero-write runbook

**Files:** none (verification only).

- [ ] **Step 1: Full automated sweep**

Run, expect all green:
- `npx tsc --noEmit` → exit 0
- `npx eslint --no-eslintrc --config .eslintrc.json src/app/api/admin/validate-conversation/route.ts src/app/v2/\(coach\)/coach/tools/ConversationValidatorPanel.tsx src/app/v2/\(coach\)/coach/tools/ToolsView.tsx scripts/test-validate-conversation.ts`
- `npx tsx scripts/test-validate-conversation.ts` → all assertions pass (the structural zero-write invariant + pickers reachability)

- [ ] **Step 2: Manual zero-write + auth verification runbook (document results in the commit message of Task 5 or a PR comment)**

Why manual for the behavioral check: this codebase has **no module-mocking framework** (only the tsx + global-fetch `mock-valence` convention), so the spec's "stub the engine and assert counts unchanged" cannot be done in-toolset without inventing a framework (scope creep the spec didn't authorize). The **structural source scan (Task 1) is a strictly stronger guarantee** — it proves the route categorically cannot write regardless of input. The behavioral + auth checks are verified manually here (and are exactly what the admin does as the tool's purpose):

1. **Zero-write, real walkthrough:** pick a known real `is_demo=false` student + a synced assignment. Before starting, in SQL: `SELECT count(*) AS c, max(started_at) FROM growth_conversation WHERE student_id='<id>';` and `SELECT count(*) FROM conversation_output co JOIN growth_conversation g ON g.id=co.conversation_id WHERE g.student_id='<id>';`. Complete a full Phase1→finish walkthrough in the panel. Re-run the same two queries → counts and `max(started_at)` MUST be identical. Also: `SELECT count(*) FROM growth_conversation WHERE work_id='<workId>' AND started_at > '<test start time>';` → 0.
2. **Auth:** signed in as a non-admin coach (or with an email not in `ADMIN_EMAILS`), `POST /api/admin/validate-conversation {"step":"pickers"}` → expect `403`. As an admin → expect `200`.
3. **Engine reaches real data:** confirm the "What the engine saw" disclosure shows the real assignment's title/snippet (not empty/placeholder) and a plausible `targetSkillId`.

- [ ] **Step 3: Commit the verification record**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
admin/validate-conversation: verification record

Automated: tsc 0, eslint clean, structural zero-write test green.
Manual runbook executed: full real walkthrough left growth_conversation
+ conversation_output counts identical for the test student (zero
writes); non-admin -> 403; engine context echoed real assignment data.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- ADMIN_EMAILS gate re-enforced server-side → Task 1 Step 3 (`getV2Identity`+`isAdminEmail` 403) ✓
- Stateless step-discriminated route (pickers/phase1/2/3/finish) → Tasks 1–3 ✓
- Read-only production-faithful context incl. `skill_assessment`/`determineTargetSkill` → Task 2 (mirrors `conversation/start`; `skill_assessment` fetched, `determineTargetSkill(work, assessments)`) ✓
- Engine called directly, never `api/conversation/*` → Tasks 2–3 + structural test asserts no `api/conversation/` reference ✓
- conversation-output included, production-faithful (empty `{}` rubrics) → Task 3 ✓
- ToolsView panel, DRY-RUN banner, transcript in React state only, reset → Task 4 ✓
- Error handling (404/400/403/502, no silent fallback) → Task 1 gate + Task 2 builder guards + route `catch` 502 ✓
- Zero-write invariant + test → Task 1 structural scan (every task re-runs it); behavioral+auth → Task 5 manual runbook (toolset-reality adaptation, documented) ✓
- Out-of-scope respected (no persistence/save/history; no engine or `api/conversation/*` changes; no new auth) ✓

**2. Placeholder scan:** No TBD/TODO-as-work. The literal `{}` rubric + its comment is a faithful replication of production (`next-phase` line 315), explicitly so — not a placeholder. The "read X and copy verbatim" steps (Task 2 Step 1 `snakeToCamel`/`getCurrentQuarter`; Task 4 Step 1 panel pattern) are precise instructions citing exact files/line-ranges, not vague.

**3. Type consistency:** `ConversationContext` imported from `@/lib/llm-prompts` and used consistently (Tasks 2–3). Engine signatures match the verified source: `generatePhase1Question(ctx)`, `generatePhase2Question(ctx,p1)`, `generatePhase3Question(ctx,p1,p2)`, `generateSynthesis(ctx,{p1,p2,p3})`, `suggestSkillTags(ctx,{p1,p2,p3},synthesisText)`, `generateConversationOutput({...}, {skillId}[], {}, prev[])`. `Body` discriminated-union step names (`pickers|phase1|phase2|phase3|finish`) are consistent across route and panel `call(...)` payloads. `buildValidatorContext` return contract (`{context}` | `{error,status}`) consistent across Tasks 2–3.

**Adaptation noted:** the spec's behavioral test "stub engine, assert counts unchanged" is realized as the Task 5 manual runbook instead of an automated stubbed test, because the codebase has no module-mocking framework and introducing one is unrequested scope creep; the automated structural scan is a stronger categorical zero-write guarantee and runs every task. This is a deliberate, documented plan-vs-toolset reconciliation, not a dropped requirement.
