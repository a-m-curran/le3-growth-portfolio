# Student/Pilot Passlinks + Admin Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin issue + distribute permanent login links for the whole pilot (56 students + 2 coaches + 23 instructors-as-coaches) as a one-time CSV from the Tools page, extending the merged staff-passlink bridge with the security model preserved.

**Architecture:** Owner-applied migration generalizes `auth_passlink` to a `(coach_id XOR student_id)` subject; the public `/api/auth/passlink` endpoint gains a student branch (coach path byte-equivalent); a shared server lib (`passlink-admin.ts`) does idempotent provision+mint; four ADMIN_EMAILS-gated `/api/admin/passlinks/*` routes (issue→CSV / roster / rotate / revoke-all) behind one reusable `requireAdmin` guard; a new "Passlinks" tab in the existing Tools surface. `redirectWithSession`/callback/middleware/coach-CLI unchanged.

**Tech Stack:** Next.js App Router (TypeScript, strict), Supabase service-role admin client, node `crypto`, hand-rolled CSV, repo structural source-scan tests via `npx tsx`.

---

## Pre-flight (read before Task 1)

**Worktree & env (harness sets up):** NEW worktree `.worktrees/student-passlinks` branched from current `main` HEAD (`7bf51db`). Do NOT touch any other worktree. Copy `/Users/andrewcurran/le3-growth-portfolio/.env.local` into the worktree root (faithful `npm run build`). Shell cwd resets between Bash commands — always absolute paths or `cd <worktree> && …` / `git -C <worktree>`.

**Auth-sensitive + DB migration — critical:** This touches the auth boundary and adds migration `018_auth_passlink_student.sql`. The implementer must **NOT apply 018 (nor 017) to any database** — both are **owner steps** in the final runbook (Task 7). `tsc`/`build`/the structural test do NOT require the table/column to exist (Supabase queries are untyped; no generated types). `018` is additive and reversible (drop the column/index/constraint, restore `coach_id set not null`). The final `finishing-a-development-branch` presents options to the owner — **no autonomous merge/push**.

