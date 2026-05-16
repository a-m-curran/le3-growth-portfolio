# Conversation Validator (Dry-Run) — Design Spec

**Date:** 2026-05-16
**Status:** Approved (design); pending implementation plan
**Owner:** Andrew Curran

## Problem / Goal

After the LE3 fan-out backfill, real students now have real synced
assignments (`student_work`, `source='d2l_valence_sync'`). Before relying
on the reflection/conversation engine in production, the admin wants to
**manually validate it end-to-end against a real assignment** — pick a
real student + a real assignment, play the student through the full
Phase 1 → 2 → 3 → synthesis → skill-tags loop, and eyeball question
quality and chain behavior.

**Hard constraint:** this is a private validation aid. It must write
**nothing** to the DB and must **never be associated with the chosen
student** (no `growth_conversation`, no `conversation_output`, no rows
referencing the student/work). It is ephemeral and for the admin only.

## Settled decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Access gate | Reuse the existing `isAdminEmail(identity.email)` + `role === 'coach'` ADMIN_EMAILS check the tools page already enforces. Re-enforced **server-side** in the new route (never trust the client panel). |
| Step-through mode | Fully interactive — the admin types each student response; engine generates each phase from the real assignment. |
| Architecture | **Approach A** — stateless ephemeral route that calls the engine functions directly (never the persisting `api/conversation/*` routes); client holds the in-progress transcript. Zero-write by construction. |
| Conversation-output block | **Included** in the "finish" output (key_moments/voice markers — what narratives/career consume; validates the full chain). |

Approach B (a `dryRun` flag on the real `api/conversation/*` routes) was
rejected: it puts a conditional around persistence *in the real write
path* — exactly the risk this constraint exists to avoid. Approach C
(server-side session store) was rejected: needless infra; Vercel
serverless has no cross-invocation memory.

## Architecture

The conversation engine (`src/lib/conversation-engine-live.ts`) exposes
pure functions — `generatePhase1Question`, `generatePhase2Question`,
`generatePhase3Question`, `generateSynthesis`, `suggestSkillTags`,
`generateConversationOutput` — that take a `ConversationContext`, call
the LLM, and return results. They persist nothing; all DB writes live in
the `api/conversation/*` routes. The validator calls the engine functions
**directly** and skips those routes entirely → zero-write by construction.

### Component 1 — `POST /api/admin/validate-conversation` (new)

Stateless, step-discriminated, server-side admin-gated. Body:

- `{ step: 'pickers' }` → `{ students: [{id, name, cohort}] }` — real
  students (`is_demo=false`) that have ≥1 synced `student_work`.
- `{ step: 'pickers', studentId }` → `{ assignments: [{id, title, courseName, submittedAt}] }`
  — that student's `student_work` rows where `source='d2l_valence_sync'`.
- `{ step: 'phase1', studentId, workId }` → `{ question, contextEcho }`
  (`contextEcho` = assignment title + content snippet + chosen skill, so
  the admin can see it wired to real data).
- `{ step: 'phase2', studentId, workId, phase1Response }` → `{ question }`.
- `{ step: 'phase3', studentId, workId, phase1Response, phase2Response }` → `{ question }`.
- `{ step: 'finish', studentId, workId, phase1Response, phase2Response, phase3Response }`
  → `{ synthesis, skillTags, conversationOutput }`.

Auth: resolve identity via the **same identity helper
`src/app/v2/(coach)/coach/tools/page.tsx` already uses** (it computes an
`identity` with `.role`/`.email`); require
`identity.role === 'coach' && isAdminEmail(identity.email)` → else `403`.
The route performs **only `.select(...)`** Supabase calls. No
`.insert`/`.update`/`.upsert`/`.delete` anywhere — load-bearing invariant.

### Component 2 — read-only context builder

A helper (private to the route, or a small `buildValidatorContext`
function) that, per call, SELECTs and assembles a real
`ConversationContext`:

- `student` row by `studentId` — must exist and be `is_demo=false`.
- `student_work` row by `workId` — must exist, belong to `studentId`,
  and have `source='d2l_valence_sync'` (title/description/content/course).
- The student's current `student_skill_definition` rows.
- The student's `skill_assessment` rows (needed by `determineTargetSkill`
  and for SDT-level prompt context — all read-only).
- Recent `growth_conversation` history for this student (so Phase 3's
  cross-conversation continuity prompt behaves exactly as in production).
