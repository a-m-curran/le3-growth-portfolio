# SP2 — /v2/me Preferences Pane + Dual-Role Switcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Tidy the `/v2/me` Preferences card (drop push/email + dead props), make "Data handling preferences" actually work by reusing the existing consent infra (no schema change), re-home the first-visit consent modal into the v2 student flow, and surface the dual-role switcher in the `/v2/me` Account card.

**Architecture:** Extract the privacy-notice body into one shared `DataHandlingNotice` (single source of truth); `DataConsentModal` becomes a thin first-visit wrapper around it and is re-homed into the v2 (student) layout; `/v2/me` gets a working review-modal data-handling control + the `dualRole`-gated `RoleSwitcher` in its Account card. No schema/API change; reuses existing `acknowledge-consent` GET/POST and PR #7's `RoleSwitcher`/`getV2Identity`.

**Tech Stack:** Next.js App Router (client components, server layout mounting a client modal), React `useState`/`useEffect`, TypeScript, Tailwind, standalone `tsx` structural tests.

---

## Pre-flight (executor reads first)

- **Branch base:** NEW worktree `.worktrees/v2-me-preferences` off **current `main`** (HEAD `257f239`+). Do NOT touch sibling worktrees (`conversation-validator`, `conversation-v2-enablement`, `v2-dual-role`, `v2-cutover`).
- **Copy `.env.local` into the worktree** (gitignored, uncommitted) for a faithful `npm run build`.
- **CROSS-CUTTING SEQUENCING (load-bearing):** SP1 (`docs/superpowers/plans/2026-05-18-v2-cutover.md`) replaces `src/app/garden/page.tsx` (which currently mounts `<DataConsentModal />`) with a redirect stub — removing the only mount of the first-visit notice. **This SP2 plan re-homes `DataConsentModal` into `src/app/v2/(student)/layout.tsx`.** Therefore **SP2 must merge before (or together with) SP1.** No file overlap with SP1 (SP1 = v1 pages/root/callback/login; SP2 = `/v2/me`, the v2 (student) layout, the consent components) so the two PRs merge cleanly in that order. SP3 is fully independent.
- **Gates:** `npx tsc --noEmit` 0; `npx eslint --no-eslintrc --config .eslintrc.json <files>` clean (NOT `npx next lint`); `npm run build` 0.
- **Tests:** structural source-scan `npx tsx scripts/test-v2-me-preferences.ts`; harness exports `assertEqual`/`section`/`finish` (no `bootstrapTestEnv`).
- Shell cwd may reset to `/Users/andrewcurran/LE3MVP` — use absolute paths / `git -C` / `cd <worktree> &&`.
- **UNCHANGED:** `student` schema / migration 016; `GET/POST /api/student/acknowledge-consent`; `POST /api/v2/switch-role`; `getV2Identity`; the sidebar `RoleSwitcher` mechanism in `AppShell`; demo-as.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/test-v2-me-preferences.ts` (create) | Structural invariants | 1–4 |
| `src/components/student/DataHandlingNotice.tsx` (create) | Single-source privacy-notice body (presentational) | 1 |
| `src/components/student/DataConsentModal.tsx` (refactor) | Thin first-visit wrapper around the shared notice | 2 |
| `src/app/v2/(student)/layout.tsx` (modify) | Re-home: mount `DataConsentModal` | 2 |
| `src/app/v2/me/page.tsx` (modify) | Pass `dualRole` to `AppShell` + `MeView` | 3 |
| `src/app/v2/me/MeView.tsx` (rewrite) | Tidy pane; working data-handling control; Account-card switcher | 3,4 |
| (none) | Final verification + DoD runbook | 5 |

---

## Task 1: Extract `DataHandlingNotice` (shared notice body)

**Files:** Create `src/components/student/DataHandlingNotice.tsx`; Create `scripts/test-v2-me-preferences.ts`.

`DataHandlingNotice` is **presentational only** — the exact notice body currently inline in `DataConsentModal` (the intro + the three `<h3>` sections + the footer line). No heading (consumers supply their own framing), no fetch, no action. This makes the privacy text single-sourced.

- [ ] **Step 1: Create the failing structural test**

Create `scripts/test-v2-me-preferences.ts`:

```ts
/**
 * Structural invariants for SP2 (/v2/me preferences + dual-role).
 * Components can't run under tsx; comment-stripped source scan.
 * USAGE: npx tsx scripts/test-v2-me-preferences.ts
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

section('SP2: DataHandlingNotice extracted (single source of truth)')
{
  const dhn = read('src/components/student/DataHandlingNotice.tsx')
  assertEqual(/export function DataHandlingNotice/.test(dhn), true, 'DataHandlingNotice exported')
  assertEqual(/What we bring in from Brightspace/.test(dhn), true, 'notice body present (Brightspace section)')
  assertEqual(/What we don.t do/.test(dhn), true, 'notice body present (what we don’t do)')
  assertEqual(/AI in the conversations/.test(dhn), true, 'notice body present (AI section)')
}

// Task 2 appends its section here.
finish()
```

- [ ] **Step 2: Run — verify it FAILS**

`cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/v2-me-preferences && npx tsx scripts/test-v2-me-preferences.ts` → FAIL (file missing).

- [ ] **Step 3: Create `src/components/student/DataHandlingNotice.tsx`**

```tsx
/**
 * The data-handling notice body — single source of truth for what we
 * pull from Brightspace, what we don't do, and the AI explanation.
 * Presentational only: no heading, no fetch, no action. Consumers
 * (the first-visit DataConsentModal; the /v2/me review modal) supply
 * their own framing + actions around it.
 */
