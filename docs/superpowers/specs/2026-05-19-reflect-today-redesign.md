# Reflect + Today Redesign — Design Spec

**Date:** 2026-05-19
**Status:** Brainstormed + approved; ready for implementation plan.
**Base:** `main` at `dc8b0d3` (post PR #13 — caps removed, in-progress trap stopgap shipped).
**Scope:** Student-facing surfaces only (in contract). Coach surfaces are Phase 2 (out of scope).

---

## Goal

Replace the deployed stopgap behavior on `/v2/reflect` and `/v2/today` — a flat uncapped list and a silent single-active conversation model — with the navigable, explicit, complete experience real pilot students need: a hierarchical browsable archive of every submission, a banner that always surfaces the active in-progress conversation, and an interstitial that asks before discarding partial work.

---

## Background

Three caps were silently hiding work from real pilot students (PR #11/#12/#13 today shipped the immediate fixes): `.slice(0, 5)` on `/api/student/reflect`, `.limit(5)` on `/api/student/today`, and `.limit(20)` upstream. Separately, the conversation engine had a hard "single-active" rule that silently auto-resumed any in-progress conversation when a student clicked any new assignment — trapping students who had backed out of a reflection. The trap is closed for empty shells (auto-abandon shipped in PR #13), and all caps are removed.

What remains: the surfaces are now uncapped but flat. A student with 200+ submissions sees a long newest-first list with no organization. And the in-progress UX is still implicit: a partial reflection silently resumes whenever the student clicks any work. Both are real product gaps the pilot will continue to hit.

This redesign delivers the explicit, navigable replacement: a Quarter → Course → Week → Submissions tree on Reflect; time-bucketed sections on Today; a pinned in-progress banner on both; and an explicit interstitial when a student tries to start a new reflection while one is in progress.

---

## Non-goals

- Coach or instructor surfaces (Phase 2, out of contract scope).
- Allowing multiple concurrent in-progress conversations per student (single-active model preserved).
- Changing the conversation engine itself (phases 1–3, prompts, LLM calls). The conversation flow once you're inside it is unchanged.
- New journal / open-reflection features. The `/v2/journal` surface and its data path are untouched.
- Date-scoped LTI flow changes. The LTI-pinned card behavior on Today is preserved.

---

## Architecture overview

Two student surfaces, one shared per-row component, one new modal/dialog stack, one new tiny endpoint.

```
/v2/reflect ──→ /api/student/reflect (new shape)
   ReflectView
     ├─ InProgressBanner (if activeInProgress)
     └─ ReflectTree
          └─ SubmissionRow ← shared component

/v2/today ──→ /api/student/today (new shape)
   TodayView
     ├─ LtiPinnedCard (unchanged)
     ├─ InProgressBanner (same component as Reflect)
     ├─ TodayBuckets (Today / This week / Earlier)
     │    └─ SubmissionRow ← shared component
     ├─ WeekStatsCard (unchanged)
     ├─ RecentJournalSection (unchanged)
     └─ QuickActions (unchanged)

Click handling:
   SubmissionRow ([Start] ○) ─→ /api/conversation/start (no in-progress) ─→ /v2/conversation/[new id]
                              ─→ InProgressInterstitial (in-progress exists)
                                   ├─ Resume    ─→ /v2/conversation/[existing id]
                                   ├─ Discard…  ─→ DiscardConfirmDialog ─→ /api/conversation/start { discardAndStart: true }
                                   └─ Cancel    ─→ close

   SubmissionRow ([Resume] ⏳) ─→ /v2/conversation/[existing id]
   SubmissionRow ([View] ✓)    ─→ ConversationFullView (side-modal style; deep-link via /v2/conversation/[id])
   InProgressBanner Resume    ─→ /v2/conversation/[id]
   InProgressBanner Discard   ─→ DiscardConfirmDialog ─→ POST /api/conversation/[id]/discard
```

Single-active-conversation is preserved as the data model (one `growth_conversation` per student with `status='in_progress'`), made explicit at the UX level.

---

## Reflect surface

### Layout

- Page header: "Reflect" + brief subtitle ("Reflect on submitted student work.").
- `InProgressBanner` — rendered if `activeInProgress` is non-null. Always full-width, always at top of the content stack.
- `ReflectTree` — quarter → course → week → submissions, every submission row, every status. No separate "Past reflections" or "Featured work" sections — those are folded into the tree via status icons.

### Tree behavior

- **Hierarchy:** `quarter` → `course_name` (with `course_code` shown in muted text) → `Week N` (derived from `student_work.week_number`; rows with no week_number bucket into a "Other" group at the end of the course) → `SubmissionRow`.
- **Counts:** each group header shows `(N)` where N is the total submissions under that node. Counts do not filter by status — they reflect the total content under the node.
- **Sort:**
  - Quarters: most recent first (Fall 2026 before Spring 2026 before Winter 2026 before Fall 2025; computed from a stable quarter ordering).
  - Courses within a quarter: alphabetical by `course_name`.
  - Weeks within a course: ascending by `week_number` (Week 1 → Week 12 → "Other").
  - Submissions within a week: most recent `submitted_at` first.
- **Smart-expand default:**
  - The current quarter (computed from today's date via the same quarter logic used in `/api/reflect/start`) is expanded. Older quarters collapsed.
  - Within the current quarter, every course is expanded.
  - Within each expanded course, the **current week** for that course is expanded; other weeks collapsed. "Current week" is defined as: the highest `week_number` with at least one submission for that course (i.e. the latest curriculum week the student has touched). This is curriculum-week-based, not calendar-week-based — it matches the LE3 course structure ("Week 1", "Week 2", …) and degrades gracefully whether or not "today" lines up with a course week.
- **Expand state persistence:** in-session client state only. Reloading the page returns to smart-expand defaults. No localStorage.
- **Empty state:** if the student has zero submissions, render a single card matching the current "Nothing to reflect on yet" treatment ("When you submit work to D2L, it'll show up here ready for reflection.").

### Row content

Each `SubmissionRow` renders:

- A status glyph on the left:
  - `○` (gray) — unreflected (no in_progress or completed conversation for this work)
  - `⏳` (amber) — in_progress conversation exists for this work
  - `✓` (green) — completed conversation exists for this work
- The submission title (from `student_work.title`), single line, truncated with ellipsis if needed.
- An action chip on the right, color-coded to status:
  - `[Start]` (blue) — for `○`
  - `[Resume]` (amber) — for `⏳`
  - `[View]` (green) — for `✓`
- The entire row is the click target (chip is visual emphasis, not a separate hit area).
- No secondary line (date/grade). Keeps rows scannable; details available inside the conversation view.

### Pillar stripe

The existing `pillarStripeStyle` treatment from current code is preserved for completed rows (their dominant pillar coloring). Unreflected and in_progress rows render without a stripe.

---

## Today surface

### Layout

- Page header: "Today" + the existing dynamic subtitle ("N things to reflect on" / "You're up to date" / "Welcome").
- `LtiPinnedCard` — unchanged from current behavior. Renders only when an `lti_context` cookie is present.
- `InProgressBanner` — same component instance used on Reflect.
- `TodayBuckets` — three sections, in order: **Today**, **This week**, **Earlier**.
- `WeekStatsCard` — unchanged. Continues to show `conversationsCompleted` / `workSubmitted` counts for the last 7 days.
- `RecentJournalSection` — unchanged. Still capped at 3 (intentional, doc-stated, separate concern from work-reflection caps).
- `QuickActions` — unchanged.

### Bucket behavior

Each bucket contains `SubmissionRow` instances (the same component as Reflect, in a `surface="today"` mode). On Today, the row appends muted context after the title — `<title> · <courseName> · Week N` — because the date-bucket structure doesn't carry course/week context the way Reflect's hierarchy does. On Reflect (`surface="reflect"`) the title stands alone (no secondary text). The status glyph + action chip behavior is identical on both surfaces. Buckets:

- **Today:** submissions where `DATE(submitted_at) == DATE(today)` in the user's local timezone (computed client-side). Expanded by default.
- **This week:** submissions in the last 7 days, excluding "Today". Expanded by default.
- **Earlier:** all other submissions. **Collapsed by default**. When expanded, lists everything else (uncapped) sorted newest-first. A student with a large backlog should still find this scannable; if scale ever becomes a concern, a follow-up can re-introduce hierarchical grouping inside "Earlier" (out of scope here).

Each bucket header shows `(N)` where N is the count in that bucket. If a bucket is empty, its header is not rendered (no empty "Today (0)" sections).

If `Today (0)` AND `This week (0)` AND `Earlier (0)` AND no in-progress AND no LTI, the existing "Welcome — your portfolio will fill in as you submit work" empty state renders instead.

---

## In-progress conversation flow

The single-active model is preserved at the data layer. The UX is made explicit.

### Pinned in-progress banner

When `activeInProgress` is non-null on either surface, render:

```
⏳ Resume: <work title>
   Phase <currentPhase> · started <relative time>
   [Resume →]  [Discard]
```

- Banner background `bg-amber-50`, border `border-amber-300` (matches existing in-progress styling).
- `Resume →` navigates to `/v2/conversation/<id>` (the existing interactive flow).
- `Discard` opens the `DiscardConfirmDialog`.
- For an open-reflection in-progress (`conversation_type === 'open_reflection'`), the banner reads `⏳ Resume: <work_context truncated>` and `Resume →` routes to the existing in-progress route for open reflections (`/v2/conversation/[id]` — the same `ConversationView` dispatcher used for work-based in-progress, which selects `ConversationFlowView` for `in_progress` status). No journal-flow UX change.

### Interstitial — clicking a NEW assignment while one is in-progress

When a student clicks a `[Start]` row on either surface, and an `activeInProgress` exists, surface the `InProgressInterstitial` modal instead of starting immediately. Modal copy:

> **You have a reflection in progress**
>
> You're partway through reflecting on **<active work title>** (Phase N). Want to finish that first, or set it aside and start the new one?
>
> [Resume in-progress] · [Discard and start new] · [Cancel]

- `Resume in-progress` (green primary) → navigates to `/v2/conversation/<existing id>`.
- `Discard and start new` (red secondary) → opens the `DiscardConfirmDialog` (same component as banner Discard). On confirm: POST `/api/conversation/start` with `{ workId, discardAndStart: true }` → server abandons the existing in-progress, creates the new conversation, returns the new id → client navigates to `/v2/conversation/<new id>`.
- `Cancel` (neutral) → close modal; no navigation.

### Discard confirmation

A shared `DiscardConfirmDialog` component:

> **Discard your in-progress reflection?**
>
> Your progress on **<work title>** (Phase N) will be removed. This can't be undone from here.
>
> [Discard] · [Cancel]

- "Discard" is the destructive primary; styled red.
- On confirm: caller decides the action (banner discard → POST `/api/conversation/[id]/discard`; interstitial → POST `/api/conversation/start { discardAndStart: true }`).
- The dialog itself takes a `confirmLabel` and an `onConfirm` callback — generic, reusable.
- Recoverability: `status='abandoned'` is reversible in the DB by an admin; students are not told this (the UX reads as permanent).

### Auto-abandon of empty shells

The shipped behavior from PR #13 is preserved unchanged: any in-progress conversation with `response_phase_1 == null` is auto-abandoned by `/api/conversation/start` on the next call, silently. The banner therefore never shows an empty backed-out shell — it only shows conversations with real progress.

---

## "View" for completed conversations

The typewriter-effect `ConversationReplay` is retired for real students. Replace with a `ConversationFullView` that renders the entire conversation at once — work header, all three phases (prompt + response), synthesis, skill tags. Visual treatment matches the existing `ConversationPanel` slide-out (which already shows full conversations at once on the Reflect surface for in-progress cards).

- Click target: any `✓` row (Reflect or Today) → opens `ConversationFullView`. **Open as a side-modal slide-out** on top of the current page, matching the current `ConversationPanel` UX for in-progress (consistent affordance for "look at a conversation").
- Deep-link: `/v2/conversation/[id]` URL stays valid and shareable. When visited directly and `status === 'completed'`, render `ConversationFullView` as a full-page view (same component, different layout wrapper). When `status === 'in_progress'`, render the existing `ConversationFlowView`. The dispatching in `ConversationView` is preserved.
- `ConversationReplay` (typewriter) is kept in the codebase but no longer rendered for real students. (Demo personas may continue to use it — gated by `is_demo` if needed; default for safety is "real" view.)

---

## API contracts

Both routes return enough data to render the trees/buckets client-side without further fetches.

### `GET /api/student/reflect` — new shape

```ts
type ReflectResponse = {
  activeInProgress: {
    id: string
    workId: string | null  // null for open_reflection
    workTitle: string | null
    conversationType: 'work_based' | 'open_reflection'
    currentPhase: 1 | 2 | 3
    startedAt: string
  } | null

  submissions: Array<{
    id: string             // student_work.id
    title: string
    courseName: string | null
    courseCode: string | null
    quarter: string        // e.g. "Spring 2026"
    weekNumber: number | null
    submittedAt: string | null
    workType: string | null
    status: 'unreflected' | 'in_progress' | 'completed'
    conversationId: string | null  // present when status is in_progress or completed
    primaryPillar: string | null   // present for completed; drives row stripe
  }>
}
```

- One row per `student_work`. Server joins `growth_conversation` to compute `status` and `conversationId` (latest non-abandoned conversation per `work_id`, preferring `in_progress` over `completed`).
- No `.limit()` (verified safe at pilot scale; PR #12 already removed caps).
- `submissions` ordered newest-first by `submitted_at`. Tree builds client-side.
- `activeInProgress` is the single non-null in-progress for this student (matches the single-active model). Null when none.

### `GET /api/student/today` — new shape

```ts
type TodayResponse = {
  activeInProgress: ReflectResponse['activeInProgress']

  submissions: ReflectResponse['submissions']  // same shape, uncapped

  // Preserved from current shape:
  recentJournal: Array<{ id; startedAt; description; synthesisExcerpt; primaryPillar }>
  weekStats: { conversationsCompleted: number; workSubmitted: number }
  ltiPinned: { resourceLinkId; title; courseTitle } | null
}
```

- `submissions` reuses the Reflect submission shape exactly so `SubmissionRow` is one component.
- Bucketing happens client-side from `submittedAt`.

### `POST /api/conversation/start` — add `discardAndStart` flag

Existing behavior preserved when called without the flag (resume non-empty in-progress, auto-abandon empty). When called with `{ workId, discardAndStart: true }`:

1. Authenticate (existing).
2. If an `in_progress` conversation exists for this student, set its `status='abandoned'` (regardless of phase-1 response presence) and log `conversation.abandoned_explicit`.
3. Proceed to create a new conversation for `workId` (existing path).
4. Return the new `conversationId`.

The auto-abandon of empties stays in place for the default-flag case.

### `POST /api/conversation/[id]/discard` — new endpoint

```ts
// Auth: student must own the conversation.
// Body: none.
// Returns: { ok: true } on success.

POST /api/conversation/[id]/discard
→ verify session resolves to a student id (getV2StudentId)
→ load growth_conversation; 404 if missing
→ 403 if growth_conversation.student_id !== student id
→ if status === 'in_progress': set status='abandoned'; log 'conversation.discarded'
→ return { ok: true }
```

Routes are `dynamic = 'force-dynamic'`, `runtime = 'nodejs'`.

---

## Components

### New

- `src/components/v2/student/ReflectTree.tsx` — controlled-state tree renderer; takes `submissions` + smart-expand defaults; renders nested `QuarterNode` / `CourseNode` / `WeekNode` / `SubmissionRow`.
- `src/components/v2/student/TodayBuckets.tsx` — three-bucket renderer; takes `submissions` + today's date; renders `SubmissionRow` rows in each bucket.
- `src/components/v2/student/SubmissionRow.tsx` — the shared per-row component; takes a submission + a click handler; renders status glyph, title, action chip; emits a unified click event the parent handles based on status.
- `src/components/v2/student/InProgressBanner.tsx` — renders the pinned banner; takes `activeInProgress` + handlers for Resume and Discard.
- `src/components/v2/student/InProgressInterstitial.tsx` — modal shown when starting a new reflection with an active in-progress; takes the active conversation summary + the target workId + handlers.
- `src/components/v2/student/DiscardConfirmDialog.tsx` — shared confirm dialog; takes title, body, `confirmLabel`, `onConfirm`.
- `src/components/v2/student/ConversationFullView.tsx` — non-typewriter, all-at-once rendering of a completed conversation. Reuses content blocks from `ConversationPanel` where possible.

### Modified

- `src/app/v2/(student)/reflect/ReflectView.tsx` — new render: `<InProgressBanner />` + `<ReflectTree />`; remove the three-section (in-progress / featured / completed) layout.
- `src/app/v2/(student)/today/TodayView.tsx` — replace `FeaturedWorkSection` with `<InProgressBanner />` + `<TodayBuckets />`; keep LTI / WeekStats / RecentJournal / QuickActions unchanged.
- `src/app/v2/(student)/conversation/[id]/ConversationView.tsx` — completed branch dispatches to `<ConversationFullView />` instead of `<ConversationReplay />`. In-progress branch unchanged.
- `src/app/api/student/reflect/route.ts` — new response shape (above). Reuses existing query patterns; adds a single-active fetch for `activeInProgress`.
- `src/app/api/student/today/route.ts` — new response shape (above). Removes the now-redundant `featuredWork` shape; retains `recentJournal` / `weekStats` / `ltiPinned`.
- `src/app/api/conversation/start/route.ts` — add `discardAndStart: true` branch.

### New routes

- `src/app/api/conversation/[id]/discard/route.ts` — see API contracts above.

### Unchanged (regression-assert)

- The conversation flow itself (`ConversationFlowView`, phase logic, LLM prompts) — untouched.
- `/v2/journal` and `/api/student/journal/*` — untouched.
- LTI launch + LTI-pinned card on Today — untouched.
- Passlinks / admin Tools / staff-passlink — untouched.
- Coach surfaces — untouched.

---

## Edge cases & behaviors

- **Open-reflection in-progress in the banner.** If `activeInProgress.conversationType === 'open_reflection'`, banner copy uses `work_context` as the title fallback, and `Resume →` routes to wherever the journal flow currently resumes (preserve existing behavior; no UX change here).
- **Submission with no `week_number`.** Bucketed into a per-course "Other" group, sorted last. Common for one-off submissions.
- **Submission with no `assignment_id`.** Still rendered in the tree under its course/quarter; title comes from `student_work.title` (always non-null).
- **Two completed conversations for one work.** Shouldn't happen in practice (engine creates one), but if it does, the row shows the most recent. Older are reachable only via direct URL.
- **`status='abandoned'` rows.** Never surfaced anywhere. Filtered out of all four routes (reflect, today, ConversationView, conversation/start).
- **Interstitial dismissal.** Clicking outside the modal or hitting Esc = Cancel.
- **Discard while phase-1 typing in progress.** N/A — discard is only available from the banner / interstitial, not from inside the conversation flow.
- **Race: student opens interstitial, simultaneously the in-progress is completed in another tab.** On Discard-and-start confirm, the server-side discardAndStart only abandons rows still `in_progress` (no-op if it's now `completed`); proceeds to create new for the requested work either way. Safe.

### Accessibility

- All clickable rows have proper `<button>` semantics (not div+onClick).
- Status glyphs have `aria-label` ("Not yet reflected" / "Reflection in progress" / "Reflection complete").
- Tree expand/collapse toggles announce expanded state.
- Modal traps focus; restores focus to the originating row on dismiss.

### Mobile

- Tree indentation collapses to fixed 12px steps on narrow viewports.
- Pinned banner remains full-width.
- Modals occupy ~90% viewport width on mobile.

---

## Testing strategy

Repo convention: structural source-scan test via `npx tsx`, harness `_sync-test-harness` (`assertEqual` / `section` / `finish`).

New: `scripts/test-reflect-today-redesign.ts` — asserts:

- `/api/student/reflect/route.ts` returns the new shape: presence of `activeInProgress` and `submissions[].status`; absence of the old `featuredWork` / `inProgress` / `completed` arrays.
- `/api/student/today/route.ts` returns the new shape: `submissions` present, no `featuredWork`; existing `recentJournal` / `weekStats` / `ltiPinned` still present.
- `/api/conversation/[id]/discard/route.ts` exists; uses `getV2StudentId`; sets `status: 'abandoned'`; is `dynamic = 'force-dynamic'` and `runtime = 'nodejs'`.
- `/api/conversation/start/route.ts` honors `discardAndStart`.
- Components present: `ReflectTree`, `TodayBuckets`, `SubmissionRow`, `InProgressBanner`, `InProgressInterstitial`, `DiscardConfirmDialog`, `ConversationFullView`.
- `ReflectView` renders `<InProgressBanner />` + `<ReflectTree />` (and no longer the three flat sections).
- `TodayView` renders `<InProgressBanner />` + `<TodayBuckets />` and preserves LTI / WeekStats / RecentJournal / QuickActions.
- `ConversationView` completed branch routes to `<ConversationFullView />`, not `<ConversationReplay />`.

Regression: `scripts/test-staff-passlink.ts` (35/0) and `scripts/test-student-passlinks.ts` (56/0) must remain green.

Manual QA: dualrole test account (24 rows already in place from earlier this session) + real pilot accounts post-deploy.

---

## Reversibility

The redesign is code-only. No DB migrations. No data mutations beyond the existing `status='abandoned'` set (already used in PR #13 and the data unblock). Rollback = revert the merge commit; `main` returns to the post-PR #13 stopgap state. The shipped uncap (PR #12) and trap-fix (PR #13) remain intact regardless.

---

## Open questions for the plan stage

- Whether `ConversationReplay` (typewriter) should be deleted outright or kept behind a demo flag. Default: keep, gate on `is_demo`.
- Whether the Today "Earlier" bucket should sub-group by quarter when it contains many rows. Default: flat, sorted newest-first; revisit if the pilot reports it as noisy.
- The exact relative-time copy in the in-progress banner ("started 2h ago" vs "Phase 2 of 3"). Default: both, as shown in mockups.

These are tactical and can be settled during plan-writing.
