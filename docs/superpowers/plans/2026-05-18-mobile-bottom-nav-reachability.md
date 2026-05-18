# SP3 — Mobile Bottom-Nav Reachability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Stop the mobile bottom tab bar silently dropping nav items past the 5th — guarantee every item (notably student "Career" and "Me") is reachable via a "More" overflow sheet — without changing the nav inventory or the desktop sidebar.

**Architecture:** Single-component fix in `BottomTabBar.tsx`: when the post-admin-filter item count is ≤5 render exactly as today; when >5 render the first 4 + a "More" tab that toggles a dismissable bottom sheet listing the rest. Plus one new `MoreIcon`. `nav-config.ts` and the desktop `Sidebar` are untouched.

**Tech Stack:** Next.js App Router (client component, `useState`), `next/link`, Tailwind, standalone `tsx` structural test.

---

## Pre-flight (executor reads first)

- **Branch base:** NEW worktree `.worktrees/mobile-bottom-nav` off **current `main`** (HEAD `257f239`+). Do NOT touch sibling worktrees (`conversation-validator`, `conversation-v2-enablement`, `v2-dual-role`, `v2-cutover`, `v2-me-preferences`).
- **Fully independent of SP1/SP2** — touches only `src/components/v2/BottomTabBar.tsx` + `src/components/v2/icons.tsx`. Zero file overlap; merge order vs SP1/SP2 doesn't matter. Own PR.
- **Copy `.env.local` into the worktree** (gitignored, uncommitted) for a faithful `npm run build`.
- **Gates:** `npx tsc --noEmit` 0; `npx eslint --no-eslintrc --config .eslintrc.json <files>` clean (NOT `npx next lint`); `npm run build` 0.
- **Tests:** structural source-scan `npx tsx scripts/test-mobile-bottom-nav.ts`; harness exports `assertEqual`/`section`/`finish` (no `bootstrapTestEnv`).
- Shell cwd may reset to `/Users/andrewcurran/LE3MVP` — use absolute paths / `git -C` / `cd <worktree> &&`.
- **UNCHANGED:** `src/components/v2/nav-config.ts`; `src/components/v2/Sidebar.tsx`; `AppShell`; all routes. Renderer-only fix.

## Recon (verified, on main)

