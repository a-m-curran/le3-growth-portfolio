# Spec B — Student-Owned Skill Detail

**Date:** 2026-05-28
**Status:** Design approved, pending spec review
**Scope:** Restore + extend the student's skill-detail surface (the SkillPanel off the Growth grid). Second of a two-spec sequence (Spec A = inline guidance + recent submissions, shipped in PR #28).

## Goal

Give students back ownership of their skills in two connected ways, both landing in the existing `SkillPanel` (the side modal opened from a Growth-grid skill card):

1. **Item 4 — Skill definition editor:** let students write and revise their own definition of each skill (what it means to me / a time it showed up / why it matters). The backend already *reads* these definitions to personalize reflection, conversation, and narrative generation — only the create/edit UI was lost in the v2 migration. Restore it inline, plus a gentle nudge on the Growth grid for skills not yet defined.
2. **Item 3 — "Work to reflect on":** within a skill's panel, surface the student's submissions that are tagged with that skill (via `work_skill_tag`, auto-tagged at sync) but have **no reflection yet** — clicking one starts a reflection. Closes the loop from "this skill" to "work that exercises it but you haven't talked about."

No schema changes — `student_skill_definition` and `work_skill_tag` both already exist with the needed columns and RLS.

## Background (what already exists)

- **`student_skill_definition`** (migration 001): `definition_text` (not null), `personal_example`, `why_it_matters`, `version`, `is_current`, `prompted_by` (enum: `initial_onboarding`/`quarterly_revision`/`conversation_prompted`/`self_initiated`), `created_at`. RLS: students CRUD own; coaches read. **Read** by `reflection/start`, `conversation/start`, `conversation/[id]/next-phase`, `narrative/generate`, `lib/queries.ts`. **No write endpoint exists** — must be created.
- **`work_skill_tag`** (migration 005): `work_id`, `skill_id`, `confidence`, `rationale`, `source` (`llm_auto`/`student_manual`/`coach_manual`). Populated at sync time by `autoTagWork()` (`conversation-engine-live.ts`) → `sync-course.ts`. RLS: students see own.
- **`getGardenData(studentId)`** (`lib/queries.ts:132`) builds `GardenData { plants: GardenPlant[] }`. Each `GardenPlant` already carries `currentDefinition`, `previousDefinition`, `definitionRevised`, and conversations. The Growth page is a server component; data is fetched once and passed to `<GrowthGrid>` → `<SkillPanel plant=...>`.
- **`SkillPanel`** (`src/components/panels/SkillPanel.tsx`) already renders the definition read-only ("Earlier → Current" or "No definition on file yet.") and the conversations list.
- **Shared surface:** `GrowthGrid` (and thus `SkillPanel`) is rendered by the **student** Growth tab (`GrowthView.tsx`), the **coach** `StudentDetailView.tsx`, and the legacy `garden/GardenClient.tsx`.

## Item 4 — Skill definition editor

### Entry points
- **Inline (primary):** in `SkillPanel`, when `editable`, the definition section gains an "Edit" affordance (or "Define this skill" when none exists) that opens an editor form.
- **Nudge (secondary):** on the student Growth grid, a small card surfacing skills with no current definition ("N skills still need your words"); clicking a skill opens its panel. Only rendered on the student path (`editable`).

### Editor
- Three fields: **definition** (`definition_text`, required, non-empty), **a time it showed up** (`personal_example`, optional), **why it matters to me** (`why_it_matters`, optional).
- Warm field labels/placeholders matching the tool's voice (exact copy finalized in the plan).
- Save → `POST /api/student/skill-definition`; on success close the editor and `router.refresh()` so the panel reflects the new version.
- Cancel discards.

### Endpoint: `POST /api/student/skill-definition`
- `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.
- Auth: `getV2Identity()`; require `role === 'student'` (403 otherwise). Use the resolved student id — **never** trust a student id from the body.
- Body: `{ skillId: string, definitionText: string, personalExample?: string | null, whyItMatters?: string | null }`.
- Validate `definitionText.trim().length > 0` (400 otherwise) and that `skillId` is a real `durable_skill` (400 otherwise).
- Write (admin client): in a best-effort sequence — demote the current row (`update ... set is_current=false where student_id=me and skill_id=skillId and is_current=true`), compute `nextVersion = (max(version for student+skill) ?? 0) + 1`, insert new row `{ student_id: me, skill_id, definition_text, personal_example, why_it_matters, version: nextVersion, is_current: true, prompted_by: 'self_initiated' }`.
- Return `{ ok: true }` or `{ ok: false, error }`.

### Versioning
Silent. Each save creates a new `is_current` row and demotes the prior. The panel's existing "Earlier → Current" display continues to surface evolution; no history browser in this spec.

## Item 3 — "Work to reflect on" section

### Endpoint: `GET /api/student/skill/[skillId]/unreflected-work`
- `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.
- Auth: `getV2Identity()`; require `role === 'student'` (403 otherwise). Scope to the resolved student id.
- Query: `student_work` rows for this student that (a) have a `work_skill_tag` with `skill_id === skillId`, and (b) have **no** associated `growth_conversation` that is `in_progress` or `completed` (i.e. reflection status is "unreflected"). Newest first by `submitted_at` (nulls last). Cap 5.
- Return `{ activeInProgress: ActiveInProgress | null, items: SubmissionItem[] }`. Each item: `{ id, title, courseName, courseCode, weekNumber, submittedAt, status: 'unreflected', conversationId: null, primaryPillar: null, quarter, workType }` (matches `SubmissionItem`). `items` is empty when none; `activeInProgress` is the student's current in-progress reflection (global), included so the panel can wire `useStartReflection` correctly (see Item 3 render notes).

