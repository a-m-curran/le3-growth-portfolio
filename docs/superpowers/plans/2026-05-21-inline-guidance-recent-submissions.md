# Inline Guidance + Recent-Submissions Surfacing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calibrate the page subtitles across all 6 student tabs to a warm pedagogical voice, and replace Today's date-bucketed submissions view with a focused "Recent submissions" to-do card (10 most recent actionable items, newest first).

**Architecture:** Pure presentation changes on existing student surfaces. No schema or API changes — `/api/student/today` already returns every `student_work` row with a per-row status. A new `RecentSubmissions` client component replaces `TodayBuckets`; subtitle copy is edited in place across the page files.

**Tech Stack:** Next.js (App Router), React client components, Tailwind. Structural source-scan tests via `npx tsx` against `scripts/_sync-test-harness.ts`.

**Spec:** `docs/superpowers/specs/2026-05-21-inline-guidance-recent-submissions-design.md`

---

## File Structure

- **Modify:** `src/app/v2/(student)/reflect/page.tsx` — subtitle copy
- **Modify:** `src/app/v2/(student)/growth/page.tsx` — subtitle copy
- **Modify:** `src/app/v2/(student)/career/page.tsx` — subtitle copy
- **Modify:** `src/app/v2/(student)/narrative/page.tsx` — subtitle copy
- **Modify:** `src/app/v2/(student)/today/TodayView.tsx` — dynamic subtitle copy (Task 1) + swap TodayBuckets→RecentSubmissions (Task 3)
- **Create:** `src/components/v2/student/RecentSubmissions.tsx` — the new card (Task 2)
- **Delete:** `src/components/v2/student/TodayBuckets.tsx` — replaced (Task 3)
- **Create:** `scripts/test-spec-a-guidance.ts` — structural tests for subtitles (Task 1) + RecentSubmissions behavior (Task 2)
- **Modify:** `scripts/test-reflect-today-redesign.ts` — retarget the TodayBuckets section + wire-up assertion to RecentSubmissions (Task 3), keeping the existing suite green after the swap

Journal (`src/app/v2/(student)/journal/page.tsx`) is intentionally **not** modified — its subtitle is already the voice bar.

---

## Task 1: Subtitle calibration (all 6 tabs)

**Files:**
- Create: `scripts/test-spec-a-guidance.ts`
- Modify: `src/app/v2/(student)/reflect/page.tsx`
- Modify: `src/app/v2/(student)/growth/page.tsx`
- Modify: `src/app/v2/(student)/career/page.tsx`
- Modify: `src/app/v2/(student)/narrative/page.tsx`
- Modify: `src/app/v2/(student)/today/TodayView.tsx` (subtitle block only)

- [ ] **Step 1: Write the failing test**

Create `scripts/test-spec-a-guidance.ts` with EXACTLY:

```ts
/**
 * Structural invariants for Spec A — inline guidance + recent submissions.
 * Components/routes can't run under tsx; comment-stripped source scan.
 * USAGE: npx tsx scripts/test-spec-a-guidance.ts
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

section('Item 1: page subtitle calibration')
{
  const reflect = stripComments(read('src/app/v2/(student)/reflect/page.tsx'))
  assertEqual(/Pick a piece of work to talk through\. Your reflections become part of your growth story\./.test(reflect), true, 'reflect subtitle calibrated')
  assertEqual(/Reflect on submitted student work/.test(reflect), false, 'old reflect subtitle removed')

  const growth = stripComments(read('src/app/v2/(student)/growth/page.tsx'))
  assertEqual(/Watch your skills grow over time\. Click any to see the conversations behind it\./.test(growth), true, 'growth subtitle calibrated')

  const career = stripComments(read('src/app/v2/(student)/career/page.tsx'))
  assertEqual(/How to talk about your growth — in resumes, in interviews, in your own words\./.test(career), true, 'career subtitle calibrated')

  const narrative = stripComments(read('src/app/v2/(student)/narrative/page.tsx'))
  assertEqual(/Your story for each skill, built from how you talk about your work\./.test(narrative), true, 'narrative subtitle calibrated')

  const today = stripComments(read('src/app/v2/(student)/today/TodayView.tsx'))
  assertEqual(/of work waiting for you/.test(today), true, 'today actionable subtitle calibrated')
  assertEqual(/You're caught up\. Nothing waiting on you right now\./.test(today), true, 'today caught-up subtitle calibrated')
  assertEqual(/Your portfolio fills in as you submit work\./.test(today), true, 'today welcome subtitle calibrated')
  assertEqual(/things? to reflect on/.test(today), false, 'old today subtitle removed')

  const journal = stripComments(read('src/app/v2/(student)/journal/page.tsx'))
  assertEqual(/think through it together\./.test(journal), true, 'journal subtitle unchanged (voice bar)')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-a-guidance.ts
```
Expected: FAIL — the calibrated subtitle strings don't exist yet (reflect/growth/career/narrative/today assertions fail).