- `BottomTabBar.tsx:24` is `const visibleItems = items.filter(i => !i.admin || showAdmin).slice(0, 5)` — items 6+ silently discarded. `STUDENT_NAV` has 7 (today,growth,reflect,journal,narrative,career,me) → career & me dropped. `COACH_NAV` ≤5 post-filter (admin 5 / non-admin 3) → unaffected.
- Icons in `src/components/v2/icons.tsx` are `export function XIcon({ className }: IconProps) { return (<svg {...baseProps(className)}>…</svg>) }`; shared `interface IconProps { className?: string }` + `baseProps(className)` (sets `fill:'none', stroke:'currentColor'`). No `MoreIcon` yet.
- `activeNavKey(path, items)` (nav-config) returns the matched item `key` or null.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/test-mobile-bottom-nav.ts` (create) | Structural invariants | 1,2 |
| `src/components/v2/icons.tsx` (modify) | Add `MoreIcon` | 1 |
| `src/components/v2/BottomTabBar.tsx` (rewrite) | ≤5 unchanged; >5 → 4 + "More" sheet | 2 |
| (none) | Final verification + DoD runbook | 3 |

---

## Task 1: Add `MoreIcon` + structural test scaffold

**Files:** Create `scripts/test-mobile-bottom-nav.ts`; Modify `src/components/v2/icons.tsx`.

- [ ] **Step 1: Create the failing structural test**

Create `scripts/test-mobile-bottom-nav.ts`:

```ts
/**
 * Structural invariants for SP3 (mobile bottom-nav reachability).
 * Components can't run under tsx; comment-stripped source scan.
 * USAGE: npx tsx scripts/test-mobile-bottom-nav.ts
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

section('SP3: MoreIcon added to icons.tsx')
{
  const icons = read('src/components/v2/icons.tsx')
  assertEqual(/export function MoreIcon\(\{ className \}: IconProps\)/.test(icons), true, 'MoreIcon exported with the IconProps signature')
  assertEqual(/baseProps\(className\)/.test(stripComments(icons).split('MoreIcon')[1] || ''), true, 'MoreIcon uses baseProps like its siblings')
}

// Task 2 appends its section here.
finish()
```

- [ ] **Step 2: Run — verify it FAILS**

`cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/mobile-bottom-nav && npx tsx scripts/test-mobile-bottom-nav.ts` → FAIL (no MoreIcon).

- [ ] **Step 3: Append `MoreIcon` to `src/components/v2/icons.tsx`**

Append this function at the END of `src/components/v2/icons.tsx` (after the last existing icon, before EOF — do not modify any existing icon or the `IconProps`/`baseProps` block):

```tsx

export function MoreIcon({ className }: IconProps) {
  return (
    <svg {...baseProps(className)}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
```

(Horizontal ellipsis. `baseProps` sets `fill:'none', stroke:'currentColor'` on the `<svg>`; each circle overrides with `fill="currentColor" stroke="none"` so the dots render solid — consistent with the file's `function XIcon({ className }: IconProps)` + `baseProps(className)` pattern.)

- [ ] **Step 4: Run — verify it PASSES**

`npx tsx scripts/test-mobile-bottom-nav.ts` → PASS.

- [ ] **Step 5: tsc + lint**

`npx tsc --noEmit` → 0; `npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/icons.tsx scripts/test-mobile-bottom-nav.ts` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/v2/icons.tsx scripts/test-mobile-bottom-nav.ts
git commit -m "$(cat <<'EOF'
mobile-nav: add MoreIcon (horizontal ellipsis) + test scaffold

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Rework `BottomTabBar` — ≤5 unchanged, >5 → 4 + "More" sheet

**Files:** Rewrite `src/components/v2/BottomTabBar.tsx`; Modify `scripts/test-mobile-bottom-nav.ts`.

- [ ] **Step 1: Add the failing structural section**

Replace `// Task 2 appends its section here.` with:

```ts
section('SP3: BottomTabBar >5 → 4 + More overflow sheet; ≤5 unchanged')
{
  const code = stripComments(read('src/components/v2/BottomTabBar.tsx'))
  // The silent hard-truncation must be gone:
  assertEqual(/\.slice\(0,\s*5\)/.test(code), false, 'no .slice(0,5) hard truncation')
  // ≤5 passthrough + >5 split present:
  assertEqual(/filter\(i => !i\.admin \|\| showAdmin\)/.test(code), true, 'admin filter preserved')
  assertEqual(/length <= 5/.test(code) || /length > 5/.test(code), true, 'has the ≤5 / >5 branch')
  assertEqual(/slice\(0,\s*4\)/.test(code) && /slice\(4\)/.test(code), true, 'primary = first 4, overflow = rest')
  assertEqual(/MoreIcon/.test(code) && /from '\.\/icons'/.test(code), true, 'imports + uses MoreIcon')
  assertEqual(/useState/.test(code), true, 'sheet open/close state')
  assertEqual(/activeNavKey/.test(code), true, 'active-state via activeNavKey preserved')
}
```

(LAST section — `finish()` already follows from Task 1's scaffold; do not add another.)

- [ ] **Step 2: Run — verify it FAILS**

`npx tsx scripts/test-mobile-bottom-nav.ts` → FAIL.

- [ ] **Step 3: Rewrite `src/components/v2/BottomTabBar.tsx`**

Replace the ENTIRE file with:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { activeNavKey, type NavItem } from './nav-config'
import { MoreIcon } from './icons'

interface BottomTabBarProps {
  items: NavItem[]
  showAdmin?: boolean
}

/**
 * Mobile bottom tab bar (visible only below md, <768px).
 *
 * If the role-specific nav (after the admin filter) is ≤5 items, all
 * render exactly as before. If >5, the first 4 render as tabs and a
 * 5th "More" tab opens a dismissable sheet with the overflow — so
 * every item (e.g. student Career/Me) stays reachable. Primary vs
 * overflow is deterministic by nav-config order. The desktop Sidebar
 * (no cap) is unaffected.
 *
 * Safe-area-inset-bottom for iOS PWAs once we add a manifest.
 */