- Target skill via the engine's existing
  `determineTargetSkill(work, assessments)` heuristic (so the dry-run
  picks a skill the same way production does), using the real
  `skill_assessment` rows above.

All SELECTs. Zero writes. Builds the same `ConversationContext` shape the
`buildPhase1Context`/`buildPhase2Context`/etc. prompt builders expect.

### Component 3 — ToolsView panel (new component)

A new panel rendered inside `src/app/v2/(coach)/coach/tools/ToolsView.tsx`,
"**Conversation Validator — DRY RUN**", with a loud, persistent banner:
"Ephemeral — nothing is saved and nothing is associated with any student."

UX flow: Student `<select>` → on choose, Assignment `<select>` (that
student's synced work) → "Start" → a stepper that, per phase, shows the
engine's generated question + a collapsible "what the engine saw"
(assignment snippet + chosen skill) + a `<textarea>` for the admin's
student-response + "Submit". After Phase 3 → "Finish" renders Synthesis,
suggested Skill Tags, and the conversation-output (key_moments / voice
markers). Transcript lives in React component state **only** (no
localStorage, no server state). "Reset / new run" clears it; closing the
tab discards it — correct for ephemeral.

The page-level gate at `src/app/v2/(coach)/coach/tools/page.tsx` already
restricts the whole Tools surface to admins; the panel adds no separate
gate (defense-in-depth lives in the route).

## Data flow

```
admin → Tools page (already ADMIN_EMAILS-gated)
      → Validator panel: pick student → pick assignment → Start
panel → POST /api/admin/validate-conversation {step:'phase1',studentId,workId}
route : assert admin → buildValidatorContext (READ-ONLY selects)
      → generatePhase1Question(ctx) → return {question, contextEcho}
panel : admin types response (plays student) → holds transcript in state
      → POST {step:'phase2', …, phase1Response}  (server rebuilds ctx read-only)
      → … phase3 …
      → POST {step:'finish', …all responses}
route : generateSynthesis + suggestSkillTags + generateConversationOutput
      → return; panel renders. NOTHING written at any step.
```

## Error handling

- Missing/invalid `studentId` or `workId`, work not owned by the student,
  `is_demo=true` student, or work not `source='d2l_valence_sync'` → `400`
  / `404` with a clear message (no silent fallback).
- Engine/LLM throw → `{ error: "engine error at <step>: <message>" }`
  with a non-2xx status; the panel surfaces it; no retry storm; nothing
  persisted (the route has no write path).
- Non-admin (or unauthenticated) → `403`.

## Testing

`scripts/test-validate-conversation.ts` (established tsx + mock-valence
convention — copy scaffold from the existing sync test scripts):

1. **Structural invariant:** assert the route module source contains
   zero `.insert(` / `.update(` / `.upsert(` / `.delete(` occurrences
   (string scan of `src/app/api/admin/validate-conversation/route.ts`).
2. **Behavioral invariant:** stub the engine functions (canned strings —
   this test guards *safety/zero-write*, not LLM quality, so it stays
   fast and deterministic). For a real `is_demo=false` student with a
   synced `student_work`: snapshot `growth_conversation` and
   `conversation_output` row counts (filtered to that student); drive a
   full `phase1 → phase2 → phase3 → finish` walkthrough by invoking the
   route handler **in-process** (imported and called directly with
   constructed `Request` objects — no running Next server, mirroring how
   the existing `scripts/test-sync-*.ts` call engine code directly);
   assert the counts are **identical** afterward and that no new row
   references the student or work id.
3. **Auth:** a non-admin identity → `403`; an admin identity → allowed.

Manual question-quality judgment is the admin's job (the entire point of
the tool); automated tests guarantee only that it can never write.

## Rollout

No DB schema change, no new dependencies. New files: the route + its
read-only context helper + the ToolsView panel component + the test
script. `ToolsView.tsx` gets one new panel mounted. Deploy is the normal
path (git push → Vercel); the tool is inert until an admin opens the
Tools page and uses it, and it is incapable of writing regardless.

## Out of scope / non-goals (YAGNI)

- No persistence of any kind; no "save"/"promote to real conversation";
  no validation-run history; no localStorage.
- No new auth mechanism (reuse `isAdminEmail`); no per-tool allowlist.
- No changes to the real `api/conversation/*` routes or the engine
  functions (consumed as-is).
- Not a load/perf tool; single-user, one walkthrough at a time.
- No automated assertion on LLM output quality (subjective; manual).
