# Staff Passlink Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A permanent, per-coach, bookmarkable login URL (no email, no domain) that logs that coach in — the non-LTI staff auth bridge while SMTP is blocked.

**Architecture:** One additive migration (`auth_passlink`, hashed token at rest, revocable) + a pure refactor extracting the existing `redirectWithSession` helper into a shared module + a `GET /api/auth/passlink` endpoint that validates a token and **delegates to the existing vetted `redirectWithSession → /api/auth/callback (verifyOtp)`** session path + two standalone CLI scripts (issue/revoke). Coach-only (instructors are coach rows in v2). No middleware change (route is public via the existing `/api/auth` allowlist prefix).

**Tech Stack:** Next.js App Router (TypeScript, `strict`), Supabase (`@supabase/supabase-js` service-role admin client), node `crypto`, `tsx` for scripts, repo structural source-scan tests.

---

## Pre-flight (read before Task 1)

**Worktree & environment (execution harness sets this up):**
- Work in a NEW worktree `.worktrees/staff-passlink` branched from current `main` HEAD. Do **not** touch any other worktree under `.worktrees/`.
- Copy the gitignored `/Users/andrewcurran/le3-growth-portfolio/.env.local` into the worktree root so `npm run build` is faithful and the scripts can run (they read `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LTI_TOOL_URL` from `.env.local`).
- Shell cwd resets between Bash commands — always use absolute paths or `git -C <worktree>` / `cd <worktree> &&`.

**Auth-sensitive + DB side effect — important:**
- This touches the auth boundary and adds a DB table. The migration is **additive and reversible** (`drop table auth_passlink;`), but the implementer subagent must **NOT apply it to the database**. Migration application is an **owner step** in the final runbook (Task 6), via the repo's normal Supabase migration workflow — not ad-hoc. The code compiles/builds/lints without the table existing (queries are untyped; no generated-types dependency), and the structural test only scans the SQL file.
- The final `superpowers:finishing-a-development-branch` step presents the standard options to the owner. **No autonomous merge or push.**