export function DataHandlingNotice() {
  return (
    <>
      <p className="text-sm text-gray-700 mb-3">
        Here&rsquo;s what we want you to know about how this works.
      </p>

      <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-2">
        What we bring in from Brightspace
      </h3>
      <p className="text-sm text-gray-700 mb-2">
        To help you reflect on your actual work, we automatically pull a few
        things from your LE3 courses on D2L Brightspace:
      </p>
      <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1 mb-3">
        <li>
          Your enrollment in LE3 courses (the course names you&rsquo;re
          taking)
        </li>
        <li>
          Assignments your instructors have set up — title, instructions,
          and due date
        </li>
        <li>
          Files you&rsquo;ve submitted to those assignments. We extract
          text from those files so we can reference them in conversations
          with you.
        </li>
        <li>
          Grades and feedback your instructors provided on those
          submissions
        </li>
        <li>Your name and email (the same ones D2L has)</li>
      </ul>

      <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-2">
        What we don&rsquo;t do
      </h3>
      <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1 mb-3">
        <li>We don&rsquo;t share your reflections with other students</li>
        <li>
          We don&rsquo;t send your work to instructors — only your assigned
          LE3 coach sees what you write here
        </li>
        <li>We don&rsquo;t use your work to train external AI models</li>
      </ul>

      <h3 className="text-sm font-semibold text-gray-900 mt-4 mb-2">
        AI in the conversations
      </h3>
      <p className="text-sm text-gray-700 mb-3">
        The reflective questions you&rsquo;ll see are generated by an AI
        model that reads your submitted work and your previous responses.
        It does not replace your coach — it helps you think out loud
        before you meet with them.
      </p>

      <p className="text-[11px] text-gray-400 mt-3 text-center">
        Questions about your data? Reach out to your LE3 coach.
      </p>
    </>
  )
}
```

- [ ] **Step 4: Run — verify it PASSES**

`npx tsx scripts/test-v2-me-preferences.ts` → PASS.

- [ ] **Step 5: tsc + lint**

`npx tsc --noEmit` → 0; `npx eslint --no-eslintrc --config .eslintrc.json src/components/student/DataHandlingNotice.tsx scripts/test-v2-me-preferences.ts` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/student/DataHandlingNotice.tsx scripts/test-v2-me-preferences.ts
git commit -m "$(cat <<'EOF'
me-prefs: extract DataHandlingNotice (single-source privacy notice body)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Refactor `DataConsentModal` to reuse the notice + re-home into v2

**Files:** Modify `src/components/student/DataConsentModal.tsx`; Modify `src/app/v2/(student)/layout.tsx`; Modify `scripts/test-v2-me-preferences.ts`.

First-visit UX is **unchanged**: same GET-status fetch, same `if (!status || status.acknowledged) return null` gate, same POST acknowledge, same modal chrome — only the notice body is now `<DataHandlingNotice/>`. Then mount it in the v2 (student) layout so it survives SP1 retiring `/garden`.

- [ ] **Step 1: Add the failing structural section**

Replace `// Task 2 appends its section here.` with:

```ts
section('SP2: DataConsentModal reuses DataHandlingNotice + re-homed to v2')
{
  const dcm = read('src/components/student/DataConsentModal.tsx')
  assertEqual(/import \{ DataHandlingNotice \} from '\.\/DataHandlingNotice'/.test(dcm), true, 'DataConsentModal imports DataHandlingNotice')
  assertEqual(/<DataHandlingNotice\s*\/>/.test(dcm), true, 'DataConsentModal renders the shared notice')
  assertEqual(/if \(!status \|\| status\.acknowledged\) return null/.test(dcm), true, 'first-visit gate unchanged')
  assertEqual(/acknowledge-consent/.test(dcm) && /method: 'POST'/.test(dcm), true, 'acknowledge POST preserved')
  const layout = read('src/app/v2/(student)/layout.tsx')
  assertEqual(/import \{ DataConsentModal \} from '@\/components\/student\/DataConsentModal'/.test(layout), true, 'student layout imports DataConsentModal')
  assertEqual(/<DataConsentModal\s*\/>/.test(layout), true, 'student layout mounts DataConsentModal (re-homed from v1 /garden)')
}

// Task 3 appends its section here.
```

- [ ] **Step 2: Run — verify it FAILS**

`npx tsx scripts/test-v2-me-preferences.ts` → FAIL.

- [ ] **Step 3: Refactor `src/components/student/DataConsentModal.tsx`**

Replace the ENTIRE file with (status fetch/gate/POST/chrome preserved; body → shared component; the first-visit "Welcome" header + acknowledge button + error stay in the wrapper):

```tsx
'use client'

import { useEffect, useState } from 'react'
import { DataHandlingNotice } from './DataHandlingNotice'

/**
 * One-time data-handling notice shown to students on their first v2
 * visit. Self-gating: decides whether to render based on
 * /api/student/acknowledge-consent. Non-students and already-
 * acknowledged students see nothing. Notice body is the shared
 * DataHandlingNotice (single source of truth).
 *
 * Not a legal-grade consent flow. Doesn't gate access. Purpose is
 * "no surprises the first time you see your D2L work appear" + an
 * auditable timestamp on the student row.
 */

interface ConsentStatus {
  acknowledged: boolean
  acknowledgedAt: string | null
}

export function DataConsentModal() {
  const [status, setStatus] = useState<ConsentStatus | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/acknowledge-consent', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: ConsentStatus) => {
        if (!cancelled) setStatus(j)
      })
      .catch(() => {
        if (!cancelled) setStatus({ acknowledged: true, acknowledgedAt: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // While loading, OR if already acknowledged, render nothing.
  if (!status || status.acknowledged) return null

  const handleAcknowledge = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/student/acknowledge-consent', {
        method: 'POST',
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const j = (await res.json()) as { acknowledgedAt: string }
      setStatus({ acknowledged: true, acknowledgedAt: j.acknowledgedAt })
    } catch (e) {
      setError(String(e))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🌱</span>
          <h2 className="text-lg font-bold text-green-900">
            Welcome to your Growth Portfolio
          </h2>
        </div>

        <DataHandlingNotice />

        {error && (
          <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800">
            Couldn&rsquo;t record acknowledgement: {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving…' : 'I understand — let’s go'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Re-home into the v2 (student) layout**

`src/app/v2/(student)/layout.tsx` currently ends:

```tsx
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/v2/AppShell'
import { getV2Identity } from '@/lib/v2-auth'
```
…
```tsx
  return (
    <AppShell role="student" userName={identity.name} userSubLabel={subLabel} dualRole={identity.dualRole}>
      {children}
    </AppShell>
  )
}
```

Add the import after the existing imports (new line 4):

```tsx
import { DataConsentModal } from '@/components/student/DataConsentModal'
```

And change the returned JSX to mount the modal inside the shell (self-gating makes a layout-level mount safe — it renders nothing for non-students/acknowledged):

```tsx
  return (
    <AppShell role="student" userName={identity.name} userSubLabel={subLabel} dualRole={identity.dualRole}>
      {children}
      <DataConsentModal />
    </AppShell>
  )
}
```

(Change ONLY the import block + the `<AppShell>…</AppShell>` body; leave the identity resolution / redirects / `subLabel` untouched.)

- [ ] **Step 5: Run — verify it PASSES**

`npx tsx scripts/test-v2-me-preferences.ts` → PASS.

- [ ] **Step 6: tsc + lint + build**

`npx tsc --noEmit` → 0; `npx eslint --no-eslintrc --config .eslintrc.json src/components/student/DataConsentModal.tsx "src/app/v2/(student)/layout.tsx" scripts/test-v2-me-preferences.ts` → clean; `npm run build` → 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/student/DataConsentModal.tsx "src/app/v2/(student)/layout.tsx" scripts/test-v2-me-preferences.ts
git commit -m "$(cat <<'EOF'
me-prefs: DataConsentModal reuses DataHandlingNotice; re-homed to v2

First-visit UX unchanged (same status gate + acknowledge POST). Mounted
in the v2 (student) layout so SP1 retiring /garden doesn't orphan the
first-visit notice. Self-gating keeps it safe at layout scope.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Tidy MeView + working data-handling control + pass `dualRole`

**Files:** Modify `src/app/v2/me/page.tsx`; Rewrite `src/app/v2/me/MeView.tsx`; Modify `scripts/test-v2-me-preferences.ts`.

- [ ] **Step 1: Add the failing structural section**

Replace `// Task 3 appends its section here.` with:

```ts
section('SP2: /v2/me passes dualRole; MeView tidied + data-handling works')
{
  const page = read('src/app/v2/me/page.tsx')
  assertEqual(/dualRole=\{identity\.dualRole\}/.test(page), true, 'page passes dualRole')
  const mv = read('src/app/v2/me/MeView.tsx')
  assertEqual(/Email notifications/.test(mv), false, 'Email notifications row removed')
  assertEqual(/Push notifications/.test(mv), false, 'Push notifications row removed')
  assertEqual(/nluId|programStartDate/.test(mv), false, 'dead nluId/programStartDate props removed')
  assertEqual(/dualRole/.test(mv), true, 'MeView takes dualRole')
  assertEqual(/DataHandlingNotice/.test(mv) && /from '@\/components\/student\/DataHandlingNotice'/.test(mv), true, 'MeView opens the shared notice')
  assertEqual(/acknowledge-consent/.test(mv), true, 'MeView reads acknowledgement state')
  assertEqual(/RoleSwitcher/.test(mv) && /from '@\/components\/v2\/RoleSwitcher'/.test(mv), true, 'MeView reuses RoleSwitcher')
}
```

(This is the LAST section — `finish()` already follows from the Task 1 scaffold. Do not add another.)

- [ ] **Step 2: Run — verify it FAILS**

`npx tsx scripts/test-v2-me-preferences.ts` → FAIL.

- [ ] **Step 3: Edit `src/app/v2/me/page.tsx`**

The `<AppShell>` opening tag (lines 25–30) is currently:
```tsx
    <AppShell
      role={identity.role}
      userName={identity.name}
      userSubLabel={identity.role === 'coach' ? 'Coach' : identity.cohort}
      showAdmin={showAdmin}
    >
```
Replace with (add the one prop):
```tsx
    <AppShell
      role={identity.role}
      userName={identity.name}
      userSubLabel={identity.role === 'coach' ? 'Coach' : identity.cohort}
      showAdmin={showAdmin}
      dualRole={identity.dualRole}
    >
```
The coach `<MeView>` (lines 32–37) currently:
```tsx
        <MeView
          kind="coach"
          name={identity.name}
          email={identity.email}
          meta="Active coach"
        />
```
→
```tsx
        <MeView
          kind="coach"
          name={identity.name}
          email={identity.email}
          meta="Active coach"
          dualRole={identity.dualRole}
        />
```
The student `<MeView>` (lines 39–44) currently:
```tsx
        <MeView
          kind="student"
          name={identity.name}
          email={identity.email}
          meta={identity.cohort || 'No cohort assigned'}
        />
```
→
```tsx
        <MeView
          kind="student"
          name={identity.name}
          email={identity.email}
          meta={identity.cohort || 'No cohort assigned'}
          dualRole={identity.dualRole}
        />
```
Change nothing else in `page.tsx`.

- [ ] **Step 4: Rewrite `src/app/v2/me/MeView.tsx`**

