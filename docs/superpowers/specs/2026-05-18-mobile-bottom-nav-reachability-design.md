# SP3 — Mobile Bottom-Nav Reachability — Design Spec

**Date:** 2026-05-18
**Status:** Approved (design); pending implementation plan
**Owner:** Andrew Curran
**Sub-project:** 3 of 3 (SP1 cutover · SP2 /v2/me preferences · SP3 mobile-nav). Independent; own spec → plan → PR.

## Problem / Goal

On mobile, the v2 bottom tab bar silently drops nav items past the 5th,
so **"Career" and "Me" are unreachable** for students on a phone.

**Goal:** guarantee every nav item is reachable on mobile, via a "More"
overflow tab, without changing the nav inventory or the desktop sidebar.

## Recon facts (verified, read-only, this session)

- `src/components/v2/BottomTabBar.tsx` computes
  `const visibleItems = items.filter(i => !i.admin || showAdmin).slice(0, 5)`
  and renders only those — items 6+ are **silently discarded**.
- `STUDENT_NAV` (`src/components/v2/nav-config.ts`) has **7** items:
  `today, growth, reflect, journal, narrative, career, me`. After the
  (no-op for students) admin filter, `.slice(0,5)` keeps
  `today,growth,reflect,journal,narrative` → **`career` and `me` are
  dropped** on mobile.
- `COACH_NAV` is 5 entries, two `admin:true` (`tools`,`demos`): an admin
  coach has 5 post-filter, a non-admin coach 3 — **always ≤5, unaffected**.
- The component's own comment ("for current student (5) and coach (4)
  navs, everything fits") is **stale** — student nav grew to 7 and the
  promised overflow handling ("goes elsewhere — settings menu") was
  never built.
- The desktop `Sidebar` (`src/components/v2/Sidebar.tsx`) renders the
  full `items` list — **no cap; not affected**. Only `BottomTabBar` has
  the bug.
- `BottomTabBar` is already `'use client'`; `activeNavKey(path, items)`
  exists for active-item matching; `src/components/v2/icons.tsx` holds
  the inline SVG icon components.

## Settled decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Overflow handling | **"More" overflow tab.** If post-admin-filter count > 5: render the first 4 items + a 5th "More" tab opening a sheet with the rest. If ≤5: render all, exactly as today (no "More"). Rejected: show-all condensed/scrollable (cramped, poor discoverability); trim/reprioritize + relocate (ongoing priority calls, second nav location). |
| Primary vs overflow | **Deterministic by `nav-config` order**: primary = `items.slice(0,4)`, overflow = `items.slice(4)`. No per-item priority metadata. (Owner confirmed "good as is" — no item pinned.) |
| Inventory | `nav-config.ts` **unchanged**; desktop `Sidebar` **unchanged**. Renderer-only fix. |

For students this yields: bar = **Today, Growth, Reflect, Journal,
More**; sheet = **Narrative, Career, Me**. Coach: ≤5 → unchanged (no
More). Future-proof: any role that grows >5 auto-gets a "More" tab.

## Architecture

Single-component change in `BottomTabBar.tsx` (the only buggy site) plus
a small overflow sheet and one icon. Pure v2-frontend; no schema, no
API, no nav-config or Sidebar change.

## Components / exact change set

**Modify — `src/components/v2/BottomTabBar.tsx`:**
- Replace the `.slice(0, 5)` truncation with:
  `const filtered = items.filter(i => !i.admin || showAdmin)`; if
  `filtered.length <= 5` → render `filtered` exactly as today (no
  "More"; behavior byte-unchanged for coach and any ≤5 role); else →
  render `filtered.slice(0,4)` as tabs + a 5th **"More"** tab (a
  `button`, not a `Link`) that toggles an overflow sheet listing
  `filtered.slice(4)`.
- Active state: compute `activeKey` via the existing `activeNavKey`. A
  primary item is active as today; if `activeKey` corresponds to an
  overflow item, render the **"More"** tab in the active style (so the
  user sees the current page lives under "More").
- Overflow sheet: a v2-styled bottom sheet (fixed, above the tab bar,
  white, rounded-top, border + subtle shadow, green active accent —
  mirrors `Sidebar` item styling), with a dismissable backdrop and an
  explicit close affordance. Each row is a `Link` (`item.href`) with the
  item icon + label; tapping navigates and closes the sheet
  (`useState` open/closed — component is already `'use client'`).
  May be inline in `BottomTabBar` or a small sibling
  `BottomNavMoreSheet` — implementer's call; keep it one focused unit.
- Update the stale doc-comment to describe the >5 "More" behavior.

**Modify — `src/components/v2/icons.tsx`:**
- Add a `MoreIcon` (horizontal ellipsis / simple "more" glyph) matching
  the existing icon component signature `({ className }) => svg`.

**Explicitly UNCHANGED:** `src/components/v2/nav-config.ts`;
`src/components/v2/Sidebar.tsx`; `AppShell`; every route; the dual-role
switcher (mobile dual-role switching is solved by the SP2+SP3 synergy —
SP3 makes `/v2/me` reachable on mobile and SP2 puts the switcher in the
`/v2/me` Account card; no switcher in the tab bar).

## Data flow

```
nav-config → AppShell passes role `items` → BottomTabBar:
  filtered = items minus admin-gated (unless showAdmin)
  filtered.length <= 5 → render all (UNCHANGED)
  filtered.length  > 5 → tabs = filtered[0..3] + "More"
                          tap "More" → sheet lists filtered[4..]
                          tap sheet item → navigate + close
  active overflow item → "More" tab shows active
Desktop Sidebar path: UNCHANGED (renders full list, no cap)
```

## Error handling / edge cases

- Admin filter runs **before** the >5 split, so the threshold is on the
  post-filter count → correct for every role (admin coach 5 → no More;
  student 7 → 4 + More(3)).
- Sheet must be dismissable (backdrop tap + explicit close) and not trap
  focus/scroll; "More" is a button (toggle), not a navigation link.
- `safe-area-inset-bottom` padding (already present on the bar) must
  also apply so the sheet/bar clear the iOS home indicator.

## Testing / definition of done

- **Structural source-scan:** `BottomTabBar` no longer hard-truncates
  with `.slice(0, 5)` in a way that discards items (the >5 branch
  renders a "More" control and an overflow sheet over `items.slice(4)`);
  `nav-config.ts` and `Sidebar.tsx` are unchanged; `MoreIcon` exists in
  `icons.tsx`.
- `npx tsc --noEmit` 0; eslint clean; `npm run build` 0.
- **Manual (narrow viewport):** student bottom bar = Today/Growth/
  Reflect/Journal/More; tapping "More" reveals Narrative/Career/Me and
  each navigates; on `/v2/career` the bar shows "More" active; coach
  bottom bar unchanged (no "More"); desktop sidebar unchanged; sheet
  dismisses via backdrop + close.

## Rollout

Code-only; no migration. Own PR (separate from SP1/SP2); no file overlap
with them (SP3 = `BottomTabBar.tsx` + `icons.tsx` only). Reversible by
reverting the component.

## Out of scope / non-goals

- Curating which items are primary beyond "first 4 by nav-config order"
  (owner confirmed as-is).
- Any nav-config inventory/ordering change; any desktop Sidebar change.
- Putting the dual-role switcher in the mobile tab bar (solved via
  SP2+SP3).
- SP1 (cutover) and SP2 (/v2/me) — separate specs.