**Repo conventions (enforced by every task):**
- Automated test = a single standalone structural source-scan script `scripts/test-staff-passlink.ts` run with `npx tsx scripts/test-staff-passlink.ts`. It imports `{ assertEqual, section, finish }` from `./_sync-test-harness`, defines local `read()`/`stripComments()` helpers, has one `section(...)` + `{ }` block per task, and exactly one trailing `finish()`. No `bootstrapTestEnv()` (pure scan). Route handlers / scripts / SQL can't execute under tsx — assert structure on comment-stripped (or raw, for `.sql`) source.
- Gates (from the worktree root): `npx tsc --noEmit` exit 0; `npx eslint --no-eslintrc --config .eslintrc.json <files>` no warnings/errors (NEVER `npx next lint` — broken in worktrees); `npm run build` exit 0.
- `@/` path alias → `src/` (tsconfig). **CLI scripts must NOT use `@/` imports** (raw `tsx` doesn't resolve the alias) — mirror `scripts/seed-test-student.ts`: `dotenv` `.env.local`, own `createClient`, relative/node imports only.
- Commit after every task (frequent commits) with `git -C <worktree> add <exact files>`.

**Provide each implementer subagent the full task text — do not have them read this plan file.**

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/017_auth_passlink.sql` | `auth_passlink` table (hashed token, revocable), RLS on/no-policy | Create |
| `src/lib/auth/redirect-with-session.ts` | Shared `redirectWithSession()` (moved verbatim from launch route) | Create |
| `src/app/api/lti/launch/route.ts` | Import the shared helper instead of defining it (byte-identical behavior) | Modify |
| `src/app/api/auth/passlink/route.ts` | Validate token → delegate to session path; generic error | Create |
| `scripts/issue-passlink.ts` | Provision coach+auth user, mint/rotate token, print URL | Create |
| `scripts/revoke-passlink.ts` | Revoke a coach's active links | Create |
| `scripts/test-staff-passlink.ts` | Structural source-scan invariants (one section per task) | Create |

---

### Task 1: Migration — `auth_passlink` table

**Files:**
- Create: `supabase/migrations/017_auth_passlink.sql`
- Create: `scripts/test-staff-passlink.ts`

- [ ] **Step 1: Confirm the next migration number is 017**

Run: `ls /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink/supabase/migrations | sort | tail -3`
Expected: highest numbered file is `016_student_data_consent.sql` (so `017_` is correct). If a higher number exists, use the next sequential number consistently everywhere below.

- [ ] **Step 2: Create the structural test with the Task 1 section (the failing test)**

Create `scripts/test-staff-passlink.ts` with exactly this content:

```ts
/**
 * Structural invariants for the staff passlink auth bridge.
 * Routes/scripts/SQL can't run under tsx; comment-stripped source scan
 * (SQL read raw). USAGE: npx tsx scripts/test-staff-passlink.ts
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

section('Task 1: 017_auth_passlink.sql migration')
{
  const sql = read('supabase/migrations/017_auth_passlink.sql')
  assertEqual(/create table auth_passlink/.test(sql), true, 'creates auth_passlink table')
  assertEqual(/coach_id uuid not null references coach\(id\) on delete cascade/.test(sql), true, 'coach_id FK with cascade')
  assertEqual(/token_hash text not null unique/.test(sql), true, 'token_hash text not null unique')
  assertEqual(/revoked_at timestamptz/.test(sql), true, 'revoked_at column')
  assertEqual(/last_used_at timestamptz/.test(sql), true, 'last_used_at column')
  assertEqual(/alter table auth_passlink enable row level security/.test(sql), true, 'RLS enabled')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
finish()
```

- [ ] **Step 3: Run the test, verify Task 1 fails**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsx scripts/test-staff-passlink.ts`
Expected: FAIL — `✗ creates auth_passlink table` etc. (migration not written yet); exit 1.

- [ ] **Step 4: Create `supabase/migrations/017_auth_passlink.sql`**

Create the file with exactly this content (mirrors the `015_event_log.sql` convention — `--` header block, lowercase, indexes then `enable row level security`, `comment on` at the end, no policy):

```sql
-- Permanent per-coach login link tokens (the "staff passlink" bridge).
--
-- Non-LTI staff (coaches; instructors are coach rows in v2) cannot use
-- magic-link email login: Supabase's built-in email provider is
-- project-rate-limited and no controllable sending domain exists yet to
-- configure custom SMTP. Students and LTI launches are unaffected.
--
-- Each row is one permanent, revocable, bookmarkable login token for a
-- coach. The token itself is never stored — only its SHA-256 hash. The
-- /api/auth/passlink endpoint hashes the presented token, looks up a
-- non-revoked row, and delegates to the existing verifyOtp/callback
-- session path. Issued/rotated/revoked via scripts/*-passlink.ts.
--
-- Written only via the service-role admin client. RLS is enabled with
-- no policy — same convention as event_log/instructor: anon and
-- authenticated get deny-all; the service role bypasses RLS.

create table auth_passlink (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coach(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index auth_passlink_coach_id_idx
  on auth_passlink (coach_id);

create index auth_passlink_active_idx
  on auth_passlink (coach_id)
  where revoked_at is null;

alter table auth_passlink enable row level security;

comment on table auth_passlink is 'Permanent per-coach login-link tokens (no-email staff auth bridge). Service-role only. Issue/rotate/revoke via scripts/issue-passlink.ts and scripts/revoke-passlink.ts.';
comment on column auth_passlink.token_hash is 'SHA-256 hex of the URL token. The plaintext token is never stored and is unrecoverable after issuance.';
comment on column auth_passlink.revoked_at is 'When set, the link is dead. Endpoint lookups filter revoked_at is null.';
```

- [ ] **Step 5: Run the test, verify Task 1 passes**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsx scripts/test-staff-passlink.ts`
Expected: PASS — all Task 1 assertions `✓`; `6 passed, 0 failed`; exit 0.

- [ ] **Step 6: Commit**

```bash
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink add supabase/migrations/017_auth_passlink.sql scripts/test-staff-passlink.ts
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink commit -m "feat(passlink): auth_passlink migration + structural test"
```

---

### Task 2: Extract `redirectWithSession` to a shared module (pure refactor)

**Files:**
- Create: `src/lib/auth/redirect-with-session.ts`
- Modify: `src/app/api/lti/launch/route.ts` (remove local def lines 528–572; add one import)
- Modify: `scripts/test-staff-passlink.ts` (insert Task 2 section)

- [ ] **Step 1: Insert the Task 2 test section**

In `scripts/test-staff-passlink.ts`, replace the line `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<` with exactly:

```ts
section('Task 2: redirectWithSession extracted to shared module')
{
  const mod = stripComments(read('src/lib/auth/redirect-with-session.ts'))
  assertEqual(/export async function redirectWithSession\s*\(/.test(mod), true, 'shared module exports redirectWithSession')
  assertEqual(/type: 'magiclink'/.test(mod) && /hashed_token/.test(mod), true, 'mints magiclink hashed_token')
  assertEqual(/\/api\/auth\/callback\?/.test(mod), true, 'redirects to /api/auth/callback')
  const launch = stripComments(read('src/app/api/lti/launch/route.ts'))
  assertEqual(/import \{ redirectWithSession \} from '@\/lib\/auth\/redirect-with-session'/.test(launch), true, 'launch route imports the shared helper')
  assertEqual(/async function redirectWithSession\s*\(/.test(launch), false, 'launch route no longer defines redirectWithSession locally')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

- [ ] **Step 2: Run the test, verify Task 2 fails**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsx scripts/test-staff-passlink.ts`
Expected: FAIL — Task 1 `✓`, Task 2 `✗ shared module exports redirectWithSession`; exit 1.

- [ ] **Step 3: Create `src/lib/auth/redirect-with-session.ts`**

Create the file with exactly this content (verbatim body from `src/app/api/lti/launch/route.ts:528-572`; `createAdminClient` imported as a value because it is used in the `ReturnType<typeof createAdminClient>` type query — identical to the original):

```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * Generate a Supabase session for the user and redirect to our callback
 * to consume it.
 *
 * Implementation note: we use admin.generateLink with type='magiclink' to
 * mint a hashed token, then redirect to our own callback with that token.
 * The callback calls verifyOtp({ type: 'magiclink', token_hash }) to
 * exchange it for a session — that's the SSR-compatible flow.
 *
 * What does NOT work: redirecting to data.properties.action_link directly.
 * That URL goes through Supabase's hosted /auth/v1/verify handler which
 * doesn't return an OAuth `code` param to our callback (the action_link
 * either uses the implicit flow with URL fragments, which servers can't
 * read, or PKCE which our callback wasn't initiated for). Result: user
 * lands on /api/auth/callback with no recognizable auth params and gets
 * bounced to /login.
 */
export async function redirectWithSession(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  redirectPath: string,
  origin: string
): Promise<NextResponse> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (error || !data.properties?.hashed_token) {
    console.error('Failed to generate magic link:', error)
    return NextResponse.redirect(new URL('/login', origin), 302)
  }

  // Hand the hashed token to our callback in a query param. Callback
  // verifies it server-side and sets the session cookie on our domain.
  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
    next: redirectPath,
  })
  return NextResponse.redirect(
    new URL(`/api/auth/callback?${params.toString()}`, origin),
    302
  )
}
```

- [ ] **Step 4: Edit `src/app/api/lti/launch/route.ts` — add the import**

In the import block (lines 1–11), add this line immediately after line 11 (`import { ACTIVE_ROLE_COOKIE } from '@/lib/v2-auth'`):

```ts
import { redirectWithSession } from '@/lib/auth/redirect-with-session'
```

- [ ] **Step 5: Edit `src/app/api/lti/launch/route.ts` — delete the local definition**

Delete lines 528–572 inclusive — the entire block starting with the doc comment `/**\n * Generate a Supabase session for the user and redirect to our callback` through the closing `}` of `redirectWithSession` (it is the last code in the file; the file should now end after the line that precedes line 528). Use the Edit tool with `old_string` = the full verbatim block (the doc comment lines 528-544 plus the function lines 545-572 exactly as they appear in the file) and `new_string` = empty. The three call sites at lines 264, 304, 467 are unchanged and now resolve to the imported function.

- [ ] **Step 6: Verify behavior is byte-identical + test passes**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsc --noEmit`
Expected: exit 0 (the imported function has the identical signature; the three call sites compile unchanged).
Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsx scripts/test-staff-passlink.ts`
Expected: PASS — Task 1 + Task 2 `✓`; exit 0.

- [ ] **Step 7: Lint + commit**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx eslint --no-eslintrc --config .eslintrc.json src/lib/auth/redirect-with-session.ts "src/app/api/lti/launch/route.ts"`
Expected: exit 0, no output.

```bash
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink add src/lib/auth/redirect-with-session.ts "src/app/api/lti/launch/route.ts" scripts/test-staff-passlink.ts
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink commit -m "refactor(auth): extract redirectWithSession to shared module (no behavior change)"
```

---

### Task 3: `GET /api/auth/passlink` endpoint

**Files:**
- Create: `src/app/api/auth/passlink/route.ts`
- Modify: `scripts/test-staff-passlink.ts` (insert Task 3 section)

- [ ] **Step 1: Insert the Task 3 test section**

In `scripts/test-staff-passlink.ts`, replace the line `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<` with exactly:

```ts
section('Task 3: /api/auth/passlink endpoint + middleware unchanged')
{
  const r = stripComments(read('src/app/api/auth/passlink/route.ts'))
  assertEqual(/export const dynamic = 'force-dynamic'/.test(r) && /export const runtime = 'nodejs'/.test(r), true, 'dynamic + nodejs runtime')
  assertEqual(/createHash\('sha256'\)/.test(r), true, 'hashes token with SHA-256')
  assertEqual(/from\('auth_passlink'\)/.test(r) && /\.is\('revoked_at', null\)/.test(r), true, 'looks up non-revoked auth_passlink')
  assertEqual(/from\('coach'\)/.test(r) && /status !== 'active'/.test(r), true, 'requires active coach')
  assertEqual(/import \{ redirectWithSession \} from '@\/lib\/auth\/redirect-with-session'/.test(r) && /redirectWithSession\(\s*admin,/.test(r), true, 'delegates to shared session helper')
  assertEqual(/'\/v2\/coach'/.test(r), true, 'lands on /v2/coach')
  assertEqual(/\/login\?error=invalid_link/.test(r), true, 'generic invalid_link error')
  assertEqual(/ACTIVE_ROLE_COOKIE/.test(r), true, 'sets active-role cookie (coach)')
  const mw = stripComments(read('src/middleware.ts'))
  assertEqual(/pathname\.startsWith\('\/api\/auth'\)/.test(mw), true, 'middleware still public-allowlists /api/auth (passlink inherits it)')
  assertEqual(/passlink/.test(mw), false, 'middleware NOT edited for passlink')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

- [ ] **Step 2: Run the test, verify Task 3 fails**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsx scripts/test-staff-passlink.ts`
Expected: FAIL — Tasks 1–2 `✓`, Task 3 `✗ dynamic + nodejs runtime`; exit 1.

- [ ] **Step 3: Create `src/app/api/auth/passlink/route.ts`**

Create the file with exactly this content:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirectWithSession } from '@/lib/auth/redirect-with-session'
import { ACTIVE_ROLE_COOKIE } from '@/lib/v2-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/auth/passlink?t=<token>
 *
 * Permanent per-coach login link — the no-email staff auth bridge.
 * Validates the token (SHA-256 hash lookup, non-revoked, coach active),
 * then delegates to the existing redirectWithSession → /api/auth/callback
 * verifyOtp path. No bespoke session handling. Public via the /api/auth
 * middleware allowlist prefix (middleware unchanged).
 *
 * Every failure redirects to the SAME generic /login?error=invalid_link
 * (no token enumeration). Issued/revoked via scripts/*-passlink.ts.
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
    .select('id, coach_id, revoked_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle()

  if (!link) return invalid(origin)

  const { data: coach } = await admin
    .from('coach')
    .select('id, email, status')
    .eq('id', link.coach_id as string)
    .maybeSingle()

  if (!coach || coach.status !== 'active') return invalid(origin)

  // Best-effort usage stamp; a failed stats write must not block sign-in.
  await admin
    .from('auth_passlink')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', link.id as string)

  const res = await redirectWithSession(
    admin,
    coach.email as string,
    '/v2/coach',
    origin
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

- [ ] **Step 4: Run the test + typecheck, verify Task 3 passes**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsx scripts/test-staff-passlink.ts`
Expected: PASS — Tasks 1–3 `✓`; exit 0.
Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Lint + commit**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx eslint --no-eslintrc --config .eslintrc.json "src/app/api/auth/passlink/route.ts"`
Expected: exit 0, no output.

```bash
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink add "src/app/api/auth/passlink/route.ts" scripts/test-staff-passlink.ts
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink commit -m "feat(passlink): GET /api/auth/passlink (validate token, delegate to session path)"
```

---

### Task 4: `scripts/issue-passlink.ts`

**Files:**
- Create: `scripts/issue-passlink.ts`
- Modify: `scripts/test-staff-passlink.ts` (insert Task 4 section)

- [ ] **Step 1: Insert the Task 4 test section**

In `scripts/test-staff-passlink.ts`, replace the line `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<` with exactly:

```ts
section('Task 4: scripts/issue-passlink.ts')
{
  const s = stripComments(read('scripts/issue-passlink.ts'))
  assertEqual(/dotenvConfig\(\{ path: '\.env\.local' \}\)/.test(s), true, 'loads .env.local before supabase import')
  assertEqual(/SUPABASE_SERVICE_ROLE_KEY/.test(s) && /createClient\(/.test(s), true, 'own service-role client (no @/ import)')
  assertEqual(/from '@\//.test(s), false, 'no @/ alias imports (tsx-safe)')
  assertEqual(/admin\.createUser|auth\.admin\.createUser/.test(s) && /email_confirm: true/.test(s), true, 'provisions auth user')
  assertEqual(/from\('coach'\)/.test(s) && /status: 'active'/.test(s), true, 'ensures an active coach row')
  assertEqual(/randomBytes\(32\)/.test(s) && /createHash\('sha256'\)/.test(s), true, '256-bit token, stored hashed')
  assertEqual(/from\('auth_passlink'\)[\s\S]{0,80}\.insert/.test(s), true, 'inserts auth_passlink row')
  assertEqual(/--rotate/.test(s) && /revoked_at/.test(s), true, '--rotate revokes prior links')
  assertEqual(/process\.env\.LTI_TOOL_URL/.test(s), true, 'builds URL from LTI_TOOL_URL')
  assertEqual(/NOT minting|already exists/i.test(s), true, 'idempotent no-op path when active link exists')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

- [ ] **Step 2: Run the test, verify Task 4 fails**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsx scripts/test-staff-passlink.ts`
Expected: FAIL — Tasks 1–3 `✓`, Task 4 `✗ loads .env.local before supabase import`; exit 1.

- [ ] **Step 3: Create `scripts/issue-passlink.ts`**

Create the file with exactly this content (bootstrap mirrors `scripts/seed-test-student.ts`; `deriveNameFromEmail` is inlined verbatim from `src/app/api/auth/callback/route.ts:257-266` because it is local/unexported there):

```ts
/**
 * Issue (or rotate) a permanent per-coach login link — the no-email
 * staff auth bridge. Coach-only (instructors are coach rows in v2;
 * students are LTI-only and must never be issued links).
 *
 * Writes (prod): ensures a Supabase auth user + an ACTIVE coach row for
 * <email> (so /api/auth/callback links the coach instead of deleting
 * the user), then mints one auth_passlink row (only the SHA-256 hash of
 * the token is stored) and prints the permanent URL ONCE — save it, it
 * is unrecoverable afterward.
 *
 * Idempotent: if an active (non-revoked) link already exists and
 * --rotate is NOT passed, prints a status report and exits WITHOUT
 * minting or rotating (the existing bookmark keeps working forever).
 * --rotate revokes the coach's active links and mints a fresh one.
 *
 * Requires env (.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, LTI_TOOL_URL.
 *
 * Run: npx tsx scripts/issue-passlink.ts <email> [--name "Full Name"] [--rotate]
 */