Replace the ENTIRE file with (removes `nluId`/`programStartDate` + the sub-grid + `Field`/`PrefRow`; adds `dualRole`; student-only Preferences card with a working data-handling review-modal control + ack-state; Account-card `dualRole`-gated `RoleSwitcher`; `Card`/`SectionHeader`/`initials` kept):

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { DataHandlingNotice } from '@/components/student/DataHandlingNotice'
import { RoleSwitcher } from '@/components/v2/RoleSwitcher'

interface MeViewProps {
  kind: 'student' | 'coach'
  name: string
  email: string
  meta: string
  /** True iff this auth_user_id owns both a coach and a student row */
  dualRole?: boolean
}

interface ConsentStatus {
  acknowledged: boolean
  acknowledgedAt: string | null
}

export function MeView({ kind, name, email, meta, dualRole = false }: MeViewProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
      {/* Identity */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-xl font-semibold">
            {initials(name)}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{name}</h1>
            <p className="text-sm text-gray-500 truncate">{email}</p>
            <p className="text-xs text-gray-400 mt-0.5">{meta}</p>
          </div>
        </div>
      </Card>

      {/* Preferences — student-only (the data-handling notice is about
          student data ingestion; nothing else lives here for now). */}
      {kind === 'student' && (
        <Card>
          <SectionHeader title="Preferences" />
          <DataHandlingPref />
        </Card>
      )}

      {/* Account */}
      <Card>
        <SectionHeader title="Account" />
        {dualRole && (
          <div className="mb-2">
            <RoleSwitcher role={kind} />
          </div>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-700 hover:bg-red-50 transition-colors"
        >
          Sign out
        </button>
      </Card>

      <p className="text-[11px] text-gray-400 text-center">
        Questions about your data?{' '}
        {kind === 'student' ? 'Reach out to your LE3 coach.' : 'Contact NLU IT support.'}
      </p>
    </div>
  )
}

/**
 * Working "Data handling" control: shows acknowledgement state from
 * GET /api/student/acknowledge-consent and opens the shared notice in
 * a review modal (viewable anytime). If not yet acknowledged, the
 * modal offers the acknowledge action (idempotent POST).
 */
function DataHandlingPref() {
  const [status, setStatus] = useState<ConsentStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/acknowledge-consent', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: ConsentStatus) => {
        if (!cancelled) setStatus(j)
      })
      .catch(() => {
        if (!cancelled) setStatus({ acknowledged: false, acknowledgedAt: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const stateLabel = !status
    ? 'Loading…'
    : status.acknowledged && status.acknowledgedAt
    ? `Acknowledged ${new Date(status.acknowledgedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : status.acknowledged
    ? 'Acknowledged'
    : 'Not yet acknowledged'

  const handleAcknowledge = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/student/acknowledge-consent', { method: 'POST' })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const j = (await res.json()) as { acknowledgedAt: string }
      setStatus({ acknowledged: true, acknowledgedAt: j.acknowledgedAt })
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between py-2">
        <div className="min-w-0">
          <p className="text-sm text-gray-700">Data handling</p>
          <p className="text-xs text-gray-400 mt-0.5">{stateLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-green-800 hover:text-green-900 hover:underline shrink-0"
        >
          View notice
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-bold text-green-900">Data handling</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-700 text-sm"
              >
                Close
              </button>
            </div>

            <DataHandlingNotice />

            {error && (
              <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800">
                Couldn&rsquo;t record acknowledgement: {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              {status && !status.acknowledged && (
                <button
                  type="button"
                  onClick={handleAcknowledge}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Saving…' : 'I understand'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">{children}</div>
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() || '')
    .join('')
}
```

- [ ] **Step 5: Run — verify it PASSES**

`npx tsx scripts/test-v2-me-preferences.ts` → PASS, all sections green.

- [ ] **Step 6: tsc + lint + build**

`npx tsc --noEmit` → 0; `npx eslint --no-eslintrc --config .eslintrc.json "src/app/v2/me/page.tsx" "src/app/v2/me/MeView.tsx" scripts/test-v2-me-preferences.ts` → clean; `npm run build` → 0.

- [ ] **Step 7: Commit**

```bash
git add "src/app/v2/me/page.tsx" "src/app/v2/me/MeView.tsx" scripts/test-v2-me-preferences.ts
git commit -m "$(cat <<'EOF'
me-prefs: tidy MeView; working data-handling control; dual-role switcher

Drops Email/Push stubs + dead nluId/programStartDate. Student-only
Preferences card with a real data-handling control (ack-state from GET,
review modal reusing DataHandlingNotice, acknowledge via POST). Account
card gains a dualRole-gated RoleSwitcher; /v2/me now passes dualRole to
AppShell (fixes the flagged Minor) + MeView. No empty card for coaches.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: (folded into Task 3) — no separate task

The dual-role switcher and the `dualRole` plumbing are implemented in Task 3 (the rewrite + page.tsx edit) and asserted by the Task 3 structural section. No additional task.

---

## Task 5: Final verification + DoD runbook

**Files:** none.

- [ ] **Step 1: Full automated sweep — all green:**
  - `npx tsc --noEmit` → 0
  - `npx eslint --no-eslintrc --config .eslintrc.json src/components/student/DataHandlingNotice.tsx src/components/student/DataConsentModal.tsx "src/app/v2/(student)/layout.tsx" "src/app/v2/me/page.tsx" "src/app/v2/me/MeView.tsx" scripts/test-v2-me-preferences.ts` → clean
  - `npx tsx scripts/test-v2-me-preferences.ts` → all sections, `N passed, 0 failed`
  - `npm run build` → 0

- [ ] **Step 2: Manual DoD runbook** (owner-run against the deployed PR; document in Step 3; do NOT fabricate):
  1. Student `/v2/me`: Preferences card shows only "Data handling" with an ack-state line; "View notice" opens the review modal (the shared notice); close works; no Email/Push rows; no NLU-ID/Program-started sub-grid.
  2. A student who hasn't acknowledged: the review modal shows "I understand" → click → state line flips to "Acknowledged <date>"; reopening shows no acknowledge button.
  3. A brand-new student lands in the v2 student flow → the first-visit `DataConsentModal` still appears (re-homed into the (student) layout; **requires this SP2 merged with/before SP1**).
  4. Coach `/v2/me`: no Preferences card at all (no empty card).
  5. With a dual-role account (the `DUALROLE-ANDREW` runbook from PR #7's verification commit): Account card shows "Switch to Student/Coach" and flips role; the sidebar switcher now also shows on `/v2/me` (the `dualRole` Minor is fixed). A single-role account shows no switcher anywhere.

- [ ] **Step 3: Commit the verification record**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
me-prefs: verification record

Automated: tsc 0, eslint clean, structural test green, build 0.
Manual DoD: <fill with real results>.

SEQUENCING: merge this SP2 with/before SP1 (it re-homes the first-visit
DataConsentModal that SP1's /garden retirement would otherwise orphan).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:** DataHandlingNotice extracted (T1) ✓; DataConsentModal thin wrapper, first-visit unchanged (T2) ✓; re-homed into v2 (student) layout (T2) ✓; /v2/me passes dualRole to AppShell+MeView (T3) ✓; MeView: notif rows + dead props removed, student-only Preferences card, working data-handling review modal + ack state + acknowledge POST, coach has no Preferences card, Account-card dualRole-gated RoleSwitcher (T3) ✓; no schema/API change ✓; UNCHANGED list honored ✓; SP1↔SP2 sequencing in Pre-flight + T5 ✓.
**2. Placeholder scan:** no TBD; the T5 `<fill with real results>` is the deliberate honest-runbook slot. Every code step has the full file/edit verbatim.
**3. Type consistency:** `ConsentStatus { acknowledged: boolean; acknowledgedAt: string|null }` consistent in DataConsentModal and MeView; `MeViewProps.dualRole?: boolean`; `RoleSwitcher` invoked as `<RoleSwitcher role={kind} />` matching its `{ role: 'student'|'coach' }` signature; `kind` is the active role (no redundant `role` prop); page.tsx passes `dualRole={identity.dualRole}` (V2Identity has `dualRole: boolean` on both variants per PR #7). `Field`/`PrefRow` deleted (now-unused) — no dangling refs; `Card`/`SectionHeader`/`initials` retained and used. Single `finish()` (Task 1 scaffold; Tasks 2–3 insert sections above it).

---

## Execution Handoff

Subagent-driven, fresh worktree `.worktrees/v2-me-preferences` off `main`. **Merge before/with SP1.** Own PR.
