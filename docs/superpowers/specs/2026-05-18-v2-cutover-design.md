# SP1 — Full v2 Cutover — Design Spec

**Date:** 2026-05-18
**Status:** Approved (design); pending implementation plan
**Owner:** Andrew Curran
**Sub-project:** 1 of 3 (SP1 cutover · SP2 /v2/me preferences · SP3 mobile-nav). Independent; own spec → plan → PR.

## Problem / Goal

After PRs #6/#7 (conversation/reflection v2 enablement + dual-role) merged
to `main`, the v2 surfaces work and **D2L LTI launches already land in v2**
(env-gated `LTI_POST_LAUNCH_STUDENT_PATH` default `/v2/today`,
`LTI_POST_LAUNCH_INSTRUCTOR_PATH` default `/v2/coach`). But the cutover is
only partial:

- The site root `/` still `redirect('/garden')` — **v1** (`src/app/page.tsx`).
- Plain (non-LTI) magic-link login still lands **v1**: `/login` sets
  `emailRedirectTo=/api/auth/callback` with **no `next`**, and the
  callback's no-`next` fallbacks are v1 (`/garden` student, `/coach`
  coach, at the three branch sites).
- v1 surfaces (`/garden`, `/conversation`, `/reflect`, `/coach`, …) are
  not redirected/retired (middleware only auth-gates).
- The logged-out landing visitors see is the current `/login`, not the
  v2 style/feel.

**Goal:** make v2 the surface for every entry path — root URL, plain
magic-link login, and any bookmarked/old v1 URL — and make the logged-out
landing match the v2 look/feel, **without touching middleware, the
auth-gating, or any `/api/lti/*` / `/api/auth/callback` handshake logic.**

## Recon facts this design rests on (verified, read-only, this session)

- `src/app/page.tsx` is exactly `import { redirect } ...; redirect('/garden')`.
- `src/app/v2/page.tsx` already identity-routes: coach→`/v2/coach`,
  student→`/v2/today`, `NEXT_PUBLIC_DEMO_MODE==='true'`→`/v2/demo`, else
  →`/login`. So `/`→`/v2` covers authed + demo + unauth correctly.
- `src/app/api/auth/callback/route.ts` honors a caller-supplied `next`
  (`const nextPath = next && next.startsWith('/') ? next : null`) and
  only falls back to v1 defaults when `nextPath` is null:
  `nextPath || '/coach'` (≈L141), `nextPath || '/garden'` (≈L159),
  `nextPath || '/coach'` (≈L181). **The LTI launch passes an explicit
  `next` (the env-gated v2 path), so it never reaches the fallback** —
  changing only the fallback cannot affect the LTI path.
- v1 page inventory (main): `/career`, `/coach`, `/coach/[studentId]`,
  `/coach/[studentId]/prep`, `/conversation`, `/conversation/[id]`,
  `/demo` + the whole `/demo/*` tree, `/garden`, `/login`,
  `/lti/deep-link`, `/lti/register`, `/narrative`, `/privacy`,
  `/reflect`, `/reflection/new`, `/terms`, `/work/import`,
  `/work/submit`.
- v1 `/reflect` = the open-reflection surface (filters
  `conversationType==='open_reflection'`); v2 open-reflection lives at
  `/v2/journal` (its own doc-comment says so). `/reflection/new` = the
  new-open-reflection composer → also `/v2/journal`. `/v2/reflect` is the
  *work-tied* surface (no v1 path maps to it; the v1 work entry was
  `/conversation`).
- `/login` is a clean green-themed magic-link form (functional, not yet
  the v2 component/style language).

## Settled decisions (from brainstorming)