- [ ] **Step 3: Edit reflect/page.tsx subtitle**

In `src/app/v2/(student)/reflect/page.tsx`, replace:

```tsx
        <p className="text-sm text-gray-500 mt-1">
          Reflect on submitted student work.
        </p>
```

with:

```tsx
        <p className="text-sm text-gray-500 mt-1">
          Pick a piece of work to talk through. Your reflections become part of your growth story.
        </p>
```

- [ ] **Step 4: Edit growth/page.tsx subtitle**

In `src/app/v2/(student)/growth/page.tsx`, replace:

```tsx
        <p className="text-sm text-gray-500 mt-1">
          How your skills are growing across the program. Each visual is its own — click any to see the conversations behind it.
        </p>
```

with:

```tsx
        <p className="text-sm text-gray-500 mt-1">
          Watch your skills grow over time. Click any to see the conversations behind it.
        </p>
```

- [ ] **Step 5: Edit career/page.tsx subtitle**

In `src/app/v2/(student)/career/page.tsx`, replace:

```tsx
        <p className="text-sm text-gray-500 mt-1">
          Resume language and interview talking points, synthesized from your growth narratives.
        </p>
```

with:

```tsx
        <p className="text-sm text-gray-500 mt-1">
          How to talk about your growth — in resumes, in interviews, in your own words.
        </p>
```

- [ ] **Step 6: Edit narrative/page.tsx subtitle**

In `src/app/v2/(student)/narrative/page.tsx`, replace:

```tsx
        <p className="text-sm text-gray-500 mt-1">
          Your growth story for each skill, built from your conversations and reflections.
        </p>
```

with:

```tsx
        <p className="text-sm text-gray-500 mt-1">
          Your story for each skill, built from how you talk about your work.
        </p>
```

- [ ] **Step 7: Edit TodayView.tsx dynamic subtitle**

In `src/app/v2/(student)/today/TodayView.tsx`, replace:

```tsx
        <p className="text-sm text-gray-500 mt-1">
          {totalActionable > 0
            ? `${totalActionable} thing${totalActionable === 1 ? '' : 's'} to reflect on`
            : hasAnyContent
            ? `You're up to date — nothing waiting on you right now`
            : `Welcome — your portfolio will fill in as you submit work`}
        </p>
```

with:

```tsx
        <p className="text-sm text-gray-500 mt-1">
          {totalActionable > 0
            ? `${totalActionable} piece${totalActionable === 1 ? '' : 's'} of work waiting for you`
            : hasAnyContent
            ? `You're caught up. Nothing waiting on you right now.`
            : `Your portfolio fills in as you submit work.`}
        </p>
```

- [ ] **Step 8: Run test to verify it passes**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-a-guidance.ts
```
Expected: PASS — all "Item 1" assertions green (10 passed, 0 failed).

- [ ] **Step 9: Gates**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json "src/app/v2/(student)/reflect/page.tsx" "src/app/v2/(student)/growth/page.tsx" "src/app/v2/(student)/career/page.tsx" "src/app/v2/(student)/narrative/page.tsx" "src/app/v2/(student)/today/TodayView.tsx" scripts/test-spec-a-guidance.ts
```
Expected: tsc exit 0; eslint no warnings.

- [ ] **Step 10: Commit**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add "src/app/v2/(student)/reflect/page.tsx" "src/app/v2/(student)/growth/page.tsx" "src/app/v2/(student)/career/page.tsx" "src/app/v2/(student)/narrative/page.tsx" "src/app/v2/(student)/today/TodayView.tsx" scripts/test-spec-a-guidance.ts && git commit -m "feat(v2): calibrate student-tab subtitles to warm pedagogical voice"
```