**Conventions (every task):**
- Single structural test `scripts/test-student-passlinks.ts` run with `npx tsx scripts/test-student-passlinks.ts`. Imports `{ assertEqual, section, finish }` from `./_sync-test-harness`; local `read()`/`stripComments()`; one `section(){}` per task; exactly one trailing `finish()`; sections accumulate above the marker `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<`. No `bootstrapTestEnv` (pure scan; routes/components/SQL can't run under tsx — assert source/SQL text).
- Gates from worktree root: `npx tsc --noEmit` exit 0; `npx eslint --no-eslintrc --config .eslintrc.json <files>` no warnings (**NEVER** `npx next lint`); `npm run build` exit 0.
- The **no-`@/`-imports rule applies ONLY to tsx CLI scripts** (`scripts/*.ts` that run under tsx). All new in-app code here (routes, `src/lib/auth/*`, components) is Next runtime and uses `@/` aliases + `createAdminClient` from `@/lib/supabase-admin` normally.
- One commit per task. Provide each subagent the full task text — do not have them read this plan file.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/018_auth_passlink_student.sql` | Generalize subject to coach_id XOR student_id | Create |
| `src/lib/auth/require-admin.ts` | Reusable admin gate (mirrors recover-extractions) | Create |
| `src/app/api/auth/passlink/route.ts` | Add student branch; coach path byte-equivalent | Modify |
| `src/lib/auth/passlink-admin.ts` | provision+mint, gather subjects, roster, rotate, revoke-all, CSV | Create |
| `src/app/api/admin/passlinks/issue/route.ts` | POST → bulk issue → one-time CSV | Create |
| `src/app/api/admin/passlinks/route.ts` | GET roster (status only) | Create |
| `src/app/api/admin/passlinks/rotate/route.ts` | POST rotate one subject | Create |
| `src/app/api/admin/passlinks/revoke-all/route.ts` | POST revoke all (teardown) | Create |
| `src/components/coach/PasslinksPanel.tsx` | Client panel: status table, issue/rotate/revoke-all | Create |
| `src/app/v2/(coach)/coach/tools/ToolsView.tsx` | Add "Passlinks" tab | Modify |
| `src/app/v2/(coach)/coach/tools/page.tsx` | Prefetch roster, pass prop | Modify |
| `scripts/test-student-passlinks.ts` | Structural invariants (one section per task) | Create |

---

### Task 1: Migration 018 + structural test scaffold

**Files:** Create `supabase/migrations/018_auth_passlink_student.sql`; Create `scripts/test-student-passlinks.ts`

- [ ] **Step 1: Confirm next migration number is 018**

Run: `ls /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks/supabase/migrations | sort | tail -3`
Expected: highest is `017_auth_passlink.sql` → `018_` is correct. If higher exists, STOP / report BLOCKED.

- [ ] **Step 2: Create `scripts/test-student-passlinks.ts` with exactly this content**

```ts
/**
 * Structural invariants for student/pilot passlinks + admin surface.
 * Routes/components/SQL can't run under tsx; comment-stripped source
 * scan (SQL read raw). USAGE: npx tsx scripts/test-student-passlinks.ts
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

section('Task 1: 018_auth_passlink_student.sql generalizes the subject')
{
  const sql = read('supabase/migrations/018_auth_passlink_student.sql')
  assertEqual(/add column student_id uuid references student\(id\) on delete cascade/.test(sql), true, 'adds student_id FK cascade')
  assertEqual(/alter column coach_id drop not null/.test(sql), true, 'relaxes coach_id NOT NULL')
  assertEqual(/check \(\(coach_id is not null\) <> \(student_id is not null\)\)/.test(sql), true, 'exactly-one-subject CHECK')
  assertEqual(/create index auth_passlink_student_active_idx[\s\S]{0,80}where revoked_at is null/.test(sql), true, 'student active partial index')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
```

- [ ] **Step 3: Run test, verify Task 1 fails**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts`
Expected: FAIL (migration absent); exit 1.

- [ ] **Step 4: Create `supabase/migrations/018_auth_passlink_student.sql` with exactly this content**

```sql
-- Generalize auth_passlink to support student subjects (pilot bridge).
--
-- 017 created auth_passlink with coach_id NOT NULL — coach-only by
-- design. The pilot must onboard students before NLU IT can embed the
-- LTI launch in D2L, so a per-student login link is needed. This
-- generalizes the subject to (coach_id XOR student_id): exactly one is
-- set per row. Existing coach rows / queries / scripts are unaffected
-- (the coach_id path is unchanged; only its NOT NULL is relaxed).
--
-- Reversible: drop the student_id column + index + constraint and
-- restore `alter column coach_id set not null` (every existing row has
-- a non-null coach_id, so the restore is safe).

alter table auth_passlink
  add column student_id uuid references student(id) on delete cascade;

alter table auth_passlink
  alter column coach_id drop not null;

alter table auth_passlink
  add constraint auth_passlink_one_subject
  check ((coach_id is not null) <> (student_id is not null));

create index auth_passlink_student_active_idx
  on auth_passlink (student_id)
  where revoked_at is null;

comment on column auth_passlink.student_id is 'Student subject (XOR coach_id, enforced by auth_passlink_one_subject). Student passlinks land /v2/today as role:student. Pilot bridge until LTI embedding.';
comment on constraint auth_passlink_one_subject on auth_passlink is 'Exactly one of coach_id / student_id is set per row (polymorphic subject).';
```

- [ ] **Step 5: Run test, verify Task 1 passes**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts`
Expected: PASS — `4 passed, 0 failed`, exit 0.

- [ ] **Step 6: Commit**

```bash
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks add supabase/migrations/018_auth_passlink_student.sql scripts/test-student-passlinks.ts
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks commit -m "feat(passlink): 018 generalize auth_passlink subject (coach_id XOR student_id) + test"
```

---

### Task 2: Reusable admin guard

**Files:** Create `src/lib/auth/require-admin.ts`; Modify `scripts/test-student-passlinks.ts`

- [ ] **Step 1: Insert Task 2 test section** — in `scripts/test-student-passlinks.ts` replace the line `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<` with exactly:

```ts
section('Task 2: requireAdmin reusable gate')
{
  const g = stripComments(read('src/lib/auth/require-admin.ts'))
  assertEqual(/export async function requireAdmin\s*\(/.test(g), true, 'requireAdmin exported')
  assertEqual(/supabase\.auth\.getUser\(\)/.test(g) && /status: 401/.test(g), true, 'unauth → 401')
  assertEqual(/from\('coach'\)[\s\S]{0,120}\.eq\('auth_user_id', user\.id\)/.test(g), true, 'resolves coach by auth_user_id')
  assertEqual(/isAdminEmail\(/.test(g) && /status: 403/.test(g), true, 'non-admin → 403')
  assertEqual(/ok: true/.test(g) && /ok: false/.test(g), true, 'discriminated result')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

- [ ] **Step 2: Run test, verify Task 2 fails**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts`
Expected: Task 1 ✓, Task 2 ✗; exit 1.

- [ ] **Step 3: Create `src/lib/auth/require-admin.ts` with exactly this content** (mirrors the verbatim guard in `src/app/api/admin/recover-extractions/route.ts`, factored reusable):

```ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { isAdminEmail } from '@/lib/v2-auth'

/**
 * Admin gate for /api/admin/passlinks/* routes. Verbatim pattern from
 * /api/admin/recover-extractions: authenticated coach AND
 * isAdminEmail(coach.email). Defense-in-depth — middleware already
 * session-gates /api/admin (it is not in the public allowlist).
 *
 * Returns a discriminated result: { ok: true, adminEmail } or
 * { ok: false, res } where res is the 401/403 to return directly.
 */
export async function requireAdmin(): Promise<
  { ok: true; adminEmail: string } | { ok: false; res: NextResponse }
> {
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
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, res: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data: coach } = await admin
    .from('coach')
    .select('email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!coach || !isAdminEmail(coach.email as string)) {
    return { ok: false, res: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }

  return { ok: true, adminEmail: coach.email as string }
}
```

- [ ] **Step 4: Run test + tsc, verify Task 2 passes**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts` → Tasks 1–2 ✓, exit 0.
Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Lint + commit**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx eslint --no-eslintrc --config .eslintrc.json src/lib/auth/require-admin.ts` → exit 0.

```bash
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks add src/lib/auth/require-admin.ts scripts/test-student-passlinks.ts
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks commit -m "feat(passlink): reusable requireAdmin gate"
```

---

### Task 3: Generalize the public passlink endpoint (student branch)

**Files:** Modify `src/app/api/auth/passlink/route.ts` (full replace); Modify `scripts/test-student-passlinks.ts`

- [ ] **Step 1: Insert Task 3 test section** — replace `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<` with exactly:

```ts
section('Task 3: passlink endpoint — student branch + coach path preserved')
{
  const r = stripComments(read('src/app/api/auth/passlink/route.ts'))
  assertEqual(/select\('id, coach_id, student_id, revoked_at'\)/.test(r), true, 'selects student_id too')
  assertEqual(/link\.coach_id/.test(r) && /'\/v2\/coach'/.test(r) && /value: 'coach'/.test(r), true, 'coach path preserved (/v2/coach, cookie coach)')
  assertEqual(/link\.student_id/.test(r) && /from\('student'\)/.test(r), true, 'student branch loads student')
  assertEqual(/process\.env\.LTI_POST_LAUNCH_STUDENT_PATH \|\| '\/v2\/today'/.test(r), true, 'STUDENT_LANDING default /v2/today')
  assertEqual(/value: 'student'/.test(r), true, 'student cookie role')
  assertEqual(/status !== 'active'/.test(r), true, 'active gate (coach & student)')
  assertEqual((r.match(/\/login\?error=invalid_link/g) || []).length >= 1 && /function invalid\(/.test(r), true, 'generic invalid_link preserved')
  const mw = stripComments(read('src/middleware.ts'))
  assertEqual(/pathname\.startsWith\('\/api\/auth'\)/.test(mw) && /passlink/.test(mw) === false, true, 'middleware unchanged (public via /api/auth)')
  const rws = stripComments(read('src/lib/auth/redirect-with-session.ts'))
  assertEqual(/export async function redirectWithSession/.test(rws) && /type: 'magiclink'/.test(rws), true, 'redirect-with-session unchanged')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

- [ ] **Step 2: Run test, verify Task 3 fails**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts`
Expected: Tasks 1–2 ✓, Task 3 ✗ (`selects student_id too` etc.); exit 1.

- [ ] **Step 3: Replace `src/app/api/auth/passlink/route.ts` entirely with exactly this content** (coach branch byte-equivalent to the merged version; adds student branch + `STUDENT_LANDING`):

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirectWithSession } from '@/lib/auth/redirect-with-session'
import { ACTIVE_ROLE_COOKIE } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STUDENT_LANDING = process.env.LTI_POST_LAUNCH_STUDENT_PATH || '/v2/today'

/**
 * GET /api/auth/passlink?t=<token>
 *
 * Permanent per-subject login link (no-email bridge). Validates the
 * token (SHA-256 hash lookup, non-revoked), resolves the subject
 * (coach XOR student), requires it active, then delegates to the
 * existing redirectWithSession → /api/auth/callback verifyOtp path.
 * Coach → /v2/coach (role coach); student → /v2/today (role student).
 * Public via the /api/auth middleware allowlist prefix (unchanged).
 *
 * Every failure redirects to the SAME generic /login?error=invalid_link
 * (no token/subject enumeration). Issued/revoked via the admin surface
 * and scripts/*-passlink.ts.
 */
function invalid(origin: string): NextResponse {
  return NextResponse.redirect(new URL('/login?error=invalid_link', origin), 302)
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return invalid(origin)

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('auth_passlink')
    .select('id, coach_id, student_id, revoked_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle()

  if (!link) return invalid(origin)

  // Best-effort usage stamp; a failed stats write must not block sign-in.
  await admin
    .from('auth_passlink')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', link.id as string)

  if (link.coach_id) {
    const { data: coach } = await admin
      .from('coach')
      .select('id, email, status')
      .eq('id', link.coach_id as string)
      .maybeSingle()
    if (!coach || coach.status !== 'active') return invalid(origin)

    const res = await redirectWithSession(admin, coach.email as string, '/v2/coach', origin)
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

  if (link.student_id) {
    const { data: student } = await admin
      .from('student')
      .select('id, email, status')
      .eq('id', link.student_id as string)
      .maybeSingle()
    if (!student || student.status !== 'active') return invalid(origin)

    const res = await redirectWithSession(admin, student.email as string, STUDENT_LANDING, origin)
    res.cookies.set({
      name: ACTIVE_ROLE_COOKIE,
      value: 'student',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 86400,
    })
    return res
  }

  return invalid(origin)
}
```

- [ ] **Step 4: Run test + tsc, verify Task 3 passes**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts` → Tasks 1–3 ✓, exit 0.
Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsc --noEmit` → exit 0.
Confirm middleware untouched: `git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks status --porcelain` shows only the route + test file.

- [ ] **Step 5: Lint + commit**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx eslint --no-eslintrc --config .eslintrc.json "src/app/api/auth/passlink/route.ts"` → exit 0.

```bash
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks add "src/app/api/auth/passlink/route.ts" scripts/test-student-passlinks.ts
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks commit -m "feat(passlink): endpoint resolves coach XOR student (coach path byte-equivalent)"
```

---

### Task 4: Shared issuance/admin lib `passlink-admin.ts`

**Files:** Create `src/lib/auth/passlink-admin.ts`; Modify `scripts/test-student-passlinks.ts`

- [ ] **Step 1: Insert Task 4 test section** — replace `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<` with exactly:

```ts
section('Task 4: passlink-admin lib')
{
  const s = stripComments(read('src/lib/auth/passlink-admin.ts'))
  assertEqual(/export async function ensureSubjectAndMint\s*\(/.test(s), true, 'ensureSubjectAndMint exported')
  assertEqual(/export async function gatherPilotSubjects\s*\(/.test(s), true, 'gatherPilotSubjects exported')
  assertEqual(/export async function getPasslinkRoster\s*\(/.test(s), true, 'getPasslinkRoster exported')
  assertEqual(/export async function rotatePasslink\s*\(/.test(s), true, 'rotatePasslink exported')
  assertEqual(/export async function revokeAllPasslinks\s*\(/.test(s), true, 'revokeAllPasslinks exported')
  assertEqual(/export function toCsv\s*\(/.test(s), true, 'toCsv exported')
  assertEqual(/randomBytes\(32\)/.test(s) && /createHash\('sha256'\)/.test(s), true, '256-bit token stored hashed')
  assertEqual(/from\('instructor'\)/.test(s) && /toLowerCase\(\)/.test(s), true, 'instructors gathered + lowercased dedup')
  assertEqual(/email_confirm: true/.test(s), true, 'provisions auth user')
  assertEqual(/is_demo/.test(s) && /'active'/.test(s), true, 'active non-demo scoping')
  assertEqual(/"(.*?)"/.test(s) === true && /replace\(/.test(s), true, 'CSV escaping present')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

- [ ] **Step 2: Run test, verify Task 4 fails**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts`
Expected: Tasks 1–3 ✓, Task 4 ✗; exit 1.

- [ ] **Step 3: Create `src/lib/auth/passlink-admin.ts` with exactly this content**

```ts
import { createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * Server-side passlink admin lib (Next runtime; service-role client).
 * Provisions subjects + mints hashed tokens, gathers the pilot
 * population, builds the status roster, rotates/revokes, and renders
 * the one-time CSV. Coach logic mirrors scripts/issue-passlink.ts;
 * students must already exist (the synced cohort) — we never create
 * student rows. Instructors are provisioned as coach rows.
 */

type Admin = ReturnType<typeof createAdminClient>
export type SubjectKind = 'coach' | 'student'

export interface PilotSubject {
  kind: SubjectKind
  email: string
  name: string
}

export interface IssueResult {
  name: string
  email: string
  role: SubjectKind
  status: 'minted' | 'already-active' | 'error'
  url: string | null
  detail: string
}

export interface RosterRow {
  passlinkId: string | null
  role: SubjectKind
  name: string
  email: string
  status: 'active' | 'revoked' | 'none'
  lastUsedAt: string | null
  createdAt: string | null
}

// Verbatim from src/app/api/auth/callback/route.ts (local, unexported)
// — kept in sync so provisioned coaches get the same display name.
function deriveNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'Admin'
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Admin'
  )
}

function sha256hex(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

async function findAuthUserIdByEmail(admin: Admin, email: string): Promise<string | null> {
  const target = email.toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const users = data?.users ?? []
    const hit = users.find(u => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit.id
    if (users.length < 1000) break
  }
  return null
}

async function ensureAuthUser(admin: Admin, email: string): Promise<string> {
  const existing = await findAuthUserIdByEmail(admin, email)
  if (existing) return existing
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !data?.user) {
    throw new Error(`auth user create failed for ${email}: ${error?.message ?? 'no user'}`)
  }
  return data.user.id
}

async function ensureCoachId(admin: Admin, email: string, name: string): Promise<string> {
  const authUserId = await ensureAuthUser(admin, email)
  const { data: coach, error: cErr } = await admin
    .from('coach')
    .select('id, auth_user_id, status')
    .eq('email', email)
    .maybeSingle()
  if (cErr) throw cErr
  if (coach?.id) {
    const patch: Record<string, unknown> = {}
    if (!coach.auth_user_id) patch.auth_user_id = authUserId
    if (coach.status !== 'active') patch.status = 'active'
    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from('coach').update(patch).eq('id', coach.id as string)
      if (error) throw error
    }
    return coach.id as string
  }
  const { data: inserted, error } = await admin
    .from('coach')
    .insert({ auth_user_id: authUserId, name: name || deriveNameFromEmail(email), email, status: 'active' })
    .select('id')
    .single()
  if (error || !inserted) throw new Error(`coach insert failed for ${email}: ${error?.message ?? 'no row'}`)
  return inserted.id as string
}

async function ensureStudentId(admin: Admin, email: string): Promise<string> {
  const { data: student, error } = await admin
    .from('student')
    .select('id, auth_user_id')
    .eq('email', email)
    .eq('is_demo', false)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  if (!student?.id) throw new Error(`no active non-demo student row for ${email}`)
  const authUserId = await ensureAuthUser(admin, email)
  if (!student.auth_user_id) {
    const { error: uErr } = await admin
      .from('student')
      .update({ auth_user_id: authUserId })
      .eq('id', student.id as string)
    if (uErr) throw uErr
  }
  return student.id as string
}

export async function ensureSubjectAndMint(
  admin: Admin,
  subject: PilotSubject,
  baseUrl: string,
  rotate = false
): Promise<IssueResult> {
  const base = { name: subject.name, email: subject.email, role: subject.kind }
  try {
    const col = subject.kind === 'coach' ? 'coach_id' : 'student_id'
    const subjectId =
      subject.kind === 'coach'
        ? await ensureCoachId(admin, subject.email, subject.name)
        : await ensureStudentId(admin, subject.email)

    const { data: active, error: aErr } = await admin
      .from('auth_passlink')
      .select('id')
      .eq(col, subjectId)
      .is('revoked_at', null)
    if (aErr) throw aErr

    if (active && active.length > 0) {
      if (!rotate) {
        return { ...base, status: 'already-active', url: null, detail: 'active link exists (rotate to re-export)' }
      }
      const { error: rErr } = await admin
        .from('auth_passlink')
        .update({ revoked_at: new Date().toISOString() })
        .eq(col, subjectId)
        .is('revoked_at', null)
      if (rErr) throw rErr
    }

    const token = randomBytes(32).toString('base64url')
    const { error: insErr } = await admin
      .from('auth_passlink')
      .insert({ [col]: subjectId, token_hash: sha256hex(token) })
    if (insErr) throw insErr

    const url = `${baseUrl.replace(/\/+$/, '')}/api/auth/passlink?t=${token}`
    return { ...base, status: 'minted', url, detail: '' }
  } catch (err) {
    return { ...base, status: 'error', url: null, detail: String(err) }
  }
}

export async function gatherPilotSubjects(admin: Admin): Promise<PilotSubject[]> {
  const subjects: PilotSubject[] = []
  const coachEmails = new Set<string>()

  const { data: students } = await admin
    .from('student')
    .select('first_name, last_name, email')
    .eq('status', 'active')
    .eq('is_demo', false)
    .order('last_name', { ascending: true })
  for (const s of students ?? []) {
    subjects.push({
      kind: 'student',
      email: s.email as string,
      name: `${s.first_name as string} ${s.last_name as string}`.trim(),
    })
  }

  const { data: coaches } = await admin
    .from('coach')
    .select('name, email')
    .eq('is_demo', false)
    .order('name', { ascending: true })
  for (const c of coaches ?? []) {
    const key = (c.email as string).toLowerCase()
    if (coachEmails.has(key)) continue
    coachEmails.add(key)
    subjects.push({ kind: 'coach', email: c.email as string, name: c.name as string })
  }

  const { data: instructors } = await admin
    .from('instructor')
    .select('name, email')
    .order('name', { ascending: true })
  for (const i of instructors ?? []) {
    const email = (i.email as string | null)?.trim()
    if (!email || !email.includes('@')) continue
    const key = email.toLowerCase()
    if (coachEmails.has(key)) continue
    coachEmails.add(key)
    subjects.push({ kind: 'coach', email, name: (i.name as string) || deriveNameFromEmail(email) })
  }

  return subjects
}

export async function getPasslinkRoster(admin: Admin): Promise<RosterRow[]> {
  const rows: RosterRow[] = []

  const { data: links } = await admin
    .from('auth_passlink')
    .select('id, coach_id, student_id, revoked_at, last_used_at, created_at')
    .order('created_at', { ascending: false })
  const byCoach = new Map<string, { id: string; revoked: boolean; lastUsedAt: string | null; createdAt: string | null }>()
  const byStudent = new Map<string, { id: string; revoked: boolean; lastUsedAt: string | null; createdAt: string | null }>()
  for (const l of links ?? []) {
    const rec = {
      id: l.id as string,
      revoked: l.revoked_at != null,
      lastUsedAt: (l.last_used_at as string | null) ?? null,
      createdAt: (l.created_at as string | null) ?? null,
    }
    if (l.coach_id && !byCoach.has(l.coach_id as string)) byCoach.set(l.coach_id as string, rec)
    if (l.student_id && !byStudent.has(l.student_id as string)) byStudent.set(l.student_id as string, rec)
  }

  const { data: coaches } = await admin
    .from('coach')
    .select('id, name, email')
    .eq('is_demo', false)
    .order('name', { ascending: true })
  for (const c of coaches ?? []) {
    const link = byCoach.get(c.id as string)
    rows.push({
      passlinkId: link?.id ?? null,
      role: 'coach',
      name: c.name as string,
      email: c.email as string,
      status: !link ? 'none' : link.revoked ? 'revoked' : 'active',
      lastUsedAt: link?.lastUsedAt ?? null,
      createdAt: link?.createdAt ?? null,
    })
  }

  const { data: students } = await admin
    .from('student')
    .select('id, first_name, last_name, email')
    .eq('status', 'active')
    .eq('is_demo', false)
    .order('last_name', { ascending: true })
  for (const s of students ?? []) {
    const link = byStudent.get(s.id as string)
    rows.push({
      passlinkId: link?.id ?? null,
      role: 'student',
      name: `${s.first_name as string} ${s.last_name as string}`.trim(),
      email: s.email as string,
      status: !link ? 'none' : link.revoked ? 'revoked' : 'active',
      lastUsedAt: link?.lastUsedAt ?? null,
      createdAt: link?.createdAt ?? null,
    })
  }

  return rows
}

export async function rotatePasslink(
  admin: Admin,
  passlinkId: string,
  baseUrl: string
): Promise<IssueResult> {
  const { data: link, error } = await admin
    .from('auth_passlink')
    .select('coach_id, student_id')
    .eq('id', passlinkId)
    .maybeSingle()
  if (error) throw error
  if (!link) {
    return { name: '', email: '', role: 'coach', status: 'error', url: null, detail: 'passlink not found' }
  }

  let subject: PilotSubject
  if (link.coach_id) {
    const { data: c } = await admin
      .from('coach')
      .select('name, email')
      .eq('id', link.coach_id as string)
      .maybeSingle()
    if (!c) return { name: '', email: '', role: 'coach', status: 'error', url: null, detail: 'coach not found' }
    subject = { kind: 'coach', email: c.email as string, name: c.name as string }
  } else {
    const { data: st } = await admin
      .from('student')
      .select('first_name, last_name, email')
      .eq('id', link.student_id as string)
      .maybeSingle()
    if (!st) return { name: '', email: '', role: 'student', status: 'error', url: null, detail: 'student not found' }
    subject = {
      kind: 'student',
      email: st.email as string,
      name: `${st.first_name as string} ${st.last_name as string}`.trim(),
    }
  }
  return ensureSubjectAndMint(admin, subject, baseUrl, true)
}

export async function revokeAllPasslinks(admin: Admin): Promise<number> {
  const { data, error } = await admin
    .from('auth_passlink')
    .update({ revoked_at: new Date().toISOString() })
    .is('revoked_at', null)
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

export function toCsv(rows: IssueResult[]): string {
  const header = ['name', 'email', 'role', 'status', 'url'].join(',')
  const body = rows.map(r =>
    [r.name, r.email, r.role, r.status, r.url ?? ''].map(csvCell).join(',')
  )
  return [header, ...body].join('\r\n') + '\r\n'
}
```

- [ ] **Step 4: Run test + tsc, verify Task 4 passes**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts` → Tasks 1–4 ✓, exit 0.
Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Lint + commit**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx eslint --no-eslintrc --config .eslintrc.json src/lib/auth/passlink-admin.ts` → exit 0.

```bash
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks add src/lib/auth/passlink-admin.ts scripts/test-student-passlinks.ts
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks commit -m "feat(passlink): passlink-admin lib (provision/mint, gather, roster, rotate, revoke-all, csv)"
```

---

### Task 5: Admin routes

**Files:** Create `src/app/api/admin/passlinks/issue/route.ts`, `src/app/api/admin/passlinks/route.ts`, `src/app/api/admin/passlinks/rotate/route.ts`, `src/app/api/admin/passlinks/revoke-all/route.ts`; Modify `scripts/test-student-passlinks.ts`

- [ ] **Step 1: Insert Task 5 test section** — replace `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<` with exactly:

```ts
section('Task 5: admin passlink routes')
{
  const issue = stripComments(read('src/app/api/admin/passlinks/issue/route.ts'))
  const roster = stripComments(read('src/app/api/admin/passlinks/route.ts'))
  const rotate = stripComments(read('src/app/api/admin/passlinks/rotate/route.ts'))
  const revoke = stripComments(read('src/app/api/admin/passlinks/revoke-all/route.ts'))
  for (const [name, src] of [['issue', issue], ['roster', roster], ['rotate', rotate], ['revoke', revoke]] as const) {
    assertEqual(/import \{ requireAdmin \} from '@\/lib\/auth\/require-admin'/.test(src), true, `${name}: uses requireAdmin`)
    assertEqual(/const gate = await requireAdmin\(\)/.test(src) && /!gate\.ok/.test(src), true, `${name}: gate enforced`)
    assertEqual(/export const runtime = 'nodejs'/.test(src) && /export const dynamic = 'force-dynamic'/.test(src), true, `${name}: runtime/dynamic`)
  }
  assertEqual(/text\/csv/.test(issue) && /Content-Disposition/.test(issue) && /attachment; filename=/.test(issue), true, 'issue returns CSV attachment')
  assertEqual(/gatherPilotSubjects/.test(issue) && /ensureSubjectAndMint/.test(issue) && /toCsv/.test(issue), true, 'issue uses lib')
  assertEqual(/getPasslinkRoster/.test(roster), true, 'roster uses getPasslinkRoster')
  assertEqual(/rotatePasslink/.test(rotate), true, 'rotate uses rotatePasslink')
  assertEqual(/revokeAllPasslinks/.test(revoke), true, 'revoke-all uses revokeAllPasslinks')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

- [ ] **Step 2: Run test, verify Task 5 fails**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts`
Expected: Tasks 1–4 ✓, Task 5 ✗; exit 1.

- [ ] **Step 3: Create `src/app/api/admin/passlinks/issue/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { gatherPilotSubjects, ensureSubjectAndMint, toCsv, type IssueResult } from '@/lib/auth/passlink-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/passlinks/issue[?rotateAll=1]
 * Bulk-provisions + mints passlinks for the whole pilot population and
 * returns a ONE-TIME CSV (name,email,role,status,url). Subjects with an
 * active link are skipped (status 'already-active', blank url) unless
 * ?rotateAll=1. ADMIN_EMAILS-gated.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.res

    const admin = createAdminClient()
    const baseUrl = req.nextUrl.origin
    const rotateAll = req.nextUrl.searchParams.get('rotateAll') === '1'

    const subjects = await gatherPilotSubjects(admin)
    const results: IssueResult[] = []
    for (const s of subjects) {
      results.push(await ensureSubjectAndMint(admin, s, baseUrl, rotateAll))
    }

    const csv = toCsv(results)
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pilot-passlinks-${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('passlinks/issue error:', error)
    return NextResponse.json({ error: 'Issue failed: ' + String(error) }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create `src/app/api/admin/passlinks/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getPasslinkRoster } from '@/lib/auth/passlink-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/admin/passlinks — roster + status (NO urls). ADMIN_EMAILS-gated. */
export async function GET() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.res
    const admin = createAdminClient()
    const roster = await getPasslinkRoster(admin)
    return NextResponse.json({ roster })
  } catch (error) {
    console.error('passlinks/roster error:', error)
    return NextResponse.json({ error: 'Roster failed: ' + String(error) }, { status: 500 })
  }
}
```

- [ ] **Step 5: Create `src/app/api/admin/passlinks/rotate/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { rotatePasslink } from '@/lib/auth/passlink-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST /api/admin/passlinks/rotate {passlinkId} — revoke+mint one subject, return {url}. ADMIN_EMAILS-gated. */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.res
    const body = (await req.json().catch(() => ({}))) as { passlinkId?: string }
    if (!body.passlinkId) {
      return NextResponse.json({ error: 'passlinkId required' }, { status: 400 })
    }
    const admin = createAdminClient()
    const result = await rotatePasslink(admin, body.passlinkId, req.nextUrl.origin)
    if (result.status === 'error') {
      return NextResponse.json({ error: result.detail }, { status: 400 })
    }
    return NextResponse.json({ url: result.url, email: result.email, role: result.role })
  } catch (error) {
    console.error('passlinks/rotate error:', error)
    return NextResponse.json({ error: 'Rotate failed: ' + String(error) }, { status: 500 })
  }
}
```

- [ ] **Step 6: Create `src/app/api/admin/passlinks/revoke-all/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import { revokeAllPasslinks } from '@/lib/auth/passlink-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** POST /api/admin/passlinks/revoke-all — kill every non-revoked link (pilot teardown). ADMIN_EMAILS-gated. */
export async function POST() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return gate.res
    const admin = createAdminClient()
    const revoked = await revokeAllPasslinks(admin)
    return NextResponse.json({ revoked })
  } catch (error) {
    console.error('passlinks/revoke-all error:', error)
    return NextResponse.json({ error: 'Revoke-all failed: ' + String(error) }, { status: 500 })
  }
}
```

- [ ] **Step 7: Run test + tsc, verify Task 5 passes**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts` → Tasks 1–5 ✓, exit 0.
Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsc --noEmit` → exit 0.

- [ ] **Step 8: Lint + commit**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx eslint --no-eslintrc --config .eslintrc.json "src/app/api/admin/passlinks/issue/route.ts" "src/app/api/admin/passlinks/route.ts" "src/app/api/admin/passlinks/rotate/route.ts" "src/app/api/admin/passlinks/revoke-all/route.ts"` → exit 0.

```bash
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks add "src/app/api/admin/passlinks" scripts/test-student-passlinks.ts
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks commit -m "feat(passlink): ADMIN-gated /api/admin/passlinks issue(csv)/roster/rotate/revoke-all"
```

---

### Task 6: Tools "Passlinks" tab + panel + prefetch

**Files:** Create `src/components/coach/PasslinksPanel.tsx`; Modify `src/app/v2/(coach)/coach/tools/ToolsView.tsx` (full replace); Modify `src/app/v2/(coach)/coach/tools/page.tsx` (full replace); Modify `scripts/test-student-passlinks.ts`

- [ ] **Step 1: Insert Task 6 test section** — replace `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<` with exactly:

```ts
section('Task 6: Tools Passlinks tab + panel + prefetch')
{
  const tv = stripComments(read('src/app/v2/(coach)/coach/tools/ToolsView.tsx'))
  assertEqual(/'passlinks'/.test(tv) && /label="Passlinks"/.test(tv), true, 'ToolsView has Passlinks tab')
  assertEqual(/<PasslinksPanel/.test(tv) && /from '@\/components\/coach\/PasslinksPanel'/.test(tv), true, 'renders PasslinksPanel')
  const pg = stripComments(read('src/app/v2/(coach)/coach/tools/page.tsx'))
  assertEqual(/getPasslinkRoster/.test(pg) && /from '@\/lib\/auth\/passlink-admin'/.test(pg), true, 'page prefetches roster')
  const pp = stripComments(read('src/components/coach/PasslinksPanel.tsx'))
  assertEqual(/'use client'/.test(pp), true, 'PasslinksPanel is client')
  assertEqual(/\/api\/admin\/passlinks\/issue/.test(pp) && /attachment|download|Blob/.test(pp), true, 'issue → CSV download')
  assertEqual(/\/api\/admin\/passlinks\/rotate/.test(pp), true, 'rotate wired')
  assertEqual(/\/api\/admin\/passlinks\/revoke-all/.test(pp) && /confirm\(/.test(pp), true, 'revoke-all confirm-gated')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

- [ ] **Step 2: Run test, verify Task 6 fails**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts`
Expected: Tasks 1–5 ✓, Task 6 ✗; exit 1.

- [ ] **Step 3: Create `src/components/coach/PasslinksPanel.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { RosterRow } from '@/lib/auth/passlink-admin'

/**
 * Admin panel: issue/list/rotate/revoke pilot login links. URLs are
 * never displayed in the list (hashed at rest) — they exist only in
 * the one-time CSV download and in a single rotate result.
 */
export function PasslinksPanel({ roster }: { roster: RosterRow[] }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [rotated, setRotated] = useState<{ email: string; url: string } | null>(null)

  async function issueAll(rotateAll: boolean) {
    setBusy('issue')
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/passlinks/issue${rotateAll ? '?rotateAll=1' : ''}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pilot-passlinks-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setMsg('CSV downloaded. Distribute it now — URLs are not stored and cannot be re-listed.')
    } catch (e) {
      setMsg(`Issue failed: ${String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  async function rotateOne(passlinkId: string, email: string) {
    setBusy(passlinkId)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/passlinks/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passlinkId }),
      })
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !j.url) throw new Error(j.error || `HTTP ${res.status}`)
      setRotated({ email, url: j.url })
    } catch (e) {
      setMsg(`Rotate failed: ${String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  async function revokeAll() {
    if (!confirm('Revoke ALL pilot login links? Everyone will need a re-issued link.')) return
    setBusy('revoke-all')
    setMsg(null)
    try {
      const res = await fetch('/api/admin/passlinks/revoke-all', { method: 'POST' })
      const j = (await res.json().catch(() => ({}))) as { revoked?: number; error?: string }
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setMsg(`Revoked ${j.revoked ?? 0} link(s). Reload to refresh status.`)
    } catch (e) {
      setMsg(`Revoke-all failed: ${String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Pilot passlinks</h2>
        <span className="text-xs text-gray-500">{roster.length} subjects</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => issueAll(false)}
          className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
        >
          {busy === 'issue' ? 'Issuing…' : 'Issue links for everyone (download CSV)'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => issueAll(true)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:border-gray-400 disabled:opacity-50"
        >
          Rotate ALL + re-export
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={revokeAll}
          className="px-3 py-2 bg-white border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
        >
          Revoke ALL
        </button>
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
          {msg}
        </div>
      )}
      {rotated && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-900 break-all">
          New link for <strong>{rotated.email}</strong> (shown once — copy it now):<br />
          {rotated.url}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Last used</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {roster.map(r => (
              <tr key={`${r.role}:${r.email}`} className="border-b border-gray-100">
                <td className="py-2 pr-3 text-gray-900">{r.name}</td>
                <td className="py-2 pr-3 text-gray-600">{r.email}</td>
                <td className="py-2 pr-3 text-gray-600">{r.role}</td>
                <td className="py-2 pr-3">
                  <span
                    className={
                      r.status === 'active'
                        ? 'text-green-700'
                        : r.status === 'revoked'
                          ? 'text-red-700'
                          : 'text-gray-400'
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-500">
                  {r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleDateString() : '—'}
                </td>
                <td className="py-2">
                  {r.passlinkId && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => rotateOne(r.passlinkId as string, r.email)}
                      className="text-xs text-green-700 hover:text-green-900 hover:underline disabled:opacity-50"
                    >
                      Rotate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Replace `src/app/v2/(coach)/coach/tools/ToolsView.tsx` entirely**

```tsx
'use client'

import { useState } from 'react'
import { SyncStatusPanel } from '@/components/coach/SyncStatusPanel'
import { SyncInspectorPanel } from '@/components/coach/SyncInspectorPanel'
import { LTIInspectorPanel } from '@/components/coach/LTIInspectorPanel'
import { LiveActivityPanel } from '@/components/coach/LiveActivityPanel'
import { RecoverExtractionsPanel } from '@/components/coach/RecoverExtractionsPanel'
import { PasslinksPanel } from '@/components/coach/PasslinksPanel'
import type { SyncRun } from '@/lib/types'
import type { RosterRow } from '@/lib/auth/passlink-admin'

/**
 * Tabbed view of the admin observability panels. Reuses the existing
 * v1 components wholesale — each is already a self-contained client
 * component with its own data fetching and UI state.
 */
type Tab = 'sync' | 'lti' | 'activity' | 'passlinks'

interface ToolsViewProps {
  recentSyncRuns: SyncRun[]
  lastSuccessful: SyncRun | null
  passlinkRoster: RosterRow[]
}

export function ToolsView({ recentSyncRuns, lastSuccessful, passlinkRoster }: ToolsViewProps) {
  const [tab, setTab] = useState<Tab>('sync')

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <TabBtn label="Sync" active={tab === 'sync'} onClick={() => setTab('sync')} />
        <TabBtn label="LTI" active={tab === 'lti'} onClick={() => setTab('lti')} />
        <TabBtn label="Live Activity" active={tab === 'activity'} onClick={() => setTab('activity')} />
        <TabBtn label="Passlinks" active={tab === 'passlinks'} onClick={() => setTab('passlinks')} />
      </div>

      {tab === 'sync' && (
        <div className="space-y-5">
          <SyncStatusPanel recentRuns={recentSyncRuns} lastSuccessful={lastSuccessful} />
          <SyncInspectorPanel />
          <RecoverExtractionsPanel />
        </div>
      )}
      {tab === 'lti' && <LTIInspectorPanel />}
      {tab === 'activity' && <LiveActivityPanel />}
      {tab === 'passlinks' && <PasslinksPanel roster={passlinkRoster} />}
    </div>
  )
}

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 -mb-px border-b-2 text-sm transition-colors ${
        active
          ? 'border-green-700 text-green-900 font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 5: Replace `src/app/v2/(coach)/coach/tools/page.tsx` entirely**

```tsx
import { redirect } from 'next/navigation'
import { getRecentSyncRuns, getLastSuccessfulSyncRun } from '@/lib/queries'
import { getV2Identity, isAdminEmail } from '@/lib/v2-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { getPasslinkRoster } from '@/lib/auth/passlink-admin'
import { ToolsView } from './ToolsView'

/**
 * v2 Tools — admin observability surface.
 *
 * Relocates the Sync / LTI / Live Activity / Sync Status panels off
 * the main /coach Today view. Gated to ADMIN_EMAILS via real auth
 * identity (getV2Identity) — NOT getCurrentCoach, which in demo mode
 * returns the demo coach (Elizabeth) and would fail the admin check
 * even for the actual builder.
 */
export default async function V2ToolsPage() {
  const identity = await getV2Identity()
  if (!identity) redirect('/login')

  const allowed = identity.role === 'coach' && isAdminEmail(identity.email)
  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Not available
          </h1>
          <p className="text-sm text-gray-600">
            Tools are limited to designated administrators. If you think you
            should have access, contact NLU IT.
          </p>
        </div>
      </div>
    )
  }

  // Pre-fetch the sync data the SyncStatusPanel needs server-side
  // (it expects props rather than fetching itself).
  const admin = createAdminClient()
  const [recentSyncRuns, lastSuccessful, passlinkRoster] = await Promise.all([
    getRecentSyncRuns(5),
    getLastSuccessfulSyncRun(),
    getPasslinkRoster(admin),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tools</h1>
        <p className="text-sm text-gray-500 mt-1">
          Admin views for the integrations powering the portfolio.
        </p>
      </div>
      <ToolsView
        recentSyncRuns={recentSyncRuns}
        lastSuccessful={lastSuccessful}
        passlinkRoster={passlinkRoster}
      />
    </div>
  )
}
```

- [ ] **Step 6: Run test + tsc, verify Task 6 passes**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts` → Tasks 1–6 ✓, exit 0.
Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsc --noEmit` → exit 0.

- [ ] **Step 7: Lint + commit**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx eslint --no-eslintrc --config .eslintrc.json src/components/coach/PasslinksPanel.tsx "src/app/v2/(coach)/coach/tools/ToolsView.tsx" "src/app/v2/(coach)/coach/tools/page.tsx"` → exit 0.

```bash
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks add src/components/coach/PasslinksPanel.tsx "src/app/v2/(coach)/coach/tools/ToolsView.tsx" "src/app/v2/(coach)/coach/tools/page.tsx" scripts/test-student-passlinks.ts
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks commit -m "feat(passlink): Tools Passlinks tab — issue CSV / status / rotate / revoke-all"
```

---

### Task 7: Whole-feature verification + owner runbook

**Files:** none modified (verification only).

- [ ] **Step 1: Full structural test green**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-student-passlinks.ts`
Expected: every section ✓; `N passed, 0 failed`; exit 0.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Lint all created/changed source files**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx eslint --no-eslintrc --config .eslintrc.json src/lib/auth/require-admin.ts src/lib/auth/passlink-admin.ts "src/app/api/auth/passlink/route.ts" "src/app/api/admin/passlinks/issue/route.ts" "src/app/api/admin/passlinks/route.ts" "src/app/api/admin/passlinks/rotate/route.ts" "src/app/api/admin/passlinks/revoke-all/route.ts" src/components/coach/PasslinksPanel.tsx "src/app/v2/(coach)/coach/tools/ToolsView.tsx" "src/app/v2/(coach)/coach/tools/page.tsx"`
Expected: exit 0, no output.

- [ ] **Step 4: Production build**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npm run build`
Expected: exit 0 (`.env.local` present; the `auth_passlink.student_id` column need NOT exist for build — queries are untyped).

- [ ] **Step 5: Regression — merged staff-passlink intact**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/student-passlinks && npx tsx scripts/test-staff-passlink.ts`
Expected: still `35 passed, 0 failed`, exit 0 (the coach path / scripts / redirect-with-session were not regressed).

- [ ] **Step 6: Owner runbook (owner-performed — NOT the implementer; record in PR)**

1. Apply `supabase/migrations/017_auth_passlink.sql` (if not already) **then** `018_auth_passlink_student.sql` via the Supabase migration workflow. Reversible: drop `auth_passlink_student_active_idx`, drop constraint `auth_passlink_one_subject`, `alter table auth_passlink drop column student_id`, `alter table auth_passlink alter column coach_id set not null`.
2. Sign in as an ADMIN_EMAILS coach → `/v2/coach/tools` → **Passlinks** tab.
3. "Issue links for everyone (download CSV)" → CSV downloads with ~81 rows (`status` = minted; `url` populated).
4. Open a **student** row's URL in a logged-out/incognito browser → lands authenticated on `/v2/today` as that student.
5. Open a **coach/instructor** row's URL → lands on `/v2/coach`.
6. Per-row **Rotate** → returns a fresh URL (shown once); the old URL → `/login?error=invalid_link`.
7. Re-run "Issue links for everyone" without rotate → CSV shows `already-active`, blank url (idempotent; existing links still work).
8. **Revoke ALL** (confirm) → every link → `/login?error=invalid_link` (clean pilot teardown).

- [ ] **Step 7: Finish**

Use `superpowers:finishing-a-development-branch` — present the standard options to the owner. **No autonomous merge/push.** Surface that the owner must apply `017` + `018` before the feature is live, and the security residual (the downloaded CSV is the only place URLs exist — distribute/store it carefully; `Revoke ALL` is the teardown).

---

## Self-Review

**1. Spec coverage** — every spec section maps to a task: 018 generalization (T1); reusable admin gate (T2, DRY across the 4 routes — a justified targeted improvement, no shared helper existed); endpoint student branch + coach byte-equivalent + generic error + middleware/redirect-with-session regression (T3); `ensureSubjectAndMint`/`gatherPilotSubjects`/`getPasslinkRoster`/`rotatePasslink`/`revokeAllPasslinks`/`toCsv`, instructor-as-coach + lowercased dedup + students-must-exist + idempotent/rotate + hashed token (T4); 4 ADMIN_EMAILS-gated routes incl. one-time CSV attachment (T5); Passlinks tab + panel (issue→download, rotate-once-display, confirm-gated revoke-all) + page prefetch (T6); gates + regression + owner runbook + finish-with-options (T7). Export-once/hashed-at-rest: tokens only ever `sha256hex` at rest; URL returned once in CSV / rotate result; roster has no urls — satisfied. FERPA/teardown: revoke-all + per-row rotate + ADMIN gate — satisfied. Out-of-scope items (instructor view, plaintext storage, LTI, SMTP, middleware/callback/coach-CLI changes) are not built; T3/T7 assert the regression.

**2. Placeholder scan** — no TBD/TODO; every code step is complete verbatim source; every command has exact expected output; the single insertion marker is an explicit mechanism. Owner migration-apply is deliberately owner-gated (stated), not "later".

**3. Type/name consistency** — `PilotSubject{kind,email,name}`, `IssueResult{name,email,role,status,url,detail}`, `RosterRow{passlinkId,role,name,email,status,lastUsedAt,createdAt}`, `SubjectKind='coach'|'student'` defined in T4 are imported/used identically in T5 (`type IssueResult`), T6 (`type RosterRow`, `PasslinksPanel({roster})`), and the page prefetch. `requireAdmin()`’s `{ok:true,adminEmail}|{ok:false,res}` used identically in all 4 T5 routes (`const gate = await requireAdmin(); if (!gate.ok) return gate.res`). `ensureSubjectAndMint(admin, subject, baseUrl, rotate?)` signature consistent T4↔T5↔`rotatePasslink`. `getPasslinkRoster(admin)` consistent T4↔T5↔T6 page. Column `[col]` = `'coach_id'|'student_id'` consistent with the endpoint's `select('id, coach_id, student_id, revoked_at')` (T3) and migration (T1). `STUDENT_LANDING` default string identical to the recon'd LTI constant. No dangling refs.

No issues found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-19-student-passlinks-admin.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh implementer per task, two-stage review (spec-compliance then code-quality) between tasks, in a new `.worktrees/student-passlinks` worktree off `main`.

**2. Inline Execution** — execute the 7 tasks in this session with batched checkpoints.

Which approach?