| Decision | Choice |
|---|---|
| v1 disposition | **Redirect v1 → v2** (no deletion; fully reversible). |
| Mechanism | **Approach A** — a thin per-page server `redirect()` in each v1 `page.tsx`. Rejected: middleware rules (highest-risk file — auth/LTI allowlist lives there); a shared redirect-map module (YAGNI for ~13 static targets). |
| Scope | Core experience surfaces **+ retire the v1 `/demo/*` tree → `/v2/demo`**. Excluded as givens: `/login` (restyled, not redirected), `/privacy`, `/terms`, `/lti/*` (integration — untouchable), `/work/import`, `/work/submit` (no v2 equivalent — left reachable). |
| Root + callback | `/`→`/v2`; auth-callback no-`next` fallback → `/v2` (only the fallback; `nextPath` honoring unchanged → LTI provably unaffected). |
| Logged-out landing | **Restyle `/login`** to the existing v2 visual language (no new landing page). Behavior identical; visual only. |

## Architecture

No new architecture. Three surgical, independently-reversible moves; none
touch middleware, auth-gating, or any LTI/handshake code:

1. Root + auth-callback fallback both point at `/v2` (the single
   identity-routing entry that already exists).
2. Every retired v1 page becomes a thin server component that
   `redirect()`s to its v2 equivalent (params preserved for dynamic
   routes).
3. `/login` is restyled to the v2 look/feel; its auth behavior is
   byte-unchanged.

## Components / exact change set

**Modify — root:**
- `src/app/page.tsx`: `redirect('/garden')` → `redirect('/v2')`.

**Modify — auth callback (fallback only):**
- `src/app/api/auth/callback/route.ts`: at the three sites, change the
  fallback string from `'/coach'`/`'/garden'`/`'/coach'` to `'/v2'`
  (i.e., `nextPath || '/v2'`). **Do not change** `nextPath` derivation,
  the record-linking, the rejection→`/login?error=...` path, or anything
  else. The LTI path supplies `next` and never hits the fallback.

**Modify — v1 pages → thin `redirect()` server components** (one file
each; dynamic routes preserve params via the `params` arg):
- `/garden` → `redirect('/v2')`
- `/coach` → `redirect('/v2/coach')`
- `/coach/[studentId]` → `redirect(\`/v2/coach/${params.studentId}\`)`
- `/coach/[studentId]/prep` → `redirect(\`/v2/coach/${params.studentId}\`)` (no v2 prep route; nearest)
- `/conversation` → `redirect('/v2')`
- `/conversation/[id]` → `redirect(\`/v2/conversation/${params.id}\`)` (deep-link preserved)
- `/reflect` → `redirect('/v2/journal')`
- `/reflection/new` → `redirect('/v2/journal')`
- `/narrative` → `redirect('/v2/narrative')`
- `/career` → `redirect('/v2/career')`
- The entire v1 `/demo/*` tree → `redirect('/v2/demo')`: `/demo`,
  `/demo/career`, `/demo/coach`, `/demo/coach/[studentId]`,
  `/demo/coach/[studentId]/prep`, `/demo/conversation`,
  `/demo/conversation/[id]`, `/demo/garden`, `/demo/narrative`,
  `/demo/reflect`, `/demo/reflection/new`, `/demo/work/import`
  (every one is a flat `redirect('/v2/demo')` — the v1 demo system is
  retired wholesale; the v2 demo entry is `/v2/demo`).

  Each becomes (server component, no `'use client'`), e.g.:
  ```tsx
  import { redirect } from 'next/navigation'
  export default function Page() { redirect('/v2') }
  ```
  or for dynamic routes:
  ```tsx
  import { redirect } from 'next/navigation'
  export default function Page({ params }: { params: { id: string } }) {
    redirect(`/v2/conversation/${params.id}`)
  }
  ```
  Any non-page files colocated with these routes (e.g.
  `ReflectForm.tsx`, `PastReflectionsList.tsx`, `ReflectView`-type
  siblings) are **left in place untouched** — only the route's
  `page.tsx` is replaced with the redirect stub (DRY/reversible; no
  dead-import cleanup needed since the stub imports nothing from them).

**Modify — `/login` restyle:**
- `src/app/login/page.tsx`: apply the established v2 visual language
  used across `/v2` surfaces (the Card container treatment, typography
  scale, spacing, green system; consistent with `MeView`/`AppShell`
  patterns). **Behavior is byte-identical**: the Suspense boundary, the
  `createBrowserClient` magic-link send, `emailRedirectTo=
  ${origin}/api/auth/callback`, the `?error=not_enrolled` handling, the
  "check your email" state, and all copy/validation are unchanged — this
  is a presentation-only refactor.