### Render
- A new section in `SkillPanel` (between definition and conversations), shown only when `editable` AND the fetched list is non-empty (hidden otherwise).
- Lazy-fetched via `useEffect` when the panel mounts/opens for a given skill.
- Each row reuses the `SubmissionRow` visual (surface="today": ○ glyph + title + course/week + Start chip).
- Click → start a reflection on that work via the shared `useStartReflection` hook (the same routing used on Today/Reflect).

### useStartReflection integration (important)
`useStartReflection({ active, onRefresh })` needs the student's current `activeInProgress` to behave correctly: for an unreflected item it starts immediately when `active` is null, but routes through `<InProgressInterstitial>` (explicit Resume / Discard-and-start / Cancel) when an active reflection already exists. `SkillPanel` does not have `activeInProgress` today. To preserve that UX:
- The `GET /api/student/skill/[skillId]/unreflected-work` response includes the student's `activeInProgress` (the same `ActiveInProgress | null` shape used elsewhere) alongside the `items` array — so one fetch primes both the list and the hook. Shape: `{ activeInProgress: ActiveInProgress | null, items: SubmissionItem[] }`.
- `SkillPanel` (when `editable`) wires `useStartReflection({ active: activeInProgress, onRefresh })` and conditionally renders `<InProgressInterstitial>` exactly as `TodayView`/`ReflectView` do, so starting from a skill panel honors an existing in-progress reflection.
- On a successful immediate start, navigation to `/v2/conversation/[id]` occurs (panel unmounts with the route change).

## Coach/student gating

- Add an `editable?: boolean` prop (default `false`) to `GrowthGrid`, threaded down to `SkillPanel`.
- **Student** `GrowthView.tsx`: render `<GrowthGrid data={data} editable />`.
- **Coach** `StudentDetailView.tsx` and **legacy** `GardenClient.tsx`: unchanged — no `editable` → defaults `false`.
- `editable === false` → `SkillPanel` renders exactly as today (read-only definition + conversations; no edit affordance, no "work to reflect on" section). The Growth-grid nudge renders only when `editable`.
- This keeps a coach viewing a student's panel strictly read-only and prevents any cross-student writes (the endpoints also enforce student-self scoping server-side).

## Architecture / data flow

- Definition display continues to come from `getGardenData` → `GardenPlant.currentDefinition/previousDefinition` (server-fetched). Editing is a client action → endpoint → `router.refresh()` re-runs the server component.
- "Work to reflect on" is a separate client fetch per opened skill (keeps the already-large garden query lean and avoids computing tagged-unreflected work for all ~11 skills on page load; also naturally student-scoped).
- New files (rough): `src/app/api/student/skill-definition/route.ts`, `src/app/api/student/skill/[skillId]/unreflected-work/route.ts`, a definition editor component (e.g. `src/components/panels/SkillDefinitionEditor.tsx`). Modified: `src/components/panels/SkillPanel.tsx`, `src/components/v2/growth/GrowthGrid.tsx`, `src/app/v2/(student)/growth/GrowthView.tsx`.

## Testing

Structural source-scan suite (new `scripts/test-spec-b-skill-detail.ts`, repo convention) asserting:
- `POST /api/student/skill-definition`: requires student identity; rejects empty definition; writes new version with `is_current` + demote + `prompted_by='self_initiated'`; never reads a student id from the body.
- `GET /api/student/skill/[skillId]/unreflected-work`: student-scoped; filters to `work_skill_tag` for the skill with no in_progress/completed conversation; caps 5; newest-first.
- `SkillPanel`: gated edit affordance + "work to reflect on" section behind `editable`; read-only when not.
- `GrowthGrid`: threads `editable` to `SkillPanel`; nudge gated to `editable`.
- `GrowthView` passes `editable`; `StudentDetailView` does NOT (coach stays read-only).
- Gates: `npx tsc --noEmit` 0; `npx eslint --no-eslintrc --config .eslintrc.json <files>` clean; `npm run build` 0; existing reflect/today + garden regression suites stay green.

## Out of scope / deferred (own follow-ups)

- **Definition → pre-tagging:** feeding student definitions into `autoTagWork` (backend + Trigger.dev redeploy; only affects future-synced work; re-tag backfill question for existing work). Documented follow-up.
- **Full onboarding / quarterly definition flow** (`prompted_by` `initial_onboarding`/`quarterly_revision`): Spec B does inline + nudge only.
- **Version history browser:** silent versioning only here.
- **Manual skill tagging by students** (`work_skill_tag.source='student_manual'`): not in scope.

## Reversibility

No schema changes. Reverting the commits restores the read-only panel and removes the two endpoints. Any `student_skill_definition` rows students create are valid data the backend already consumes (no cleanup needed on revert).