---

## Task 2: RecentSubmissions component

**Files:**
- Create: `src/components/v2/student/RecentSubmissions.tsx`
- Modify: `scripts/test-spec-a-guidance.ts` (append a section above the marker)

- [ ] **Step 1: Write the failing test**

In `scripts/test-spec-a-guidance.ts`, insert ABOVE the line `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<`:

```ts
section('Item 2: RecentSubmissions component')
{
  const c = stripComments(read('src/components/v2/student/RecentSubmissions.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function RecentSubmissions/.test(c), true, 'RecentSubmissions exported')
  assertEqual(/SubmissionRow/.test(c) && /surface=['"]today['"]/.test(c), true, 'reuses SubmissionRow surface=today')
  assertEqual(/status === 'unreflected'/.test(c) && /status === 'in_progress'/.test(c), true, 'filters to unreflected + in_progress')
  assertEqual(/status === 'completed'/.test(c), false, 'does NOT include completed')
  assertEqual(/activeInProgress/.test(c) && /conversationId/.test(c), true, 'de-dupes the active in-progress (banner) item')
  assertEqual(/submittedAt/.test(c) && /sort/.test(c), true, 'sorts by submittedAt')
  assertEqual(/const CAP = 10/.test(c) && /slice\(0, CAP\)/.test(c), true, 'caps at 10')
  assertEqual(/\/v2\/reflect/.test(c), true, 'overflow link to /v2/reflect')
  assertEqual(/caught up/i.test(c), true, 'empty state copy present')
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-a-guidance.ts
```
Expected: FAIL — `RecentSubmissions.tsx` doesn't exist yet (the new section's 10 assertions fail; Item 1 still passes).

- [ ] **Step 3: Create RecentSubmissions.tsx**

Create `src/components/v2/student/RecentSubmissions.tsx` with EXACTLY:

```tsx
'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { SubmissionRow } from '@/components/v2/student/SubmissionRow'
import type { SubmissionItem, ActiveInProgress } from '@/components/v2/student/types'

/**
 * "Recent submissions" card for /v2/today — the 10 most recent
 * ACTIONABLE submissions (unreflected or in_progress), newest first.
 *
 * Replaces the prior date-bucketed TodayBuckets. Today is a to-do
 * surface: completed reflections are excluded (they live in the
 * Reflect archive). The single active in-progress reflection already
 * shows in the InProgressBanner above, so it's de-duped out here
 * (matched by conversationId === activeInProgress.id).
 *
 * Hard cap of 10; when more actionable items exist, a footer links to
 * /v2/reflect (the full archive tree). Empty state renders a gentle
 * "caught up" message so students learn where recent work appears.
 */

const CAP = 10

interface RecentSubmissionsProps {
  submissions: SubmissionItem[]
  activeInProgress: ActiveInProgress | null
  onRowClick: (item: SubmissionItem) => void
}

export function RecentSubmissions({
  submissions,
  activeInProgress,
  onRowClick,
}: RecentSubmissionsProps) {
  const actionable = useMemo(() => {
    const bannerConvId = activeInProgress?.id ?? null
    return submissions
      .filter(s => s.status === 'unreflected' || s.status === 'in_progress')
      .filter(s => !(bannerConvId && s.conversationId === bannerConvId))
      .sort((a, b) => {
        const ta = a.submittedAt ? Date.parse(a.submittedAt) : -Infinity
        const tb = b.submittedAt ? Date.parse(b.submittedAt) : -Infinity
        return tb - ta
      })
  }, [submissions, activeInProgress])

  const shown = actionable.slice(0, CAP)
  const hasOverflow = actionable.length > CAP

  return (
    <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-900">Recent submissions</h2>
      <p className="text-xs text-gray-500 mb-2 mt-0.5">
        Newest first. Older work lives in Reflect.
      </p>

      {shown.length === 0 ? (
        <p className="text-sm text-gray-500 italic px-3 py-2">
          You&rsquo;re caught up — new work shows up here as you submit it.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {shown.map(item => (
            <li key={item.id}>
              <SubmissionRow item={item} surface="today" onClick={onRowClick} />
            </li>
          ))}
        </ul>
      )}

      {hasOverflow && (
        <Link
          href="/v2/reflect"
          className="block w-full mt-2 pt-2 border-t border-gray-100 text-center text-xs text-gray-600 hover:text-gray-900"
        >
          See all in Reflect →
        </Link>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-a-guidance.ts
```
Expected: PASS — Item 1 (10) + Item 2 (10) = 20 passed, 0 failed.