export function BottomTabBar({ items, showAdmin = false }: BottomTabBarProps) {
  const pathname = usePathname()
  const activeKey = activeNavKey(pathname, items)
  const [moreOpen, setMoreOpen] = useState(false)

  const filtered = items.filter(i => !i.admin || showAdmin)

  // ≤5: render all, exactly as before (no "More").
  if (filtered.length <= 5) {
    return (
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {filtered.map(item => (
          <TabLink key={item.key} item={item} active={item.key === activeKey} />
        ))}
      </nav>
    )
  }

  // >5: first 4 tabs + a "More" tab opening an overflow sheet.
  const primary = filtered.slice(0, 4)
  const overflow = filtered.slice(4)
  const overflowActive = overflow.some(i => i.key === activeKey)

  return (
    <>
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white border-t border-gray-200 rounded-t-2xl shadow-xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="text-sm text-gray-400 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <ul className="py-1">
              {overflow.map(item => {
                const Icon = item.icon
                const isActive = item.key === activeKey
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        isActive
                          ? 'text-green-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {primary.map(item => (
          <TabLink key={item.key} item={item} active={item.key === activeKey} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(o => !o)}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
            moreOpen || overflowActive
              ? 'text-green-700'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <MoreIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </>
  )
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
        active ? 'text-green-700' : 'text-gray-400 hover:text-gray-700'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium">{item.label}</span>
    </Link>
  )
}
```

(The ≤5 branch reproduces the prior markup exactly via `TabLink` — coach and any ≤5 role are byte-equivalent. The sheet + backdrop are `md:hidden` so desktop is unaffected. "More" is a `<button>` toggling state, not a `<Link>`. Active overflow item → "More" shows active.)

- [ ] **Step 4: Run — verify it PASSES**

`npx tsx scripts/test-mobile-bottom-nav.ts` → PASS, all sections green.

- [ ] **Step 5: tsc + lint + build**

`npx tsc --noEmit` → 0; `npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/BottomTabBar.tsx scripts/test-mobile-bottom-nav.ts` → clean; `npm run build` → 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/v2/BottomTabBar.tsx scripts/test-mobile-bottom-nav.ts
git commit -m "$(cat <<'EOF'
mobile-nav: >5 nav → first 4 + "More" overflow sheet (≤5 unchanged)

Fixes student Career/Me being silently dropped by the old
.slice(0,5). Coach (≤5) byte-unchanged; nav-config + desktop Sidebar
untouched; deterministic primary = first 4 by nav-config order.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Final verification + DoD runbook

**Files:** none.

- [ ] **Step 1: Full automated sweep — all green:**
  - `npx tsc --noEmit` → 0
  - `npx eslint --no-eslintrc --config .eslintrc.json src/components/v2/BottomTabBar.tsx src/components/v2/icons.tsx scripts/test-mobile-bottom-nav.ts` → clean
  - `npx tsx scripts/test-mobile-bottom-nav.ts` → all sections, `N passed, 0 failed`
  - `npm run build` → 0
  - `grep -n "slice(0, 5)\|slice(0,5)" src/components/v2/BottomTabBar.tsx` → no output (the silent truncation is gone)
  - Confirm UNCHANGED: `git -C <worktree> diff main --name-only` lists ONLY `src/components/v2/BottomTabBar.tsx`, `src/components/v2/icons.tsx`, `scripts/test-mobile-bottom-nav.ts` (nav-config.ts / Sidebar.tsx / AppShell NOT in the diff).

- [ ] **Step 2: Manual DoD runbook** (owner-run against the deployed PR; document in Step 3; do NOT fabricate):
  1. Narrow viewport (<768px), student account: bottom bar shows Today, Growth, Reflect, Journal, **More**.
  2. Tap "More" → sheet lists **Narrative, Career, Me**; tapping any navigates and closes the sheet; backdrop tap and "Close" both dismiss.
  3. Navigate to `/v2/career` (via More) → bottom bar shows "More" in the active (green) style.
  4. Coach account on mobile: bottom bar unchanged (≤5; no "More" tab) — admin coach 5 tabs, non-admin 3.
  5. Desktop (≥768px): sidebar unchanged; the bottom bar / sheet are not visible (`md:hidden`).

- [ ] **Step 3: Commit the verification record**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
mobile-nav: verification record

Automated: tsc 0, eslint clean, structural test green, build 0, diff
scoped to BottomTabBar.tsx + icons.tsx + test. Manual DoD: <fill with
real results>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:** `.slice(0,5)` silent truncation removed (T2) ✓; ≤5 renders all exactly as today (T2 `TabLink` reproduces prior markup) ✓; >5 → first 4 + "More" sheet over `slice(4)` (T2) ✓; deterministic primary=first 4 by nav-config order ✓; "More" active when an overflow item is active ✓; dismissable sheet (backdrop + Close, both `md:hidden`) ✓; `MoreIcon` matching the file's `function/baseProps` pattern (T1) ✓; nav-config.ts / Sidebar.tsx / AppShell untouched (asserted in T3) ✓; coach ≤5 byte-unchanged ✓.
**2. Placeholder scan:** no TBD; the T3 `<fill with real results>` is the deliberate honest-runbook slot. Every code step has the full file/append verbatim.
**3. Type consistency:** `MoreIcon({ className }: IconProps)` matches the existing icon signature (shared `IconProps`, `baseProps(className)`); `NavItem` imported from `./nav-config`; `activeNavKey` used unchanged; `TabLink` helper typed `{ item: NavItem; active: boolean }`; single `finish()` (Task 1 scaffold; Task 2 inserts its section above it).

---

## Execution Handoff

Subagent-driven, fresh worktree `.worktrees/mobile-bottom-nav` off `main`. Fully independent — own PR, any merge order.