// Load .env.local before importing the supabase client (dotenv/config
// defaults to .env which Next.js doesn't use).
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.LTI_TOOL_URL
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!baseUrl) {
  console.error('Missing LTI_TOOL_URL (deployed origin used to build the link URL)')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// Verbatim from src/app/api/auth/callback/route.ts:257-266 (local,
// unexported there) — kept in sync so issued coaches get the same
// display name the callback's admin path would derive.
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

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const target = email.toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const users = data?.users ?? []
    const hit = users.find(u => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit.id
    if (users.length < 1000) break
  }
  return null
}

async function main() {
  const args = process.argv.slice(2)
  const positionals = args.filter(a => !a.startsWith('--'))
  const email = positionals[0]
  if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx scripts/issue-passlink.ts <email> [--name "Full Name"] [--rotate]')
    process.exit(1)
  }
  const rotate = args.includes('--rotate')
  const nameIdx = args.indexOf('--name')
  const nameArg = nameIdx >= 0 ? args[nameIdx + 1] : undefined

  console.log('▶ Ensuring Supabase auth user…')
  let authUserId = await findAuthUserIdByEmail(email)
  if (authUserId) {
    console.log(`  reused existing auth user ${authUserId}`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (error || !data?.user) {
      throw new Error(`Failed to create auth user for ${email}: ${error?.message ?? 'no user'}`)
    }
    authUserId = data.user.id
    console.log(`  created auth user ${authUserId}`)
  }

  console.log('▶ Ensuring active coach row…')
  const { data: coachRow, error: coachErr } = await supabase
    .from('coach')
    .select('id, auth_user_id, status')
    .eq('email', email)
    .maybeSingle()
  if (coachErr) throw coachErr

  let coachId: string
  if (coachRow?.id) {
    coachId = coachRow.id as string
    const patch: Record<string, unknown> = {}
    if (!coachRow.auth_user_id) patch.auth_user_id = authUserId
    if (coachRow.status !== 'active') patch.status = 'active'
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('coach').update(patch).eq('id', coachId)
      if (error) throw error
      console.log(`  updated coach ${coachId} ${JSON.stringify(patch)}`)
    } else {
      console.log(`  reused coach ${coachId}`)
    }
  } else {
    const { data: inserted, error } = await supabase
      .from('coach')
      .insert({
        auth_user_id: authUserId,
        name: nameArg || deriveNameFromEmail(email),
        email,
        status: 'active',
      })
      .select('id')
      .single()
    if (error || !inserted) throw new Error(`Failed to insert coach: ${error?.message ?? 'no row'}`)
    coachId = inserted.id as string
    console.log(`  created coach ${coachId}`)
  }

  const { data: active, error: activeErr } = await supabase
    .from('auth_passlink')
    .select('id, created_at, last_used_at')
    .eq('coach_id', coachId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (activeErr) throw activeErr

  if (active && active.length > 0 && !rotate) {
    console.log('\n● An active link already exists — NOT minting (idempotent).')
    for (const l of active) {
      console.log(`  • created ${l.created_at}  last_used ${l.last_used_at ?? 'never'}`)
    }
    console.log('\nThe existing bookmarked URL still works. To invalidate it and')
    console.log('issue a NEW url, re-run with --rotate. (The old URL cannot be')
    console.log('reprinted — only its hash is stored.)')
    return
  }

  if (rotate && active && active.length > 0) {
    const { error } = await supabase
      .from('auth_passlink')
      .update({ revoked_at: new Date().toISOString() })
      .eq('coach_id', coachId)
      .is('revoked_at', null)
    if (error) throw error
    console.log(`▶ Rotated: revoked ${active.length} prior link(s).`)
  }

  const token = randomBytes(32).toString('base64url')
  const { error: insErr } = await supabase.from('auth_passlink').insert({
    coach_id: coachId,
    token_hash: sha256hex(token),
  })
  if (insErr) throw insErr

  const link = `${baseUrl.replace(/\/+$/, '')}/api/auth/passlink?t=${token}`
  console.log('\n✅ Permanent login link issued (save this — shown once):\n')
  console.log(`  ${link}\n`)
  console.log(`  coach: ${email} (${coachId})`)
  console.log(`  Revoke anytime: npx tsx scripts/revoke-passlink.ts ${email}`)
}

