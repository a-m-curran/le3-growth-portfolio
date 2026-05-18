# Conversation/Reflection v2 Enablement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing, v1-proven conversation/reflection loop usable from the v2 UI for every real student entry path (magic-link, D2L LTI, demo persona) without altering the D2L LTI integration contract.

**Architecture:** No new architecture. (1) Swap the identity resolver on 3 write routes from the v1 `supabase.auth.getUser()`+`student.auth_user_id` pattern to `getV2StudentId()` (a strict superset — `getV2Identity()`'s real-auth branch *is* `auth.getUser()→auth_user_id`, plus the demo-persona cookie). (2) Un-stub the v2 start surface so it POSTs the now-v2-aware start route and routes into the existing, working `/v2/conversation/[id]` flow. (3) Env-gate the *internal, post-handshake* redirect inside `api/lti/launch` (D2L-facing endpoints/handshake untouched).

**Tech Stack:** Next.js 14 App Router route handlers, `@/lib/v2-auth` (`getV2StudentId`), `@/lib/supabase-admin` (`createAdminClient`), existing `@/lib/conversation-engine-live` engine (unchanged), React client components, `tsx` structural source-scan tests via `scripts/_sync-test-harness.ts`.

**Spec:** `docs/superpowers/specs/2026-05-17-conversation-v2-enablement-design.md`

---

## Conventions (read before starting)

- **Run a test:** `npx tsx scripts/<name>.ts`. **Typecheck:** `npx tsc --noEmit` (exit 0).
- **Lint:** `npx next lint` is environmentally broken in this repo's worktrees (dual `@next/next` plugin). Use exactly: `npx eslint --no-eslintrc --config .eslintrc.json <files>` → expect exit 0, no warnings.
- One commit per task; message ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **Why structural tests + a manual DoD runbook (not route-execution tests):** route handlers cannot be exercised under `tsx` — `next/headers` `cookies()` throws "outside a request scope" with no Next runtime, so an in-process call returns 500 not the real status (false-green). This repo therefore has zero route-execution tests. The honest, codebase-consistent gate is a source-scan asserting the right shape, plus the **end-to-end DoD runbook** (Task 6) as the behavioral proof.
- **Load-bearing invariant:** the D2L-facing LTI surface (`/api/lti/login`, the `/api/lti/launch` handshake/JWT verify/provision, `/api/lti/jwks`, `/api/lti/deep-link`, `/api/lti/config`, `/api/lti/notice`, `redirect_uri`, env/client/deployment IDs) is **never modified**. Only ONE internal *post-handshake* redirect string inside `launch/route.ts` changes (Task 5), executed after D2L's involvement is complete.

## File structure

- **Create** `scripts/test-conversation-v2-enablement.ts` — structural source-scan test (grows over Tasks 1–5; pure scan, no DB/env).
- **Modify** `src/app/api/conversation/start/route.ts` — resolver swap + RLS-anon→admin data client (Task 2).
- **Modify** `src/app/api/reflect/start/route.ts` — resolver swap (already admin-for-data) (Task 1).
- **Modify** `src/app/api/conversation/[id]/tags/route.ts` — resolver swap + ownership→403 (Task 1).
- **Modify** `src/app/v2/(student)/reflect/start/page.tsx` — un-stub → real client start surface (Task 3).
- **Create** `src/app/v2/(student)/journal/V2ReflectComposer.tsx` — v2-native open-reflection composer (Task 4).
- **Modify** `src/app/v2/(student)/journal/JournalView.tsx` — use the v2 composer, not v1 `ReflectForm` (Task 4).
- **Modify** `src/app/api/lti/launch/route.ts` — env-gate the post-handshake redirect (Task 5).

---

## Task 1: Resolver swap on `reflect/start` + `[id]/tags` (already admin-for-data) + structural test

**Files:**
- Create: `scripts/test-conversation-v2-enablement.ts`
- Modify: `src/app/api/reflect/start/route.ts`
- Modify: `src/app/api/conversation/[id]/tags/route.ts`

- [ ] **Step 1: Write the failing structural test**

Create `scripts/test-conversation-v2-enablement.ts`. Pure source scan — it does NOT touch the DB or env, so it does NOT call `bootstrapTestEnv()` (only the assert helpers from the shared harness):

```ts
/**
 * Structural source-scan for the conversation/reflection v2 enablement.
 * Pure: reads source files, asserts the v2-identity shape. No DB/env.
 *
 * USAGE: npx tsx scripts/test-conversation-v2-enablement.ts
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertEqual, section, finish } from './_sync-test-harness'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

async function main(): Promise<void> {
  section('reflect/start + tags: v2 identity resolver (no v1 auth pattern)')
  for (const p of [
    'src/app/api/reflect/start/route.ts',
    'src/app/api/conversation/[id]/tags/route.ts',
  ]) {
    const code = stripComments(read(p))
    assertEqual(/getV2StudentId\s*\(/.test(code), true, `${p} calls getV2StudentId()`)
    assertEqual(
      /\.eq\(\s*['"]auth_user_id['"]\s*,\s*user\.id\s*\)/.test(code),
      false,
      `${p} no longer resolves student by auth_user_id+user.id`
    )
    assertEqual(
      /supabase\.auth\.getUser\s*\(/.test(code),
      false,
      `${p} no longer calls supabase.auth.getUser()`
    )
  }

  section('tags: ownership violation returns 403')
  {
    const code = read('src/app/api/conversation/[id]/tags/route.ts')
    assertEqual(/status:\s*403/.test(code), true, 'tags returns 403 on ownership violation')
  }

  // Tasks 2–5 append their sections here.

  finish()
}
main()
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-conversation-v2-enablement.ts`
Expected: FAIL — both routes still call `supabase.auth.getUser()` and resolve by `auth_user_id`+`user.id`; `getV2StudentId()` absent; tags has no `403`.

- [ ] **Step 3: Rewrite `src/app/api/reflect/start/route.ts`**

Replace the file with exactly:

```ts
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getV2StudentId } from '@/lib/v2-auth'
import { getClient } from '@/lib/llm-client'
import { PHASE_1_SYSTEM_PROMPT } from '@/lib/llm-prompts'
import { buildSkillLevelMap } from '@/lib/llm-prompts'
import type { SkillAssessment, SdtLevel } from '@/lib/types'

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = value
  }
  return result
}

function getCurrentQuarter(): string {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  if (month < 3) return `Winter ${year}`
  if (month < 6) return `Spring ${year}`
  if (month < 9) return `Summer ${year}`
  return `Fall ${year}`
}

function getCurrentWeek(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  return Math.ceil((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
}

/**
 * POST /api/reflect/start
 *
 * Open-ended reflection — no skill selection required. Identity resolves
 * via getV2Identity (real Supabase auth incl. LTI, OR demo persona).
 */
export async function POST(request: Request) {
  try {
    const studentId = await getV2StudentId()
    if (!studentId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { description } = await request.json()
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: studentRow } = await admin
      .from('student')
      .select('*')
      .eq('id', studentId)
      .single()

    if (!studentRow) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Get previous conversations for context
    const { data: prevConvos } = await admin
      .from('growth_conversation')
      .select('*')
      .eq('student_id', studentRow.id)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(5)

    // Get assessments for skill level context
    const { data: assessmentRows } = await admin
      .from('skill_assessment')
      .select('*')
      .eq('student_id', studentRow.id)
      .eq('assessor_type', 'coach')
      .order('assessed_at', { ascending: false })

    const assessments = (assessmentRows || []).map(
      (a: Record<string, unknown>) => snakeToCamel(a) as unknown as SkillAssessment
    )
    const skillLevels = buildSkillLevelMap(assessments)

    const lowestLevel = skillLevels.size > 0
      ? Array.from(skillLevels.entries()).sort(([,a], [,b]) => {
          const order: Record<string, number> = { external: 1, introjected: 2, identified: 3, integrated: 4, intrinsic: 5 }
          return (order[a] || 1) - (order[b] || 1)
        })[0]?.[1] || 'external'
      : 'external'

    const prevContext = (prevConvos || []).slice(0, 3).map((c: Record<string, unknown>) => {
      const insight = c.suggested_insight || ''
      const resp = (c.response_phase_1 as string || '').substring(0, 100)
      return `  - ${c.started_at}: "${insight}" Student said: "${resp}..."`
    }).join('\n')

    const userPrompt = [
      `STUDENT: ${studentRow.first_name} ${studentRow.last_name}`,
      `COHORT: ${studentRow.cohort}`,
      `CURRENT QUARTER: ${getCurrentQuarter()}`,
      '',
      'OPEN REFLECTION (student-initiated, not tied to any assignment):',
      `The student wants to reflect on something. Here’s what they wrote:`,
      `"${description}"`,
      '',
      `STUDENT'S GENERAL SDT LEVEL: ${lowestLevel as SdtLevel}`,
      '(Adjust question complexity accordingly. Do NOT mention any skill names.)',
      '',
      prevContext ? `PREVIOUS CONVERSATIONS:\n${prevContext}` : '',
      '',
      'Generate ONE question for Phase 1 (What Happened).',
      'The student has shared something on their mind. Help them tell the story.',
      'Be warm, curious, and specific to what they described.',
      'Do NOT ask them to categorize, label, or connect it to any framework.',
    ].join('\n').trim()

    const llm = getClient()
    const phase1Question = await llm.generate(PHASE_1_SYSTEM_PROMPT, userPrompt)

    const { data: conversation, error: createError } = await admin
      .from('growth_conversation')
      .insert({
        student_id: studentRow.id,
        work_id: null,
        quarter: getCurrentQuarter(),
        week_number: getCurrentWeek(),
        status: 'in_progress',
        conversation_type: 'open_reflection',
        reflection_description: description,
        work_context: `Reflection: ${description.substring(0, 80)}`,
        prompt_phase_1: phase1Question,
      })
      .select()
      .single()

    if (createError || !conversation) {
      console.error('Create reflection error:', createError)
      return NextResponse.json({ error: 'Failed to start reflection' }, { status: 500 })
    }

    return NextResponse.json({
      conversationId: conversation.id,
      firstPrompt: phase1Question,
      workContext: conversation.work_context,
    })
  } catch (error) {
    console.error('Reflect start error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Rewrite `src/app/api/conversation/[id]/tags/route.ts`**

Replace the file with exactly:

```ts
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getV2StudentId } from '@/lib/v2-auth'

/**
 * PUT /api/conversation/:id/tags
 *
 * Updates skill tags for a conversation. Identity resolves via
 * getV2Identity (real Supabase auth incl. LTI, OR demo persona).
 * A student may only modify tags on their own conversation.
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const studentId = await getV2StudentId()
    if (!studentId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { tags } = await request.json() as {
      tags: { skillId: string; confidence: number; studentConfirmed: boolean; rationale?: string }[]
    }

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json({ error: 'tags array is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: conversation } = await admin
      .from('growth_conversation')
      .select('id, student_id')
      .eq('id', params.id)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    if (conversation.student_id !== studentId) {
      return NextResponse.json({ error: 'Not your conversation' }, { status: 403 })
    }

    await admin
      .from('conversation_skill_tag')
      .delete()
      .eq('conversation_id', params.id)

    if (tags.length > 0) {
      await admin
        .from('conversation_skill_tag')
        .insert(
          tags.map(t => ({
            conversation_id: params.id,
            skill_id: t.skillId,
            confidence: t.confidence,
            student_confirmed: t.studentConfirmed,
            rationale: t.rationale || null,
          }))
        )
    }

    return NextResponse.json({ ok: true, tagCount: tags.length })
  } catch (error) {
    console.error('Tag update error:', error)
    return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-conversation-v2-enablement.ts`
Expected: PASS — `N passed, 0 failed`, exit 0.

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json src/app/api/reflect/start/route.ts src/app/api/conversation/[id]/tags/route.ts scripts/test-conversation-v2-enablement.ts` → no warnings

- [ ] **Step 7: Commit**

```bash
git add src/app/api/reflect/start/route.ts src/app/api/conversation/[id]/tags/route.ts scripts/test-conversation-v2-enablement.ts
git commit -m "$(cat <<'EOF'
api/reflect+tags: resolve identity via getV2StudentId (v2/LTI/demo)

Swaps the v1 auth.getUser()+auth_user_id gate for getV2StudentId (a
strict superset). tags now 403s on ownership violation. Structural
test asserts the shape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `conversation/start` — resolver swap + RLS-anon → admin data client

**Files:**
- Modify: `src/app/api/conversation/start/route.ts`
- Modify: `scripts/test-conversation-v2-enablement.ts`

Context: unlike the Task 1 routes, `conversation/start` uses the RLS **anon-cookie** client (`getSupabase()`) for *all* data ops, so it must move its data layer to `createAdminClient()` (a demo/v2-resolved identity has no RLS session) — the same gate+admin pattern `reflect/start` and `tags` already use. All queries stay scoped to the resolved `studentId`.

- [ ] **Step 1: Add the failing structural section**

In `scripts/test-conversation-v2-enablement.ts`, replace the line `  // Tasks 2–5 append their sections here.` with:

```ts
  section('conversation/start: v2 identity + admin data client')
  {
    const code = stripComments(read('src/app/api/conversation/start/route.ts'))
    assertEqual(/getV2StudentId\s*\(/.test(code), true, 'conversation/start calls getV2StudentId()')
    assertEqual(/createAdminClient\s*\(/.test(code), true, 'conversation/start uses createAdminClient()')
    assertEqual(
      /supabase\.auth\.getUser\s*\(/.test(code),
      false,
      'conversation/start no longer calls supabase.auth.getUser()'
    )
    assertEqual(
      /createServerClient\s*\(/.test(code),
      false,
      'conversation/start no longer creates the RLS anon client'
    )
  }

  // Tasks 3–5 append their sections here.
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-conversation-v2-enablement.ts`
Expected: FAIL — `conversation/start` still uses `createServerClient`/`supabase.auth.getUser()`, no `getV2StudentId`/`createAdminClient`.

- [ ] **Step 3: Rewrite `src/app/api/conversation/start/route.ts`**

Replace the file with exactly:

```ts
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getV2StudentId } from '@/lib/v2-auth'
import { generatePhase1Question } from '@/lib/conversation-engine-live'
import { determineTargetSkill, buildSkillLevelMap, type ConversationContext } from '@/lib/llm-prompts'
import { log } from '@/lib/observability/logger'
import type { StudentWork, SkillAssessment, GrowthConversation, Student } from '@/lib/types'

export async function POST(request: Request) {
  // One request_id at the edge so every event correlates.
  const reqLog = log.withRequest()
  let studentId: string | undefined

  try {
    const resolvedStudentId = await getV2StudentId()
    if (!resolvedStudentId) {
      await reqLog.warn('conversation.start_failed', {
        actorType: 'anonymous',
        message: 'Unauthenticated attempt to start conversation',
      })
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { workId } = await request.json()
    if (!workId) {
      await reqLog.warn('conversation.start_failed', {
        message: 'workId missing from request body',
      })
      return NextResponse.json({ error: 'workId is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: student, error: studentError } = await admin
      .from('student')
      .select('*')
      .eq('id', resolvedStudentId)
      .single()

    if (studentError || !student) {
      await reqLog.error('conversation.start_failed', {
        studentId: resolvedStudentId,
        message: 'Resolved identity has no student record',
        context: { workId, error: studentError?.message },
      })
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 })
    }

    studentId = student.id as string

    // Check for existing in-progress conversation — resume it
    const { data: existing } = await admin
      .from('growth_conversation')
      .select('*')
      .eq('student_id', student.id)
      .eq('status', 'in_progress')
      .limit(1)

    if (existing && existing.length > 0) {
      const conv = existing[0]
      let currentPhase = 1
      if (conv.response_phase_1 && conv.prompt_phase_2) currentPhase = 2
      if (conv.response_phase_2 && conv.prompt_phase_3) currentPhase = 3

      await reqLog.info('conversation.resumed', {
        studentId,
        actorType: 'student',
        actorId: studentId,
        message: `Resumed in-progress conversation at phase ${currentPhase}`,
        context: {
          conversation_id: conv.id,
          work_id: conv.work_id,
          current_phase: currentPhase,
        },
      })

      return NextResponse.json({
        conversationId: conv.id,
        resuming: true,
        currentPhase,
        workContext: conv.work_context,
        conversationType: conv.conversation_type || 'work_based',
        prompts: {
          phase1: conv.prompt_phase_1,
          phase2: conv.prompt_phase_2,
          phase3: conv.prompt_phase_3,
        },
        responses: {
          phase1: conv.response_phase_1,
          phase2: conv.response_phase_2,
          phase3: conv.response_phase_3,
        },
      })
    }

    const { data: work, error: workError } = await admin
      .from('student_work')
      .select('*')
      .eq('id', workId)
      .single()

    if (workError || !work) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }
    if (work.student_id !== student.id) {
      return NextResponse.json({ error: 'Not your work item' }, { status: 403 })
    }

    const [prevConvosResult, definitionsResult, assessmentsResult] = await Promise.all([
      admin
        .from('growth_conversation')
        .select('*, student_work(*)')
        .eq('student_id', student.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(10),
      admin
        .from('student_skill_definition')
        .select('*')
        .eq('student_id', student.id)
        .eq('is_current', true),
      admin
        .from('skill_assessment')
        .select('*')
        .eq('student_id', student.id)
        .eq('assessor_type', 'coach')
        .order('assessed_at', { ascending: false }),
    ])

    const previousConversations = (prevConvosResult.data || []).map((c: Record<string, unknown>) => ({
      ...snakeToCamel(c) as unknown as GrowthConversation,
      work: c.student_work ? snakeToCamel(c.student_work as Record<string, unknown>) as unknown as StudentWork : null,
    }))

    const assessments = (assessmentsResult.data || []).map(
      (a: Record<string, unknown>) => snakeToCamel(a) as unknown as SkillAssessment
    )

    const targetSkillId = determineTargetSkill(
      snakeToCamel(work) as unknown as StudentWork,
      assessments
    )
    const skillLevels = buildSkillLevelMap(assessments)

    const context = {
      student: snakeToCamel(student) as unknown as Student,
      work: snakeToCamel(work) as unknown as StudentWork,
      conversation: {},
      previousConversations,
      currentDefinitions: (definitionsResult.data || []).map(
        (d: Record<string, unknown>) => snakeToCamel(d)
      ) as unknown as ConversationContext['currentDefinitions'],
      skillLevels,
      targetSkillId,
      targetSkillLevel: skillLevels.get(targetSkillId) || 'external' as const,
      quarter: getCurrentQuarter(),
    }

    const phase1Question = await generatePhase1Question(context)

    const { data: conversation, error: createError } = await admin
      .from('growth_conversation')
      .insert({
        student_id: student.id,
        work_id: workId,
        quarter: getCurrentQuarter(),
        week_number: getCurrentWeek(),
        status: 'in_progress',
        work_context: `${work.title} - ${work.description || work.work_type}`,
        prompt_phase_1: phase1Question,
      })
      .select()
      .single()

    if (createError || !conversation) {
      await reqLog.error('conversation.start_failed', {
        studentId,
        message: 'growth_conversation insert failed',
        context: { work_id: workId, db_error: createError?.message },
      })
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    await reqLog.info('conversation.started', {
      studentId,
      actorType: 'student',
      actorId: studentId,
      message: `New conversation started for work ${work.title}`,
      context: {
        conversation_id: conversation.id,
        work_id: workId,
        work_title: work.title,
        target_skill_id: targetSkillId,
        target_skill_level: skillLevels.get(targetSkillId) || 'external',
      },
    })

    return NextResponse.json({
      conversationId: conversation.id,
      firstPrompt: phase1Question,
      workContext: conversation.work_context,
    })
  } catch (error) {
    await reqLog.error('conversation.start_failed', {
      studentId,
      message: 'Unexpected exception in conversation start',
      context: {
        error_message: String(error),
        error_stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
      },
    })
    return NextResponse.json(
      { error: 'Failed to start conversation. Please try again.' },
      { status: 500 }
    )
  }
}

function getCurrentQuarter(): string {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  if (month < 3) return `Winter ${year}`
  if (month < 6) return `Spring ${year}`
  if (month < 9) return `Summer ${year}`
  return `Fall ${year}`
}

function getCurrentWeek(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - start.getTime()
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
}

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = value
  }
  return result
}
```

Note: this adds a `work.student_id !== student.id → 403` ownership check (the v1 route relied on RLS for that; with the admin client we enforce it explicitly — a student may only start a conversation on their own work).

- [ ] **Step 4: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-conversation-v2-enablement.ts`
Expected: PASS — all sections green.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json src/app/api/conversation/start/route.ts scripts/test-conversation-v2-enablement.ts` → no warnings

- [ ] **Step 6: Commit**

```bash
git add src/app/api/conversation/start/route.ts scripts/test-conversation-v2-enablement.ts
git commit -m "$(cat <<'EOF'
api/conversation/start: getV2StudentId + admin data client

Moves off the RLS anon client (which a demo/v2 identity can't use) to
the gate+admin pattern reflect/start & tags already use; resolves via
getV2StudentId; adds an explicit own-work 403 (RLS previously enforced).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Un-stub the v2 start surface

**Files:**
- Modify: `src/app/v2/(student)/reflect/start/page.tsx`
- Modify: `scripts/test-conversation-v2-enablement.ts`

The v2 entry points pass `?work=<student_work id>` (`TodayView.tsx:141`, `ReflectView.tsx:146`). The LTI-pinned card passes `?lti=<resourceLinkId>`; resolving a resourceLinkId → a `student_work` row does not exist anywhere yet and is **explicitly out of scope** (the spec's LTI landing is `/v2/today`, where the student picks their work from `featuredWork` → `?work=`). So this page handles `?work=` fully and degrades gracefully (link to `/v2/today`) for missing/`?lti=`-only.

- [ ] **Step 1: Add the failing structural section**

In `scripts/test-conversation-v2-enablement.ts`, replace `  // Tasks 3–5 append their sections here.` with:

```ts
  section('v2 reflect/start: real surface (no longer the stub)')
  {
    const code = read('src/app/v2/(student)/reflect/start/page.tsx')
    assertEqual(/'use client'/.test(code), true, 'reflect/start is a client component')
    assertEqual(
      /\/api\/conversation\/start/.test(code),
      true,
      'reflect/start POSTs /api/conversation/start'
    )
    assertEqual(
      /\/v2\/conversation\//.test(code),
      true,
      'reflect/start routes into /v2/conversation/[id]'
    )
    assertEqual(
      /still being built/.test(code),
      false,
      'the v2 IA "still being built" stub copy is gone'
    )
  }

  // Tasks 4–5 append their sections here.
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-conversation-v2-enablement.ts`
Expected: FAIL — the page is still the static stub (`'still being built'`, no client/fetch/route).

- [ ] **Step 3: Replace `src/app/v2/(student)/reflect/start/page.tsx`**

Replace the file with exactly:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

/**
 * /v2/reflect/start?work=<student_work id>
 *
 * Real v2 entry: create (or resume) the conversation for the chosen
 * work via /api/conversation/start (now v2-identity-aware), then route
 * into the existing /v2/conversation/[id] flow.
 *
 * The LTI-pinned card passes ?lti=<resourceLinkId>; mapping that to a
 * work row is out of scope (spec) — LTI students land on /v2/today and
 * start via their featured work (?work=). Missing/lti-only degrades to
 * a clear link back to Today.
 */
export default function V2ReflectStartPage() {
  const router = useRouter()
  const params = useSearchParams()
  const workId = params.get('work')
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!workId || started.current) return
    started.current = true
    ;(async () => {
      try {
        const res = await fetch('/api/conversation/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workId }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || `Couldn't start (HTTP ${res.status})`)
          return
        }
        router.replace(`/v2/conversation/${data.conversationId}`)
      } catch {
        setError('Failed to connect. Please try again.')
      }
    })()
  }, [workId, router])

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-8">
        {!workId ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Start a reflection</h1>
            <p className="text-sm text-gray-600 mb-6">
              Pick a piece of work from your Today view to start a guided
              reflection on it.
            </p>
            <Link
              href="/v2/today"
              className="inline-block px-4 py-3 rounded-lg bg-green-50 border border-green-200 hover:border-green-400 hover:bg-white transition-colors text-sm font-semibold text-green-900"
            >
              Go to Today →
            </Link>
          </>
        ) : error ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Couldn&rsquo;t start the reflection
            </h1>
            <p className="text-sm text-red-700 mb-6">{error}</p>
            <Link
              href="/v2/today"
              className="inline-block px-4 py-3 rounded-lg bg-white border border-gray-200 hover:border-gray-400 transition-colors text-sm font-semibold text-gray-900"
            >
              ← Back to Today
            </Link>
          </>
        ) : (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="h-4 w-4 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
            Starting your reflection…
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-conversation-v2-enablement.ts`
Expected: PASS — all sections green.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json "src/app/v2/(student)/reflect/start/page.tsx" scripts/test-conversation-v2-enablement.ts` → no warnings

- [ ] **Step 6: Commit**

```bash
git add "src/app/v2/(student)/reflect/start/page.tsx" scripts/test-conversation-v2-enablement.ts
git commit -m "$(cat <<'EOF'
v2 reflect/start: real start surface (work-based) into /v2/conversation

Un-stubs the page: ?work=<id> POSTs the now-v2-aware
/api/conversation/start and routes into the existing
/v2/conversation/[id] flow. Missing/lti-only degrades to a Today link.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: v2-native open-reflection composer (Journal stops bouncing to v1)

**Files:**
- Create: `src/app/v2/(student)/journal/V2ReflectComposer.tsx`
- Modify: `src/app/v2/(student)/journal/JournalView.tsx`
- Modify: `scripts/test-conversation-v2-enablement.ts`

`JournalView.tsx:7` imports v1 `ReflectForm` (`@/app/reflect/ReflectForm`) and renders it at line 65; v1 `ReflectForm` routes to `/conversation/{id}` (v1 — bounces out of v2). Create a v2 twin that routes to `/v2/conversation/{id}`; swap the import/usage. v1 `ReflectForm` is left untouched (v1 still works).

- [ ] **Step 1: Add the failing structural section**

In `scripts/test-conversation-v2-enablement.ts`, replace `  // Tasks 4–5 append their sections here.` with:

```ts
  section('v2 Journal: v2-native composer, no v1 ReflectForm bounce')
  {
    const jv = read('src/app/v2/(student)/journal/JournalView.tsx')
    assertEqual(
      /@\/app\/reflect\/ReflectForm/.test(jv),
      false,
      'JournalView no longer imports the v1 ReflectForm'
    )
    assertEqual(
      /V2ReflectComposer/.test(jv),
      true,
      'JournalView uses V2ReflectComposer'
    )
    const comp = read('src/app/v2/(student)/journal/V2ReflectComposer.tsx')
    assertEqual(/\/api\/reflect\/start/.test(comp), true, 'composer POSTs /api/reflect/start')
    assertEqual(/\/v2\/conversation\//.test(comp), true, 'composer routes into /v2/conversation/[id]')
  }

  // Task 5 appends its section here.
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-conversation-v2-enablement.ts`
Expected: FAIL — `V2ReflectComposer` does not exist; JournalView still imports v1 `ReflectForm`.

- [ ] **Step 3: Create `src/app/v2/(student)/journal/V2ReflectComposer.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * v2-native open-reflection composer. Mirrors v1 ReflectForm but routes
 * into the v2 conversation flow (and /api/reflect/start now resolves a
 * v2/demo/LTI identity), so demo personas no longer bounce into v1.
 */
export function V2ReflectComposer() {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/reflect/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }
      router.push(`/v2/conversation/${data.conversationId}`)
    } catch {
      setError('Failed to connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={4}
        placeholder="What's been on your mind? Describe something that happened — at school, work, home, anywhere. It doesn't have to be about an assignment."
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none bg-white placeholder:text-gray-400"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !description.trim()}
        className="w-full py-3 bg-green-700 text-white rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Starting...' : 'Let’s talk about it'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Update `src/app/v2/(student)/journal/JournalView.tsx`**

Change the import on line 7 from:

```tsx
import { ReflectForm } from '@/app/reflect/ReflectForm'
```

to:

```tsx
import { V2ReflectComposer } from './V2ReflectComposer'
```

And change the render (line ~65) from:

```tsx
        <ReflectForm />
```

to:

```tsx
        <V2ReflectComposer />
```

(Use Read to confirm the exact current lines, then Edit those two exact strings — change nothing else in `JournalView.tsx`.)

- [ ] **Step 5: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-conversation-v2-enablement.ts`
Expected: PASS — all sections green.

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json "src/app/v2/(student)/journal/V2ReflectComposer.tsx" "src/app/v2/(student)/journal/JournalView.tsx" scripts/test-conversation-v2-enablement.ts` → no warnings

- [ ] **Step 7: Commit**

```bash
git add "src/app/v2/(student)/journal/V2ReflectComposer.tsx" "src/app/v2/(student)/journal/JournalView.tsx" scripts/test-conversation-v2-enablement.ts
git commit -m "$(cat <<'EOF'
v2 Journal: v2-native open-reflection composer (no v1 bounce)

Replaces the embedded v1 ReflectForm (which routed to v1 /conversation
and broke demo personas) with a v2 twin routing into
/v2/conversation/[id]. v1 ReflectForm left untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Env-gate the LTI post-handshake redirect (NO D2L-facing change)

**Files:**
- Modify: `src/app/api/lti/launch/route.ts`
- Modify: `scripts/test-conversation-v2-enablement.ts`

Only the *internal* redirect targets change, executed *after* JWT verify + session mint. `redirectWithSession(...)`, the JWT/handshake, provisioning, and the `lti_context` cookie (which v2 `/v2/today` consumes) are **untouched**. v2 `/v2/today` reads the `lti_context` cookie for the pin, so the `?lti_resource=` query param (a v1 mechanism) is dropped.

- [ ] **Step 1: Add the failing structural section**

In `scripts/test-conversation-v2-enablement.ts`, replace `  // Task 5 appends its section here.` with:

```ts
  section('lti/launch: env-gated internal redirect; handshake untouched')
  {
    const raw = read('src/app/api/lti/launch/route.ts')
    const code = stripComments(raw)
    assertEqual(
      /LTI_POST_LAUNCH_STUDENT_PATH/.test(code) && /LTI_POST_LAUNCH_INSTRUCTOR_PATH/.test(code),
      true,
      'both LTI post-launch path env vars are used'
    )
    assertEqual(
      /['"]\/conversation\?lti_resource=/.test(code),
      false,
      'old hardcoded v1 student redirect is gone'
    )
    assertEqual(
      /redirectWithSession\(\s*\n?\s*admin,\s*\n?\s*email,\s*\n?\s*['"]\/coach['"]/.test(code),
      false,
      'old hardcoded /coach instructor redirect is gone'
    )
    // D2L-facing handshake must remain intact (no integration change).
    assertEqual(/verifyPlatformJwt\s*\(/.test(code), true, 'JWT verification still present')
    assertEqual(/redirectWithSession\s*\(/.test(code), true, 'session mint/redirect still present')
    assertEqual(/lti_context/.test(code), true, 'lti_context cookie still set (v2 Today consumes it)')
  }

  finish()
```

(Delete the now-duplicate trailing `finish()` that previously followed this marker so `finish()` is called exactly once.)

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-conversation-v2-enablement.ts`
Expected: FAIL — env vars absent; old `/conversation?lti_resource=` and `/coach` redirects still present.

- [ ] **Step 3: Edit `src/app/api/lti/launch/route.ts`**

3a. Add two module-level constants near the top of the file, immediately after the import block (use Read to find the exact end of imports; insert these on their own lines before the first non-import statement):

```ts
// Internal post-handshake redirect targets (D2L never sees these — set
// after the LTI handshake completes). Env-gated for per-environment
// reversibility and the eventual internal-NLU migration.
const LTI_STUDENT_PATH = process.env.LTI_POST_LAUNCH_STUDENT_PATH || '/v2/today'
const LTI_INSTRUCTOR_PATH = process.env.LTI_POST_LAUNCH_INSTRUCTOR_PATH || '/v2/coach'
```

3b. The instructor redirect appears **twice** (currently `return redirectWithSession(admin, email, '/coach', req.nextUrl.origin)`). Replace **both** occurrences of the exact string `'/coach', req.nextUrl.origin` with `LTI_INSTRUCTOR_PATH, req.nextUrl.origin` (use Edit with `replace_all: true` on the exact fragment `redirectWithSession(admin, email, '/coach', req.nextUrl.origin)` → `redirectWithSession(admin, email, LTI_INSTRUCTOR_PATH, req.nextUrl.origin)`).

3c. Replace the student redirect-path block. Find exactly:

```ts
    // Store the LTI resource link in a cookie so /conversation can
    // feature it at the top of the hub
    const redirectPath = resourceLink?.id
      ? `/conversation?lti_resource=${encodeURIComponent(resourceLink.id)}`
      : '/garden'
```

Replace it with exactly:

```ts
    // v2 Today reads the lti_context cookie (set below) to pin the
    // launched resource — no query param needed. This is an internal
    // post-handshake redirect; D2L is not involved past this point.
    const redirectPath = LTI_STUDENT_PATH
```

Change nothing else in the file — the JWT verify, provisioning, `redirectWithSession`, the `lti_context` cookie set, and state/nonce cleanup all stay exactly as-is.

- [ ] **Step 4: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-conversation-v2-enablement.ts`
Expected: PASS — all sections green, `N passed, 0 failed`, exit 0.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json src/app/api/lti/launch/route.ts scripts/test-conversation-v2-enablement.ts` → no warnings

- [ ] **Step 6: Commit**

```bash
git add src/app/api/lti/launch/route.ts scripts/test-conversation-v2-enablement.ts
git commit -m "$(cat <<'EOF'
lti/launch: env-gate the internal post-handshake redirect to v2

Student → LTI_POST_LAUNCH_STUDENT_PATH (default /v2/today; lti_context
cookie still pins the resource). Instructor → LTI_POST_LAUNCH_INSTRUCTOR_
PATH (default /v2/coach). D2L-facing handshake/JWT/provisioning/cookie
unchanged — verified structurally.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification + end-to-end DoD runbook

**Files:** none (verification only).

- [ ] **Step 1: Full automated sweep** — run, expect all green:
  - `npx tsc --noEmit` → exit 0
  - `npx eslint --no-eslintrc --config .eslintrc.json src/app/api/conversation/start/route.ts src/app/api/reflect/start/route.ts "src/app/api/conversation/[id]/tags/route.ts" "src/app/v2/(student)/reflect/start/page.tsx" "src/app/v2/(student)/journal/V2ReflectComposer.tsx" "src/app/v2/(student)/journal/JournalView.tsx" src/app/api/lti/launch/route.ts scripts/test-conversation-v2-enablement.ts` → no warnings
  - `npx tsx scripts/test-conversation-v2-enablement.ts` → all sections pass

- [ ] **Step 2: End-to-end DoD runbook (the behavioral proof — document results in the Step 3 commit message).**

Structural scans prove shape; this proves the loop. Perform against the running app (a demo persona is the safe vehicle — `is_demo=true`, filterable):

1. Snapshot: `SELECT count(*) FROM conversation_output;` (baseline; this table has historically been empty).
2. Enter v2 as a demo student persona (the existing `/api/v2/demo-as` path / demo cookie). Go to `/v2/today`, pick a `featuredWork` item (routes `/v2/reflect/start?work=<id>`).
3. Confirm it lands in `/v2/conversation/<id>` and shows the Phase-1 question (not the old stub, not a v1 bounce, no 401).
4. Complete Phase 1 → 2 → 3 → synthesis; confirm/edit a skill tag at synthesis (exercises `PUT /api/conversation/[id]/tags` → expect 200, not 401).
5. Finish. Then: `SELECT count(*) FROM conversation_output;` → **strictly greater than the baseline** (the finish→`conversation_output` path, never previously exercised in prod, now produces a row). Also `SELECT status FROM growth_conversation WHERE id='<id>';` → `completed`.
6. Open-reflection path: `/v2/journal` → composer → submit a description → confirm it lands in `/v2/conversation/<id>` (v2, not v1 `/conversation`).
7. **No v1 regression:** as a real magic-link-authenticated student (non-demo), v1 `/conversation` still starts/resolves normally (the resolver swap is a strict superset — this must still work).
8. (If an LTI test launch is available) launch as a student → lands on `/v2/today` with the pinned card; launch as instructor → lands on `/v2/coach`. The D2L handshake itself is unchanged.

- [ ] **Step 3: Commit the verification record**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
conversation-v2-enablement: verification record

Automated: tsc 0, eslint clean, structural test all green. Manual DoD
runbook executed: demo persona drove a full v2 conversation
start→finish; conversation_output count increased (finish path proven);
tags PUT 200 under v2 identity; open-reflection stays in v2; v1
/conversation still works for a real authed student; LTI launch lands
student /v2/today + instructor /v2/coach with handshake unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- Replace v1 auth with `getV2StudentId()` on the 3 write routes, preserve per-student ownership (401 unresolved / 403 ownership), no silent fallback → Tasks 1–2 (reflect/start, tags, conversation/start; 401 + explicit 403 own-work / own-conversation) ✓
- Un-stub v2 start surface → real start into existing `/v2/conversation/[id]` → Task 3 ✓
- JournalView open-reflection stays in v2 → Task 4 (v2 composer; v1 ReflectForm untouched) ✓
- Env-gate the internal post-handshake LTI redirect; **no D2L-facing change** → Task 5 (env vars + structural assertions that JWT verify / `redirectWithSession` / `lti_context` remain) ✓
- DoD = full v2 conversation end-to-end producing a `conversation_output` row → Task 6 runbook ✓
- Out of scope respected: next-phase authz untouched; rubric `{}` TODO untouched; no migration for `demo_slug`/`is_demo`; the `?lti=`→work resolution explicitly deferred (spec landing is `/v2/today`, start via `?work=`) ✓
- Integration-safety guarantee enforced mechanically (Task 5 structural assertions) ✓

**2. Placeholder scan:** No TBD/"handle later"/vague steps. Every code step has complete file contents or the exact before/after string. The one "use Read to confirm exact lines" instruction (Task 4 Step 4, Task 5 Step 3) is a precise edit-location instruction with the exact strings given — not a placeholder.

**3. Type consistency:** `getV2StudentId(): Promise<string|null>` used identically in Tasks 1–2. `createAdminClient()` used consistently. Route response shapes (`{conversationId, firstPrompt, workContext}` / resume shape) unchanged from the originals, so the existing `/v2/conversation/[id]` `ConversationView` (fetches `/api/conversations/[id]`, unchanged) consumes them as before. Structural test helper names (`assertEqual`, `section`, `finish`, `stripComments`, `read`) consistent across all tasks; the test file uses `_sync-test-harness` without `bootstrapTestEnv` (pure scan, no DB/env — correct, and explicitly noted). `LTI_POST_LAUNCH_STUDENT_PATH` / `LTI_POST_LAUNCH_INSTRUCTOR_PATH` consistent between Task 5 code and its assertions. `finish()` is called exactly once (Task 5 Step 1 explicitly removes the prior trailing call).
