# Spec A — Inline Guidance + Recent-Submissions Surfacing

**Date:** 2026-05-21
**Status:** Design approved, pending spec review
**Scope:** Two small UI changes on existing student surfaces. First of a two-spec sequence (Spec B = "Student-owned skill detail" follows).

## Goal

Make the student experience warmer and more self-explanatory in two targeted ways:
1. Calibrate the page subtitles across all 6 student tabs to a consistent, warm, pedagogical voice.
2. Replace the date-bucketed submissions view on Today with a focused "Recent submissions" to-do list (10 most recent actionable items, newest first).

Both are pure presentation changes on existing surfaces. No schema changes. The submissions data already exists in the `/api/student/today` response.

---

## Item 1 — Page subtitle calibration

### Problem

Every student tab already renders the same header pattern:
```tsx
<div className="mb-6">
  <h1 className="text-2xl font-bold text-gray-900">{Title}</h1>
  <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
</div>
```
But the subtitles range from warm (Journal) to robotic ("Reflect on submitted student work."). The voice is inconsistent.

### Design

Replace the subtitle copy on 5 of the 6 tabs (Journal is already the voice bar, left unchanged). Voice principles: second-person, implies growth/agency, no jargon, ≤ 18 words.

| Tab | File | New subtitle |
|-----|------|--------------|
| Today | `src/app/v2/(student)/today/TodayView.tsx` | Dynamic, 3 states (see below) |
| Reflect | `src/app/v2/(student)/reflect/page.tsx` | "Pick a piece of work to talk through. Your reflections become part of your growth story." |
| Journal | `src/app/v2/(student)/journal/page.tsx` | **Unchanged** — "Something on your mind? Describe what happened and we'll think through it together." |
| Growth | `src/app/v2/(student)/growth/page.tsx` | "Watch your skills grow over time. Click any to see the conversations behind it." |
| Career | `src/app/v2/(student)/career/page.tsx` | "How to talk about your growth — in resumes, in interviews, in your own words." |
| Narrative | `src/app/v2/(student)/narrative/page.tsx` | "Your story for each skill, built from how you talk about your work." |

**Today subtitle (dynamic, 3 states)** — keeps the existing `totalActionable` / `hasAnyContent` branching, only the copy changes:
- `totalActionable > 0`: `` `${totalActionable} piece${totalActionable === 1 ? '' : 's'} of work waiting for you` ``
- else if `hasAnyContent`: `"You're caught up. Nothing waiting on you right now."`
- else: `"Your portfolio fills in as you submit work."`

`totalActionable` computation is unchanged (LTI-pinned + count of `unreflected` submissions).

### Out of scope for Item 1

- Empty states, tooltips, info icons, first-run modals — the user chose page-level subtitles only.
- Coach-side surfaces.

---

## Item 2 — Today "Recent submissions" section

### Problem

Today currently renders `TodayBuckets` (Today / This week / Earlier-collapsed cards). It's more structure than Today needs, and it duplicates the archival browsing that the Reflect tab's tree already provides.

### Design

Replace `TodayBuckets` entirely with a single "Recent submissions" card.

**Data source:** `data.submissions` from `/api/student/today` (no API change — already returns every `student_work` row with a per-row `status` of `unreflected | in_progress | completed`).

**Filter + sort + cap (in order):**
1. Filter to `status === 'unreflected' || status === 'in_progress'`. Completed submissions are excluded (the Today tab is a to-do surface; viewing finished reflections is a Reflect-tab concern).
2. De-dupe the active in-progress reflection: exclude the item that's already shown in the `InProgressBanner` at the top of Today. Identify it by `submission.conversationId === activeInProgress.id` (match on the conversation id — `SubmissionItem.conversationId` is `growth_conversation.id` and `ActiveInProgress.id` is the same; this is precise and works whether or not the active reflection has a `workId`). In practice there's only ever one in-progress reflection (the active one), so this makes the list effectively unreflected-only today — but the logic is correct if multiple in-progress ever becomes possible.
3. Sort by `submittedAt` descending (newest first). Items with no `submittedAt` sort last.
4. Cap at 10.

**Rendering:**
- Reuse the existing `SubmissionRow` component with `surface="today"` (status glyph + title + ` · courseName · Week N` suffix + Start/Resume chip). No completed rows means no "View" chip and no pillar stripe in practice.
- Section title: **"Recent submissions"**.
- Card subtitle: **"Newest first. Older work lives in Reflect."**
- Overflow link: when the count of actionable items (after filter + de-dupe) exceeds 10, render a footer link "See all in Reflect →" routing to `/v2/reflect`. When ≤ 10, no link.
- Empty state: when 0 actionable items, the card renders a brief message: **"You're caught up — new work shows up here as you submit it."** (The card always renders so students learn where recent work appears.)

**New component:** `src/components/v2/student/RecentSubmissions.tsx` (mirrors the structure of `TodayBuckets.tsx`, which it replaces). Props: `{ submissions: SubmissionItem[]; activeInProgress: ActiveInProgress | null; onRowClick: (item: SubmissionItem) => void }`. The filter/sort/cap/de-dupe logic lives here (client-side, like the existing bucketing).

**TodayView wiring:** Replace `<TodayBuckets .../>` with `<RecentSubmissions submissions={data.submissions} activeInProgress={data.activeInProgress} onRowClick={onSubmissionClick} />`. Delete `TodayBuckets.tsx` and its import (it has no other consumers — verify with a grep during implementation).

### Stack order on Today (unchanged except buckets → recent)

1. Greeting / hero (with calibrated dynamic subtitle)
2. LTI pinned card (when arriving from Brightspace)
3. InProgressBanner (if activeInProgress)
4. **Recent submissions** (was TodayBuckets)
5. WeekStatsCard
6. RecentJournalSection
7. QuickActions

### Out of scope for Item 2

- API changes (`/api/student/today` already returns what's needed).
- The Reflect tab's tree (unchanged — it remains the full archive of all submissions, all statuses).
- Pagination/virtual scroll (hard cap of 10 makes it unnecessary).

---

## Testing

Follow the repo's structural source-scan convention (e.g. `scripts/test-reflect-today-redesign.ts`). A structural test (new or appended to the existing reflect/today suite) asserts:

- **Item 1:** each of the 5 changed page files contains its new subtitle string; Journal's subtitle is unchanged; Today's three dynamic-state strings are present in `TodayView.tsx`.
- **Item 2:**
  - `RecentSubmissions.tsx` exists, filters to `unreflected`/`in_progress`, sorts by `submittedAt` desc, caps at 10, and reuses `SubmissionRow`.
  - `RecentSubmissions` de-dupes against `activeInProgress`.
  - `TodayView.tsx` renders `RecentSubmissions` and no longer imports `TodayBuckets`.
  - `TodayBuckets.tsx` is deleted.
  - Overflow link to `/v2/reflect` present, gated on count > 10.

Gates per repo convention: `npx tsc --noEmit` exit 0; `npx eslint --no-eslintrc --config .eslintrc.json <changed files>` clean; `npm run build` exit 0; the existing student/reflect/today regression suite stays green.

## Reversibility

Pure presentation. Reverting the commit restores the prior subtitles and `TodayBuckets`. No data or schema implications.