**Explicitly UNCHANGED:** `src/middleware.ts`; every `/api/lti/*` and the
`/api/auth/callback` handshake/`nextPath`/record-linking logic; the LTI
env-gated landing (already v2); `/privacy`, `/terms`, `/lti/deep-link`,
`/lti/register`, `/work/import`, `/work/submit`; all `/v2/*` surfaces.

## Data flow

```
Unauth visitor → / → redirect /v2 → (no identity) → /login (v2-styled)
  → magic link → /api/auth/callback (no `next`) → fallback /v2
  → /v2 identity-routes → /v2/today | /v2/coach
Authed visitor → / → /v2 → /v2/today | /v2/coach   (already v2)
Old/bookmarked v1 URL → that page's redirect → v2 equivalent
  (/conversation/<id> → /v2/conversation/<id>, etc.)
D2L LTI launch → UNCHANGED (explicit env-gated `next`; never hits the
  callback fallback; handshake untouched)
```

## Integration-safety guarantee (load-bearing)

Nothing D2L points at, no `/api/lti/*` endpoint, no handshake/JWKS, no
`redirect_uri`, no middleware, and **no `/api/auth/callback` logic other
than the literal fallback string** is altered. The LTI launch passes an
explicit `next` and provably never reaches the changed fallback. Every
change is a redirect or a visual-only refactor; no code is deleted; each
file reverts independently. The env-gated LTI landing remains the
independent, deploy-free revert lever.

## Error handling / edge cases

- A bookmarked v1 `/reflect?work=<id>` (legacy work-tied query form)
  redirects to `/v2/journal` (open-reflection), losing `?work=`. Accepted
  edge: the `?work=` query form is a retired v1 mechanism; the v2
  work-tied entry is `/v2/today` (featured work) / `/v2/reflect`, and LTI
  already lands `/v2/today`. Not worth preserving the param. Recorded.
- `/coach/[studentId]/prep` has no v2 equivalent → redirects to the
  v2 student detail (`/v2/coach/[studentId]`). Acceptable nearest target.
- Redirect stubs ensure no v1 URL 404s; revert = restore the page file.

## Testing / definition of done

- **Structural source-scan** (standalone `tsx`, repo convention): each
  named v1 `page.tsx` contains a `redirect('/v2…')` and no longer renders
  v1 content (no v1 query/list imports executed); `src/app/page.tsx`
  redirects `/v2`; the auth callback's three fallbacks are `'/v2'` and
  `nextPath`/handshake lines are unchanged; `/login` still exports a
  component and contains the magic-link `emailRedirectTo`.
- `npx tsc --noEmit` 0; `npx eslint --no-eslintrc --config .eslintrc.json
  <files>` clean; `npm run build` 0.
- **Manual runbook:** unauth `/` → v2-styled `/login`; authed magic-link
  login → `/v2/today` (not `/garden`); `/garden`,`/coach`,`/narrative`,
  `/career` → v2 equivalents; `/conversation/<id>` →
  `/v2/conversation/<id>`; `/demo/*` → `/v2/demo`; a real D2L LTI launch
  still lands v2 with the handshake unchanged; `/privacy`,`/terms`,
  `/lti/*`,`/work/*` still serve their own content.

## Rollout

Code-only; no migration. `git push`/PR-merge → Vercel. Reversible per
file; the env-gated LTI landing is the independent lever. Ships as its
own PR (separate from SP2/SP3).

## Out of scope / non-goals

- A v2 `/work/import`-`/work/submit` equivalent (left reachable; flagged
  follow-up).
- Any middleware change; any `/api/lti/*` or callback-handshake change.
- A bespoke marketing landing page (decision: restyle `/login`).
- SP2 (/v2/me preferences) and SP3 (mobile-nav) — separate specs.