- [ ] **Step 5: Gates**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/student/RecentSubmissions.tsx scripts/test-spec-a-guidance.ts
```
Expected: tsc exit 0; eslint no warnings. (Note: `RecentSubmissions` is created but not yet wired into `TodayView` — that's Task 3. tsc passes because an unused-but-exported component is fine; ESLint won't flag it since it's exported.)

- [ ] **Step 6: Commit**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add src/components/v2/student/RecentSubmissions.tsx scripts/test-spec-a-guidance.ts && git commit -m "feat(v2): RecentSubmissions card (10 most recent actionable, newest first)"
```

---

## Task 3: Wire RecentSubmissions into TodayView; delete TodayBuckets; update redesign suite

**Files:**
- Modify: `src/app/v2/(student)/today/TodayView.tsx` (swap import + usage + doc comment)
- Delete: `src/components/v2/student/TodayBuckets.tsx`
- Modify: `scripts/test-reflect-today-redesign.ts` (retarget TodayBuckets section + wire-up assertion)

- [ ] **Step 1: Update the redesign suite (failing test for the swap)**

In `scripts/test-reflect-today-redesign.ts`, replace the entire `section('Task 12: TodayBuckets component')` block (it currently reads `TodayBuckets.tsx` and asserts bucket labels):

```ts
section('Task 12: TodayBuckets component')
{
  const c = stripComments(read('src/components/v2/student/TodayBuckets.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function TodayBuckets/.test(c), true, 'TodayBuckets exported')
  assertEqual(/SubmissionRow/.test(c), true, 'renders SubmissionRow')
  assertEqual(/surface=['"]today['"]/.test(c), true, 'passes surface="today"')
  assertEqual(/Today/.test(c) && /This week/.test(c) && /Earlier/.test(c), true, 'three bucket labels')
  assertEqual(/earlierOpen|earlier_open|defaultEarlierOpen|expandedEarlier/.test(c) || /useState\(false\)/.test(c), true, 'tracks earlier-open state (default closed)')
  assertEqual(/submittedAt/.test(c), true, 'reads submittedAt for bucketing')
}
```

with:

```ts
section('Task 12: RecentSubmissions component (replaces TodayBuckets)')
{
  const c = stripComments(read('src/components/v2/student/RecentSubmissions.tsx'))
  assertEqual(/'use client'/.test(c), true, 'client component')
  assertEqual(/export function RecentSubmissions/.test(c), true, 'RecentSubmissions exported')
  assertEqual(/SubmissionRow/.test(c), true, 'renders SubmissionRow')
  assertEqual(/surface=['"]today['"]/.test(c), true, 'passes surface="today"')
  assertEqual(/submittedAt/.test(c), true, 'reads submittedAt for ordering')
  // TodayBuckets is gone — confirm the file no longer exists.
  assertEqual(read('src/components/v2/student/TodayBuckets.tsx'), '', 'TodayBuckets.tsx deleted')
}
```

Then, in the `section('Task 15: TodayView wired to new components')` block, replace this line:

```ts
  assertEqual(/TodayBuckets/.test(v), true, 'renders TodayBuckets')
```

with:

```ts
  assertEqual(/RecentSubmissions/.test(v), true, 'renders RecentSubmissions')
  assertEqual(/TodayBuckets/.test(v), false, 'no longer references TodayBuckets')
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-reflect-today-redesign.ts
```
Expected: FAIL — `RecentSubmissions` not yet rendered in TodayView; `TodayBuckets.tsx` still exists.

- [ ] **Step 3: Swap the component in TodayView.tsx**

In `src/app/v2/(student)/today/TodayView.tsx`, replace the import:

```tsx
import { TodayBuckets } from '@/components/v2/student/TodayBuckets'
```

with:

```tsx
import { RecentSubmissions } from '@/components/v2/student/RecentSubmissions'
```

Then replace the usage:

```tsx
      <TodayBuckets submissions={data.submissions} onRowClick={onSubmissionClick} />
```

with:

```tsx
      <RecentSubmissions
        submissions={data.submissions}
        activeInProgress={data.activeInProgress}
        onRowClick={onSubmissionClick}
      />
```

Also update the doc-comment line in the header block (around line 19) from:

```tsx
 *   4. TodayBuckets (Today / This week / Earlier)
```

to:

```tsx
 *   4. RecentSubmissions (10 most recent actionable, newest first)
```

- [ ] **Step 4: Delete TodayBuckets.tsx**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && git rm src/components/v2/student/TodayBuckets.tsx
```

- [ ] **Step 5: Run both test suites to verify they pass**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-reflect-today-redesign.ts
cd /Users/andrewcurran/le3-growth-portfolio && npx tsx scripts/test-spec-a-guidance.ts
```
Expected: redesign suite green (123 passed, 0 failed — was 125; the TodayBuckets section dropped from 7 assertions to 6, and the wire-up gained 1, net −1; the swap is otherwise even — confirm the actual number printed and that failures = 0); spec-a suite 20 passed, 0 failed.

- [ ] **Step 6: Full gates**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && npx tsc --noEmit
cd /Users/andrewcurran/le3-growth-portfolio && npx eslint --no-eslintrc --config .eslintrc.json "src/app/v2/(student)/today/TodayView.tsx"
cd /Users/andrewcurran/le3-growth-portfolio && npm run build
```
Expected: tsc exit 0; eslint no warnings; build exit 0, "Compiled successfully".

- [ ] **Step 7: Commit**

```bash
cd /Users/andrewcurran/le3-growth-portfolio && git add "src/app/v2/(student)/today/TodayView.tsx" scripts/test-reflect-today-redesign.ts && git commit -m "feat(v2): Today renders RecentSubmissions, retire TodayBuckets"
```

(The `git rm` from Step 4 is already staged; the commit captures the deletion.)

---

## Self-Review

**Spec coverage:**
- Item 1 (subtitle calibration, all 6 tabs) → Task 1. Journal unchanged (asserted). Today's 3 dynamic states → Task 1 Step 7.
- Item 2 (RecentSubmissions: filter unreflected+in_progress, de-dupe banner, sort newest-first, cap 10, overflow link, empty state) → Task 2 (component) + Task 3 (wiring + TodayBuckets retirement).
- Testing (structural source-scan, existing suite stays green) → Task 1/2 (new suite) + Task 3 (redesign suite update). Gates incl. `npm run build` → Task 3 Step 6.

**Placeholder scan:** No TBD/TODO. All code blocks are complete and literal.

**Type consistency:** `RecentSubmissions` props `{ submissions: SubmissionItem[]; activeInProgress: ActiveInProgress | null; onRowClick: (item: SubmissionItem) => void }` match the call site in Task 3 Step 3 and the types in `src/components/v2/student/types.ts` (`SubmissionItem`, `ActiveInProgress` both exported). De-dupe key `conversationId === activeInProgress.id` matches the verified shapes (`SubmissionItem.conversationId` = growth_conversation.id; `ActiveInProgress.id` = growth_conversation.id). `CAP`/`slice(0, CAP)` referenced in both the component and its test.

**Note on test count:** Task 3 Step 5 says the redesign suite prints ~123; the exact number is not load-bearing — the gate is **0 failures**. If the printed total differs slightly, that's fine as long as nothing fails.