main().catch(err => {
  console.error('✖ issue-passlink failed:', err)
  process.exit(1)
})
```

- [ ] **Step 4: Run the test + typecheck, verify Task 4 passes**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsx scripts/test-staff-passlink.ts`
Expected: PASS — Tasks 1–4 `✓`; exit 0.
Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Lint + commit**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx eslint --no-eslintrc --config .eslintrc.json scripts/issue-passlink.ts`
Expected: exit 0, no output.

```bash
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink add scripts/issue-passlink.ts scripts/test-staff-passlink.ts
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink commit -m "feat(passlink): issue-passlink.ts (provision coach, mint/rotate token, print URL)"
```

---

### Task 5: `scripts/revoke-passlink.ts`

**Files:**
- Create: `scripts/revoke-passlink.ts`
- Modify: `scripts/test-staff-passlink.ts` (insert Task 5 section)

- [ ] **Step 1: Insert the Task 5 test section**

In `scripts/test-staff-passlink.ts`, replace the line `// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<` with exactly:

```ts
section('Task 5: scripts/revoke-passlink.ts')
{
  const s = stripComments(read('scripts/revoke-passlink.ts'))
  assertEqual(/dotenvConfig\(\{ path: '\.env\.local' \}\)/.test(s), true, 'loads .env.local')
  assertEqual(/from '@\//.test(s), false, 'no @/ alias imports (tsx-safe)')
  assertEqual(/from\('coach'\)[\s\S]{0,120}\.eq\('email', email\)/.test(s), true, 'resolves coach by email')
  assertEqual(/from\('auth_passlink'\)[\s\S]{0,160}revoked_at/.test(s) && /\.is\('revoked_at', null\)/.test(s), true, 'sets revoked_at on active links')
}

// >>> NEXT TASK SECTION INSERTED ABOVE THIS LINE <<<
```

