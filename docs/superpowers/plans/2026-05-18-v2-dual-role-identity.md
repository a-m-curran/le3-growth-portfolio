# v2 Dual-Role Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one human who owns both a `coach` and a `student` row (same `auth_user_id`) move between the v2 coach and student experiences, via an `le3-v2-active-role` cookie selector resolved in `getV2Identity()`, without changing single-role/demo behavior or the D2L LTI handshake.

**Architecture:** Approach A — resolve the active role in `getV2Identity()` (the single identity choke point). A new `POST /api/v2/switch-role` sets the cookie after server-validating role ownership; the LTI launch sets the same cookie post-handshake from the already-read LTI roles claim (all three exits: 2 instructor returns + 1 student path); the v2 shell renders a switch control only for dual-role users. The cookie is a *selector among proven-owned roles*, never a grant — `getV2Identity()` re-derives both row lookups every request.

**Tech Stack:** Next.js App Router (route handlers, server/client components), Supabase (`@supabase/auth-helpers-nextjs` for real-auth user, service-role admin client), TypeScript, `tsx` standalone test scripts.

---

## Pre-flight (executor reads first)

- **Branch base:** a NEW worktree branched from **`main` `467b09f`** (the dual-role spec commit `8f5d090` is docs-only on top; code files are byte-identical at `467b09f` and current `main`). The `superpowers:using-git-worktrees` skill creates/locates this worktree at execution time. **Do NOT touch** the sibling worktrees `.worktrees/conversation-validator` (parked) or `.worktrees/conversation-v2-enablement` (PR #6).
- **All line numbers below are valid at `467b09f`/current `main`.**
- **Repo test reality:** Next.js route handlers cannot execute under `tsx` (`next/headers` `cookies()` throws outside a request scope). The gate is a **structural source-scan** test + `npx tsc --noEmit` + `npx eslint` + `npm run build`. `npx next lint` is environmentally broken in worktrees — do NOT use it.
- **Lint command (exact):** `npx eslint --no-eslintrc --config .eslintrc.json <files>`
- **PR #6 overlap (sequencing — informational, do not act on it here):** PR #6 (`feat/conversation-v2-enablement`, unmerged) also edits `src/app/api/lti/launch/route.ts` lines 256 & 279 (Task 5 swaps the `'/coach'` arg for `LTI_INSTRUCTOR_PATH`). This plan also wraps those two returns (Task 3) to set a cookie. When both branches land, lines 256/279 require a **small manual merge**: keep this plan's wrapped-return-with-cookie form, and use PR #6's redirect-path argument (`LTI_INSTRUCTOR_PATH`) in place of the literal `'/coach'`. The student-path additions (Task 3) are on disjoint lines from PR #6 and auto-merge. `src/lib/v2-auth.ts` is not touched by PR #6 (no conflict).

## File structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/test-v2-dual-role.ts` (create) | Structural source-scan invariants for every task | 1–4 |
| `src/lib/v2-auth.ts` (modify) | `ACTIVE_ROLE_COOKIE` const+export; dual-role resolution in the real-auth branch; `dualRole` on `V2Identity`; `dualRole:false` on the demo-persona returns | 1 |
| `src/app/api/v2/switch-role/route.ts` (create) | Authenticated POST: validate role ownership → set/clear cookie → redirect | 2 |
| `src/app/api/lti/launch/route.ts` (modify) | Set `le3-v2-active-role` at all 3 post-handshake exits (2 instructor returns = `coach`, student path = `student`) | 3 |
| `src/components/v2/RoleSwitcher.tsx` (create) | Dual-role-only client control: form POST to `/api/v2/switch-role` | 4 |
| `src/components/v2/AppShell.tsx` (modify) | Accept `dualRole` prop; render `RoleSwitcher` in the `belowUser` slot | 4 |
| `src/app/v2/(student)/layout.tsx` (modify) | Pass `dualRole={identity.dualRole}` to `AppShell` | 4 |
| `src/app/v2/(coach)/layout.tsx` (modify) | Pass `dualRole={identity.dualRole}` to `AppShell` | 4 |

---

## Task 1: `v2-auth.ts` dual-role resolution + structural test scaffold

**Files:**
- Create: `scripts/test-v2-dual-role.ts`
- Modify: `src/lib/v2-auth.ts` (lines 25, 27-46, 90-137, the `resolvePersonaFromDb` returns at ~166-196, and the export at line 201)

- [ ] **Step 1: Create the failing structural test**

Create `scripts/test-v2-dual-role.ts` with exactly:

```ts
/**
 * Structural invariants for the v2 dual-role identity feature.
 *
 * Route handlers can't run under tsx (next/headers cookies() throws
 * outside a request scope), so this is a comment-stripped source scan
 * of the load-bearing invariants. Behavioral proof is the DoD runbook
 * (Task 5).
 *
 * USAGE:
 *   npx tsx scripts/test-v2-dual-role.ts
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { assertEqual, section, finish } from './_sync-test-harness'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '..', rel), 'utf-8')
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

section('v2-auth: dual-role active-role resolution')
{
  const raw = read('src/lib/v2-auth.ts')
  const code = stripComments(raw)
  assertEqual(
    /ACTIVE_ROLE_COOKIE\s*=\s*['"]le3-v2-active-role['"]/.test(code),
    true,
    'ACTIVE_ROLE_COOKIE const defined as le3-v2-active-role'
  )
  assertEqual(
    /export\s*\{[^}]*ACTIVE_ROLE_COOKIE[^}]*\}/.test(code),
    true,
    'ACTIVE_ROLE_COOKIE is exported'
  )
  assertEqual(
    (code.match(/dualRole/g) || []).length >= 4,
    true,
    'dualRole present on both V2Identity variants + resolution + demo returns'
  )
  assertEqual(
    /\.from\('coach'\)[\s\S]*?\.from\('student'\)/.test(code),
    true,
    'real-auth branch looks up BOTH coach and student'
  )
  assertEqual(
    /cookieStore\.get\(ACTIVE_ROLE_COOKIE\)/.test(code),
    true,
    'reads the active-role cookie'
  )
  assertEqual(
    /activeRole === 'student' \? asStudent\(\) : asCoach\(\)/.test(code),
    true,
    'cookie selects student; coach-first is the default'
  )
}

// Task 2 appends its section here.
finish()
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-v2-dual-role.ts`
Expected: FAIL — `ACTIVE_ROLE_COOKIE` absent, no dual lookup, etc. (6 assertions fail).

- [ ] **Step 3: Add the `ACTIVE_ROLE_COOKIE` const**

In `src/lib/v2-auth.ts`, line 25 currently is:

```ts
const PERSONA_COOKIE = 'le3-v2-demo-persona'
```

Add immediately after it (new line 26):

```ts
const ACTIVE_ROLE_COOKIE = 'le3-v2-active-role'
```

- [ ] **Step 4: Add `dualRole` to both `V2Identity` variants**

Replace the entire `V2Identity` type (lines 27-46) — the exact current block:

```ts
export type V2Identity =
  | {
      role: 'coach'
      id: string
      name: string
      email: string
      authUserId: string
      isDemo: boolean
    }
  | {
      role: 'student'
      id: string
      firstName: string
      lastName: string
      name: string
      email: string
      cohort: string | null
      authUserId: string
      isDemo: boolean
    }
```

with:

```ts
export type V2Identity =
  | {
      role: 'coach'
      id: string
      name: string
      email: string
      authUserId: string
      isDemo: boolean
      dualRole: boolean
    }
  | {
      role: 'student'
      id: string
      firstName: string
      lastName: string
      name: string
      email: string
      cohort: string | null
      authUserId: string
      isDemo: boolean
      dualRole: boolean
    }
```

- [ ] **Step 5: Add `dualRole: false` to the two `resolvePersonaFromDb` return objects**

`resolvePersonaFromDb` (around lines 156-199) returns a student object then a coach object. Demo personas are single-role. Find the student return (exact current text):

```ts
  if (studentRow) {
    return {
      role: 'student',
      id: studentRow.id as string,
      firstName: studentRow.first_name as string,
      lastName: studentRow.last_name as string,
      name: `${studentRow.first_name} ${studentRow.last_name}`.trim(),
      email: studentRow.email as string,
      cohort: (studentRow.cohort as string | null) ?? null,
      authUserId: `demo:${personaSlug}`,
      isDemo: true,
    }
  }
```

Replace with (adds the `dualRole: false` line):

```ts
  if (studentRow) {
    return {
      role: 'student',
      id: studentRow.id as string,
      firstName: studentRow.first_name as string,
      lastName: studentRow.last_name as string,
      name: `${studentRow.first_name} ${studentRow.last_name}`.trim(),
      email: studentRow.email as string,
      cohort: (studentRow.cohort as string | null) ?? null,
      authUserId: `demo:${personaSlug}`,
      isDemo: true,
      dualRole: false,
    }
  }
```

Then find the coach return (exact current text):

```ts
  if (coachRow) {
    return {
      role: 'coach',
      id: coachRow.id as string,
      name: coachRow.name as string,
      email: coachRow.email as string,
      authUserId: `demo:${personaSlug}`,
      isDemo: true,
    }
  }
```

Replace with:

```ts
  if (coachRow) {
    return {
      role: 'coach',
      id: coachRow.id as string,
      name: coachRow.name as string,
      email: coachRow.email as string,
      authUserId: `demo:${personaSlug}`,
      isDemo: true,
      dualRole: false,
    }
  }
```

- [ ] **Step 6: Replace the real-auth resolution branch with dual-role logic**

Replace lines 90-137 — the exact current block:

```ts
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  // Coach first — coaches who are also students would still want
  // the coach shell as their primary view.
  const { data: coachRow } = await admin
    .from('coach')
    .select('id, name, email, is_demo')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (coachRow) {
    return {
      role: 'coach',
      id: coachRow.id as string,
      name: coachRow.name as string,
      email: coachRow.email as string,
      authUserId: user.id,
      isDemo: !!(coachRow.is_demo as boolean | null),
    }
  }

  const { data: studentRow } = await admin
    .from('student')
    .select('id, first_name, last_name, email, cohort, is_demo')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (studentRow) {
    return {
      role: 'student',
      id: studentRow.id as string,
      firstName: studentRow.first_name as string,
      lastName: studentRow.last_name as string,
      name: `${studentRow.first_name} ${studentRow.last_name}`.trim(),
      email: studentRow.email as string,
      cohort: (studentRow.cohort as string | null) ?? null,
      authUserId: user.id,
      isDemo: !!(studentRow.is_demo as boolean | null),
    }
  }

  return null
}
```

with exactly:

```ts
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  // Dual-role resolution. The DB already allows one auth_user_id to
  // own BOTH a coach and a student row (each table is
  // UNIQUE(auth_user_id)). Look up both; if the human owns both, the
  // le3-v2-active-role cookie SELECTS which experience is active. The
  // cookie is only a selector among roles proven-owned right here — it
  // never grants a role. Absent/invalid cookie ⇒ coach-first (today's
  // behavior, preserved). Single-role and demo paths are unchanged.
  const [{ data: coachRow }, { data: studentRow }] = await Promise.all([
    admin
      .from('coach')
      .select('id, name, email, is_demo')
      .eq('auth_user_id', user.id)
      .maybeSingle(),
    admin
      .from('student')
      .select('id, first_name, last_name, email, cohort, is_demo')
      .eq('auth_user_id', user.id)
      .maybeSingle(),
  ])

  const dualRole = !!coachRow && !!studentRow
  const activeRole = cookieStore.get(ACTIVE_ROLE_COOKIE)?.value

  const asCoach = (): V2Identity => ({
    role: 'coach',
    id: coachRow!.id as string,
    name: coachRow!.name as string,
    email: coachRow!.email as string,
    authUserId: user.id,
    isDemo: !!(coachRow!.is_demo as boolean | null),
    dualRole,
  })

  const asStudent = (): V2Identity => ({
    role: 'student',
    id: studentRow!.id as string,
    firstName: studentRow!.first_name as string,
    lastName: studentRow!.last_name as string,
    name: `${studentRow!.first_name} ${studentRow!.last_name}`.trim(),
    email: studentRow!.email as string,
    cohort: (studentRow!.cohort as string | null) ?? null,
    authUserId: user.id,
    isDemo: !!(studentRow!.is_demo as boolean | null),
    dualRole,
  })

  // Both roles: cookie selects; coach-first default when unset/invalid.
  if (coachRow && studentRow) {
    return activeRole === 'student' ? asStudent() : asCoach()
  }
  // Single role: byte-equivalent to the prior behavior (dualRole=false).
  if (coachRow) return asCoach()
  if (studentRow) return asStudent()

  return null
}
```

- [ ] **Step 7: Update the export**

Line 201 currently:

```ts
export { PERSONA_COOKIE }
```

Replace with:

```ts
export { PERSONA_COOKIE, ACTIVE_ROLE_COOKIE }
```

- [ ] **Step 8: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-v2-dual-role.ts`
Expected: PASS — `N passed, 0 failed`, exit 0.

- [ ] **Step 9: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json src/lib/v2-auth.ts scripts/test-v2-dual-role.ts` → no warnings

- [ ] **Step 10: Commit**

```bash
git add src/lib/v2-auth.ts scripts/test-v2-dual-role.ts
git commit -m "$(cat <<'EOF'
v2-auth: dual-role active-role resolution (coach-first preserved)

getV2Identity now looks up BOTH coach and student by auth_user_id; if
the human owns both, the le3-v2-active-role cookie selects the active
experience (coach-first default when unset/invalid). Single-role and
demo paths are byte-equivalent. dualRole added to V2Identity.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `POST /api/v2/switch-role`

**Files:**
- Create: `src/app/api/v2/switch-role/route.ts`
- Modify: `scripts/test-v2-dual-role.ts`

- [ ] **Step 1: Add the failing structural section**

In `scripts/test-v2-dual-role.ts`, replace the line `// Task 2 appends its section here.` with:

```ts
section('switch-role: authed, ownership-gated, cookie selector')
{
  const raw = read('src/app/api/v2/switch-role/route.ts')
  const code = stripComments(raw)
  assertEqual(/export async function POST/.test(code), true, 'POST handler')
  assertEqual(
    /ACTIVE_ROLE_COOKIE/.test(code) && /from '@\/lib\/v2-auth'/.test(code),
    true,
    'imports the shared ACTIVE_ROLE_COOKIE const'
  )
  assertEqual(
    /supabase\.auth\.getUser\(\)/.test(code),
    true,
    'resolves the real Supabase auth user (no demo path)'
  )
  assertEqual(/status:\s*401/.test(code), true, 'unauthenticated → 401')
  assertEqual(
    /\.eq\('auth_user_id', user\.id\)/.test(code),
    true,
    'validates ownership by auth_user_id'
  )
  assertEqual(/status:\s*403/.test(code), true, 'unowned role → 403')
  assertEqual(
    /cookies\.delete\(ACTIVE_ROLE_COOKIE\)/.test(code),
    true,
    'clear path unsets the cookie'
  )
  assertEqual(
    /response\.cookies\.set\(\{[\s\S]*name:\s*ACTIVE_ROLE_COOKIE/.test(code),
    true,
    'sets the cookie on the redirect response object'
  )
}

// Task 3 appends its section here.
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-v2-dual-role.ts`
Expected: FAIL — `src/app/api/v2/switch-role/route.ts` does not exist (read throws / assertions fail).

- [ ] **Step 3: Create `src/app/api/v2/switch-role/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { ACTIVE_ROLE_COOKIE } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/v2/switch-role?role=student|coach|clear
 *
 * Dual-role humans only. Sets the le3-v2-active-role cookie so
 * getV2Identity resolves the chosen experience. The cookie is a
 * SELECTOR among roles the authenticated user provably owns — it never
 * grants a role (getV2Identity re-validates row ownership every
 * request, so a tampered cookie cannot escalate). ?role=clear unsets
 * it (→ coach-first default). Real Supabase auth required; this is the
 * real-auth analog of /api/v2/demo-as.
 *
 * Cookie attributes mirror the demo-persona cookie (same-site web set;
 * sameSite=lax, secure in production) — distinct from the LTI launch
 * set-site which mirrors lti_context (see api/lti/launch/route.ts).
 */
export async function POST(req: NextRequest) {
  const role = new URL(req.url).searchParams.get('role')

  // Clear branch — unset the selector (→ coach-first). Set on the
  // response object: a redirecting route handler does not inherit
  // next/headers cookie mutations.
  if (role === 'clear') {
    const res = NextResponse.redirect(new URL('/v2', req.url), 302)
    res.cookies.delete(ACTIVE_ROLE_COOKIE)
    return res
  }

  if (role !== 'student' && role !== 'coach') {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
  }

  // Resolve the REAL Supabase auth user (no persona path here).
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // no-op: called outside a mutable cookie scope
          }
        },
      },
    }
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Security spine: the user must actually OWN a row for the requested
  // role. Never trust the client.
  const admin = createAdminClient()
  const table = role === 'coach' ? 'coach' : 'student'
  const { data: owned } = await admin
    .from(table)
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!owned) {
    return NextResponse.json(
      { error: `You do not have a ${role} role` },
      { status: 403 }
    )
  }

  const target = role === 'coach' ? '/v2/coach' : '/v2/today'
  const response = NextResponse.redirect(new URL(target, req.url), 302)
  response.cookies.set({
    name: ACTIVE_ROLE_COOKIE,
    value: role,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
  })
  return response
}
```

- [ ] **Step 4: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-v2-dual-role.ts`
Expected: PASS — all sections green.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json "src/app/api/v2/switch-role/route.ts" scripts/test-v2-dual-role.ts` → no warnings

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/v2/switch-role/route.ts" scripts/test-v2-dual-role.ts
git commit -m "$(cat <<'EOF'
api/v2/switch-role: ownership-gated active-role cookie setter

Real-auth analog of demo-as. Validates the authenticated user actually
owns the requested role's row (auth_user_id) before setting the
le3-v2-active-role cookie; 401 unauthenticated, 403 unowned, clear
path unsets. Cookie never grants a role — only selects among owned.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: LTI launch — set the active-role cookie at all 3 post-handshake exits

**Files:**
- Modify: `src/app/api/lti/launch/route.ts` (import; instructor returns at lines 256 & 279; student path after line 439)
- Modify: `scripts/test-v2-dual-role.ts`

**Integration-safety:** every change is **after** `verifyPlatformJwt` + session mint + provisioning — D2L never observes these cookies. No handshake/JWKS/`redirect_uri`/role-claim-*parsing* change (the roles claim is already read via `isInstructor`/`isStudent`). LTI set-site uses the **`lti_context` attribute profile** (`secure:true, sameSite:'none'`) so the cookie survives the cross-site Brightspace redirect.

- [ ] **Step 1: Add the failing structural section**

In `scripts/test-v2-dual-role.ts`, replace `// Task 3 appends its section here.` with:

```ts
section('lti/launch: active-role cookie at all 3 exits; handshake intact')
{
  const raw = read('src/app/api/lti/launch/route.ts')
  const code = stripComments(raw)
  assertEqual(
    /ACTIVE_ROLE_COOKIE/.test(code) && /from '@\/lib\/v2-auth'/.test(code),
    true,
    'imports the shared ACTIVE_ROLE_COOKIE const'
  )
  assertEqual(
    (code.match(/name:\s*ACTIVE_ROLE_COOKIE/g) || []).length >= 3,
    true,
    'active-role cookie set at ≥3 exits (2 instructor + 1 student)'
  )
  assertEqual(
    (code.match(/value:\s*'coach'/g) || []).length >= 2,
    true,
    'instructor exits set value coach'
  )
  assertEqual(
    /value:\s*'student'/.test(code),
    true,
    'student exit sets value student'
  )
  // D2L-facing handshake must remain intact (no integration change).
  assertEqual(/verifyPlatformJwt\s*\(/.test(code), true, 'JWT verification still present')
  assertEqual(/redirectWithSession\s*\(/.test(code), true, 'session mint still present')
  assertEqual(/lti_context/.test(code), true, 'lti_context cookie still set')
}

// Task 4 appends its section here.
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-v2-dual-role.ts`
Expected: FAIL — `ACTIVE_ROLE_COOKIE` not imported in lti/launch; 0 sets.

- [ ] **Step 3: Add the import**

In `src/app/api/lti/launch/route.ts`, the claims import block is lines 5-10:

```ts
import {
  LTI_CLAIMS,
  getMessageType,
  isStudent,
  isInstructor,
} from '@/lib/lti/claims'
```

Add a new import line immediately after line 10 (after that import statement closes):

```ts
import { ACTIVE_ROLE_COOKIE } from '@/lib/v2-auth'
```

- [ ] **Step 4: Wrap the first instructor return (line 256)**

Find the exact current line 256:

```ts
        return redirectWithSession(admin, email, '/coach', req.nextUrl.origin)
```

(It is the one inside `if (coach && coach.auth_user_id) {` at line 252.) Replace that single line with:

```ts
        {
          const res = await redirectWithSession(
            admin,
            email,
            '/coach',
            req.nextUrl.origin
          )
          res.cookies.set({
            name: ACTIVE_ROLE_COOKIE,
            value: 'coach',
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 86400,
          })
          return res
        }
```

- [ ] **Step 5: Wrap the second instructor return (line 279)**

Find the exact current line 279 (the one right before the closing `}` of the `if (isInstructor(payload))` block at line 280):

```ts
      return redirectWithSession(admin, email, '/coach', req.nextUrl.origin)
```

There are now (after Step 4) two textually-identical occurrences differing only by indentation. This one has 6 leading spaces (the Step-4 one had 8 and is already replaced). Replace this 6-space occurrence with:

```ts
      {
        const res = await redirectWithSession(
          admin,
          email,
          '/coach',
          req.nextUrl.origin
        )
        res.cookies.set({
          name: ACTIVE_ROLE_COOKIE,
          value: 'coach',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 86400,
        })
        return res
      }
```

(If Step 4 is already applied, only one `return redirectWithSession(admin, email, '/coach', req.nextUrl.origin)` remains — match it exactly. Use Read to confirm before editing.)

- [ ] **Step 6: Set the student-path cookie after the `lti_context` set**

Find the exact current `lti_context` set + the following lines (lines 433-443):

```ts
    response.cookies.set('lti_context', JSON.stringify(ltiContext), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 86400,
      path: '/',
    })

    // Clear state/nonce cookies
    response.cookies.delete('lti_state')
    response.cookies.delete('lti_nonce')
```

Replace with (inserts the active-role set between the `lti_context` set and the state/nonce cleanup — nothing else changes):

```ts
    response.cookies.set('lti_context', JSON.stringify(ltiContext), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 86400,
      path: '/',
    })

    // Dual-role: an LTI student launch makes 'student' the active role
    // on arrival (overwrites any stale web cookie so D2L's per-launch
    // role wins). Same attribute profile as lti_context so it survives
    // the cross-site Brightspace redirect. Switchable mid-session via
    // /api/v2/switch-role. Post-handshake — D2L never sees this.
    response.cookies.set({
      name: ACTIVE_ROLE_COOKIE,
      value: 'student',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 86400,
    })

    // Clear state/nonce cookies
    response.cookies.delete('lti_state')
    response.cookies.delete('lti_nonce')
```

- [ ] **Step 7: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-v2-dual-role.ts`
Expected: PASS — all sections green.

- [ ] **Step 8: Typecheck + lint + build**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json "src/app/api/lti/launch/route.ts" scripts/test-v2-dual-role.ts` → no warnings
Run: `npm run build` → exit 0

- [ ] **Step 9: Commit**

```bash
git add "src/app/api/lti/launch/route.ts" scripts/test-v2-dual-role.ts
git commit -m "$(cat <<'EOF'
lti/launch: set le3-v2-active-role at all 3 post-handshake exits

Instructor returns (×2) set 'coach', student path sets 'student' —
D2L's per-launch role wins on arrival even if a stale web cookie says
otherwise. Strictly post-handshake (after verifyPlatformJwt + session
mint); lti_context attribute profile so it survives the cross-site
redirect. No D2L-facing/handshake change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: v2 shell RoleSwitcher control

**Files:**
- Create: `src/components/v2/RoleSwitcher.tsx`
- Modify: `src/components/v2/AppShell.tsx`
- Modify: `src/app/v2/(student)/layout.tsx`
- Modify: `src/app/v2/(coach)/layout.tsx`
- Modify: `scripts/test-v2-dual-role.ts`

- [ ] **Step 1: Add the failing structural section**

In `scripts/test-v2-dual-role.ts`, replace `// Task 4 appends its section here.` with:

```ts
section('v2 shell: dual-role switch control wired')
{
  const rs = stripComments(read('src/components/v2/RoleSwitcher.tsx'))
  assertEqual(/'use client'/.test(rs), true, 'RoleSwitcher is a client component')
  assertEqual(
    /\/api\/v2\/switch-role\?role=/.test(rs),
    true,
    'RoleSwitcher posts to /api/v2/switch-role'
  )
  assertEqual(/method="POST"/i.test(rs), true, 'RoleSwitcher uses a POST form')

  const shell = stripComments(read('src/components/v2/AppShell.tsx'))
  assertEqual(/dualRole/.test(shell), true, 'AppShell takes a dualRole prop')
  assertEqual(/RoleSwitcher/.test(shell), true, 'AppShell renders RoleSwitcher')

  const sl = stripComments(read('src/app/v2/(student)/layout.tsx'))
  const cl = stripComments(read('src/app/v2/(coach)/layout.tsx'))
  assertEqual(
    /dualRole=\{identity\.dualRole\}/.test(sl),
    true,
    'student layout passes dualRole'
  )
  assertEqual(
    /dualRole=\{identity\.dualRole\}/.test(cl),
    true,
    'coach layout passes dualRole'
  )
}

// Task 5 (verification) appends nothing — finish() stays last.
```

- [ ] **Step 2: Run the test — verify it FAILS**

Run: `npx tsx scripts/test-v2-dual-role.ts`
Expected: FAIL — `RoleSwitcher.tsx` missing; AppShell/layouts lack `dualRole`.

- [ ] **Step 3: Create `src/components/v2/RoleSwitcher.tsx`**

```tsx
'use client'

/**
 * Dual-role-only control: switch the active v2 experience. A native
 * form POST to /api/v2/switch-role — the server validates the user
 * actually owns the target role before honoring it (security spine
 * lives server-side; this is just the trigger). Only mounted by
 * AppShell when identity.dualRole is true. No client state needed:
 * the browser follows the route's 302 + Set-Cookie.
 */
export function RoleSwitcher({ role }: { role: 'student' | 'coach' }) {
  const target = role === 'coach' ? 'student' : 'coach'
  const label = target === 'student' ? 'Switch to Student' : 'Switch to Coach'
  return (
    <form
      action={`/api/v2/switch-role?role=${target}`}
      method="POST"
      className="px-3 py-2"
    >
      <button
        type="submit"
        className="w-full text-left text-xs font-medium text-green-800 hover:text-green-900 hover:underline"
      >
        {label} &rarr;
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Wire `RoleSwitcher` into `AppShell`**

In `src/components/v2/AppShell.tsx`:

(4a) After the existing import line 7 `import { StudentPicker } from './StudentPicker'`, add:

```tsx
import { RoleSwitcher } from './RoleSwitcher'
```

(4b) The `AppShellProps` interface (lines 10-17) currently:

```tsx
interface AppShellProps {
  role: 'student' | 'coach'
  userName: string
  userSubLabel?: string | null
  /** True if current user is allowed to see admin-flagged nav items */
  showAdmin?: boolean
  children: ReactNode
}
```

Replace with:

```tsx
interface AppShellProps {
  role: 'student' | 'coach'
  userName: string
  userSubLabel?: string | null
  /** True if current user is allowed to see admin-flagged nav items */
  showAdmin?: boolean
  /** True iff this auth_user_id owns both a coach and a student row */
  dualRole?: boolean
  children: ReactNode
}
```

(4c) The destructure (lines 32-38) currently:

```tsx
export function AppShell({
  role,
  userName,
  userSubLabel,
  showAdmin = false,
  children,
}: AppShellProps) {
```

Replace with:

```tsx
export function AppShell({
  role,
  userName,
  userSubLabel,
  showAdmin = false,
  dualRole = false,
  children,
}: AppShellProps) {
```

(4d) The `belowUser` prop (line 49) currently:

```tsx
        belowUser={role === 'coach' ? <StudentPicker /> : null}
```

Replace with:

```tsx
        belowUser={
          <>
            {role === 'coach' ? <StudentPicker /> : null}
            {dualRole ? <RoleSwitcher role={role} /> : null}
          </>
        }
```

- [ ] **Step 5: Pass `dualRole` from both layouts**

Use Read on `src/app/v2/(student)/layout.tsx`. It resolves `const identity = await getV2Identity()` and renders an `<AppShell ...>` element with props `role="student" userName={identity.name} userSubLabel={subLabel}`. Add the prop `dualRole={identity.dualRole}` to that `<AppShell` element. The element currently reads:

```tsx
    <AppShell role="student" userName={identity.name} userSubLabel={subLabel}>
```

Replace with:

```tsx
    <AppShell role="student" userName={identity.name} userSubLabel={subLabel} dualRole={identity.dualRole}>
```

(If the JSX is formatted multi-line in the actual file, add `dualRole={identity.dualRole}` as one additional prop line on the `<AppShell` element — change nothing else.)

Use Read on `src/app/v2/(coach)/layout.tsx`. Its `<AppShell` element currently reads:

```tsx
    <AppShell role="coach" userName={identity.name} userSubLabel="Coach" showAdmin={showAdmin}>
```

Replace with:

```tsx
    <AppShell role="coach" userName={identity.name} userSubLabel="Coach" showAdmin={showAdmin} dualRole={identity.dualRole}>
```

(Same multi-line caveat: add the single `dualRole={identity.dualRole}` prop, nothing else.)

- [ ] **Step 6: Run the test — verify it PASSES**

Run: `npx tsx scripts/test-v2-dual-role.ts`
Expected: PASS — all sections green, `N passed, 0 failed`, exit 0.

- [ ] **Step 7: Typecheck + lint + build**

Run: `npx tsc --noEmit` → exit 0
Run: `npx eslint --no-eslintrc --config .eslintrc.json "src/components/v2/RoleSwitcher.tsx" "src/components/v2/AppShell.tsx" "src/app/v2/(student)/layout.tsx" "src/app/v2/(coach)/layout.tsx" scripts/test-v2-dual-role.ts` → no warnings
Run: `npm run build` → exit 0 (catches CSR-bailout/RSC-boundary errors)

- [ ] **Step 8: Commit**

```bash
git add "src/components/v2/RoleSwitcher.tsx" "src/components/v2/AppShell.tsx" "src/app/v2/(student)/layout.tsx" "src/app/v2/(coach)/layout.tsx" scripts/test-v2-dual-role.ts
git commit -m "$(cat <<'EOF'
v2 shell: dual-role RoleSwitcher in the sidebar slot

A client form POSTing /api/v2/switch-role, rendered via AppShell's
belowUser slot only when identity.dualRole is true. Both v2 layouts
now pass identity.dualRole to AppShell. Server validates ownership.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Final verification + behavioral DoD runbook

**Files:** none (verification only).

- [ ] **Step 1: Full automated sweep — all green:**
  - `npx tsc --noEmit` → exit 0
  - `npx eslint --no-eslintrc --config .eslintrc.json src/lib/v2-auth.ts "src/app/api/v2/switch-role/route.ts" "src/app/api/lti/launch/route.ts" "src/components/v2/RoleSwitcher.tsx" "src/components/v2/AppShell.tsx" "src/app/v2/(student)/layout.tsx" "src/app/v2/(coach)/layout.tsx" scripts/test-v2-dual-role.ts` → no warnings
  - `npx tsx scripts/test-v2-dual-role.ts` → all sections pass, `N passed, 0 failed`, exit 0
  - `npm run build` → exit 0

- [ ] **Step 2: Behavioral DoD runbook** (owner-run against the deployed branch — document results in the Step 3 commit message; do NOT fabricate).

Make the owner's real account dual-role (read-only-safe to reverse). Andrew's auth user id is `982c1882-cfe4-4da2-881d-ff21a16a8388` (coach `a4f866a1-3321-4560-9e47-d45caafbd518`, "Andrew Curran"). Add a **student row on the same auth_user_id** (sentinel `nlu_id='DUALROLE-ANDREW'`, `is_demo=false`, `coach_id` = that coach id, `cohort='Spring 2026'`, `program_start_date='2026-01-06'`, `status='active'`, `data_consent_acknowledged_at=now()`, `email` MUST differ from the coach email because `student.email` is UNIQUE — use `andrewmcurran+dualrole@gmail.com`; `auth_user_id='982c1882-cfe4-4da2-881d-ff21a16a8388'`). Then:

1. Normal magic-link login as `andrewmcurran@gmail.com` → **still resolves coach** (cookie unset → coach-first; unchanged). Confirm the coach shell, and that a "Switch to Student" control is now visible (dualRole=true).
2. Click **Switch to Student** → lands `/v2/today` as the student; drive a full conversation/reflection loop **as yourself**; confirm a `conversation_output` row is written for that student id.
3. Click **Switch to Coach** → back to the coach shell (`/v2/coach`).
4. **Regression:** a pure-coach account (no student row) → coach, no switch control. A pure-student account → student, no switch control. A demo persona (`/api/v2/demo-as`) → unchanged. An LTI **instructor** test launch → `/v2/coach` (and overwrites a stale `student` cookie if present). An LTI **student** test launch → `/v2/today`. The D2L handshake itself is unchanged.
5. **Teardown:** `DELETE FROM growth_conversation WHERE student_id=<the dualrole student id>;` (cascades output/skill_tag) then `DELETE FROM student WHERE nlu_id='DUALROLE-ANDREW';` (do NOT delete the auth user — it is Andrew's real coach login).

- [ ] **Step 3: Commit the verification record**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
v2-dual-role: verification record

Automated: tsc 0, eslint clean, structural test all green, npm run
build 0. Behavioral DoD runbook: <fill with real results — coach by
default unchanged; switch→student reached the student loop as self &
wrote conversation_output; switch→coach back; pure-coach/pure-student/
demo/LTI-instructor/LTI-student regressions all unchanged>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- Cookie-only active-role selector resolved in `getV2Identity()`, coach-first default preserved, single-role/demo byte-unchanged → Task 1 ✓
- `dualRole` on `V2Identity` (both variants + demo returns `false`) → Task 1 ✓
- `POST /api/v2/switch-role`, ownership-validated (401 unauth, 403 unowned, clear path) → Task 2 ✓
- LTI sets the role on arrival at all post-handshake exits (instructor ×2 = coach, student = student), no D2L-facing change, lti_context attribute profile → Task 3 ✓
- Shell control only when `dualRole` → Task 4 ✓
- Structural source-scan + behavioral DoD + tsc/eslint/build gates → Tasks 1–5 ✓
- Out of scope respected: no schema/migration; no server-stored preference; demo/demo-as/single-role untouched; no handshake change; `next-phase` authz untouched ✓
- PR #6 sequencing (manual merge on lines 256/279) documented in Pre-flight ✓

**2. Placeholder scan:** No TBD/"handle later". Every code step has complete before/after. The two layout edits give exact single-line before/after with an explicit multi-line fallback instruction (not a placeholder — a precise conditional edit). The Step-3 verification commit message has an explicit `<fill with real results>` slot — intentional (honest runbook record, mirrors the v2-enablement Task 6 precedent), not a code placeholder.

**3. Type consistency:** `ACTIVE_ROLE_COOKIE` (const name) consistent across Tasks 1–3. `dualRole` (camelCase, `boolean`) consistent on `V2Identity`, `AppShellProps`, both layouts, `RoleSwitcher` gating. `asCoach()`/`asStudent()` helper names internal to Task 1 only. Cookie attribute profiles deliberately differ by set-site (switch-role = lax/NODE_ENV per demo-persona sibling; LTI = none/secure:true per lti_context sibling) — documented in both routes' doc-comments. `redirectWithSession` is `async` (awaited at all wrapped instructor returns). Route handler param `NextRequest` matches the `import type { NextRequest }`.

No gaps found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-18-v2-dual-role-identity.md`. Execution will be **subagent-driven** in a fresh worktree branched from `main` `467b09f` (per the settled decision), with two-stage spec+code-quality review per task — the same loop used for the v2-enablement feature.