- [ ] **Step 2: Run the test, verify Task 5 fails**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsx scripts/test-staff-passlink.ts`
Expected: FAIL — Tasks 1–4 `✓`, Task 5 `✗ loads .env.local`; exit 1.

- [ ] **Step 3: Create `scripts/revoke-passlink.ts`**

Create the file with exactly this content:

```ts
/**
 * Revoke ALL active permanent login links for a coach (by email).
 * Sets revoked_at=now(); the /api/auth/passlink endpoint filters
 * revoked_at is null, so the link dies immediately on next use.
 *
 * Requires env (.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY.
 *
 * Run: npx tsx scripts/revoke-passlink.ts <email>
 *
 * SQL fallback:
 *   update auth_passlink set revoked_at=now()
 *   where coach_id=(select id from coach where email='<email>')
 *     and revoked_at is null;
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  const email = process.argv.slice(2).find(a => !a.startsWith('--'))
  if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx scripts/revoke-passlink.ts <email>')
    process.exit(1)
  }

  const { data: coach, error: cErr } = await supabase
    .from('coach')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (cErr) throw cErr
  if (!coach?.id) {
    console.error(`No coach row for ${email} — nothing to revoke.`)
    process.exit(1)
  }

  const { data: revoked, error: rErr } = await supabase
    .from('auth_passlink')
    .update({ revoked_at: new Date().toISOString() })
    .eq('coach_id', coach.id as string)
    .is('revoked_at', null)
    .select('id')
  if (rErr) throw rErr

  console.log(`✅ Revoked ${revoked?.length ?? 0} active link(s) for ${email}.`)
}

main().catch(err => {
  console.error('✖ revoke-passlink failed:', err)
  process.exit(1)
})
```

- [ ] **Step 4: Run the test + typecheck, verify Task 5 passes**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsx scripts/test-staff-passlink.ts`
Expected: PASS — Tasks 1–5 `✓`; exit 0.
Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Lint + commit**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx eslint --no-eslintrc --config .eslintrc.json scripts/revoke-passlink.ts`
Expected: exit 0, no output.

```bash
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink add scripts/revoke-passlink.ts scripts/test-staff-passlink.ts
git -C /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink commit -m "feat(passlink): revoke-passlink.ts"
```

---

### Task 6: Whole-feature verification + owner runbook

**Files:** none modified (verification only).

- [ ] **Step 1: Full structural test green**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsx scripts/test-staff-passlink.ts`
Expected: every section `✓`; final line `N passed, 0 failed`; exit 0.

- [ ] **Step 2: Typecheck (whole project)**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 3: Lint all changed/created source files**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npx eslint --no-eslintrc --config .eslintrc.json src/lib/auth/redirect-with-session.ts "src/app/api/lti/launch/route.ts" "src/app/api/auth/passlink/route.ts" scripts/issue-passlink.ts scripts/revoke-passlink.ts`
Expected: exit 0, no output.

- [ ] **Step 4: Production build**

Run: `cd /Users/andrewcurran/le3-growth-portfolio/.worktrees/staff-passlink && npm run build`
Expected: exit 0 (`.env.local` present per Pre-flight; build does not need the `auth_passlink` table to exist).

- [ ] **Step 5: Owner runbook — record results in the PR description**

These steps require applying the migration to the database and exercising real auth; they are **owner-performed** (auth-sensitive + prod DB side effect), not run by the implementer subagent:
1. **Apply the migration** via the repo's Supabase migration workflow (e.g. `supabase db push`, or the Supabase dashboard/MCP SQL editor running `supabase/migrations/017_auth_passlink.sql`). Reversible: `drop table auth_passlink;`.
2. With `LTI_TOOL_URL` set to the deployed origin: `npx tsx scripts/issue-passlink.ts <a-test-coach-email>` → copy the printed URL.
3. Open the URL in a **logged-out / incognito** browser → expect to land authenticated on `/v2/coach` as that coach.
4. `npx tsx scripts/revoke-passlink.ts <that-email>` → open the same URL again → expect `/login?error=invalid_link`.
5. `npx tsx scripts/issue-passlink.ts <that-email>` (no `--rotate`) → expect "an active link already exists — NOT minting"; the *prior* (pre-revoke) link stays dead, any still-active link still works.
6. `npx tsx scripts/issue-passlink.ts <that-email> --rotate` → new URL works; the previous URL → `/login?error=invalid_link`.

- [ ] **Step 6: Finish**

Use `superpowers:finishing-a-development-branch` — present the standard options to the owner (merge / PR / keep / discard). **No autonomous merge or push.** Surface that the migration must be applied to the database before the feature is live (Step 5.1).

---

## Self-Review

**1. Spec coverage** — every spec requirement maps to a task:
- `auth_passlink` table (hashed token, revocable, coach FK cascade, RLS no-policy) → Task 1.
- Pure extraction of `redirectWithSession` + reuse → Task 2 (3 call sites preserved; behavior byte-identical).
- `GET /api/auth/passlink` (sha256, non-revoked lookup, active-coach check, delegate to session helper, `/v2/coach`, active-role cookie, generic `invalid_link` on every failure, public via `/api/auth`) → Task 3 (incl. middleware-unchanged assertion).
- Issuance: provision auth user + active coach up front (avoids callback delete trap), idempotent reuse, `--rotate`, hashed token, URL from `LTI_TOOL_URL` → Task 4.
- Revocation script + SQL fallback → Task 5.
- Coach-only / instructors-are-coach-rows / students-excluded → enforced by design (scripts only ever touch `coach`; no student path anywhere).
- Middleware UNCHANGED → asserted in Task 3; no task edits `src/middleware.ts`.
- Testing/DoD (structural scan + gates + manual runbook) → Tasks 1–5 sections + Task 6.
- Session-longevity (config, not code) → intentionally NOT a task; it is an ops note in the spec, restated nowhere in code. Out of scope per spec — no gap.

**2. Placeholder scan** — no TBD/TODO; every code step is complete verbatim source; every command has exact expected output; the single insertion marker is an explicit mechanism, not a placeholder. The migration-apply step is deliberately owner-gated (stated), not "implement later".

**3. Type / name consistency** — `auth_passlink` columns (`coach_id, token_hash, revoked_at, last_used_at, created_at, id`) are identical across the migration, the endpoint queries, both scripts, and the test assertions. `redirectWithSession(admin, email, redirectPath, origin)` signature is identical in the extracted module and unchanged at the 3 launch-route call sites and the new endpoint call. `ACTIVE_ROLE_COOKIE` imported from `@/lib/v2-auth` in both the launch route (existing) and the endpoint. `sha256hex`/`createHash('sha256')` consistent (endpoint inlines `createHash`; issue script wraps it as `sha256hex`). Token = `randomBytes(32).toString('base64url')` in the issuer; verified by `createHash('sha256')` of `?t=` in the endpoint. `/login?error=invalid_link` is the single literal for all endpoint failures. No dangling references.

No issues found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-19-staff-passlink-auth.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh implementer subagent per task, two-stage review (spec-compliance then code-quality) between tasks, in the `.worktrees/staff-passlink` worktree off `main`.

**2. Inline Execution** — execute the 6 tasks in this session with batched checkpoints (executing-plans).

Which approach?
