# Staff Passlink Auth — Design Spec

**Date:** 2026-05-19
**Status:** Approved (design); pending implementation plan
**Owner:** Andrew Curran
**Scope:** Non-LTI staff login bridge. Independent of the Resend/SMTP track and of the open `/v2/demo` middleware bug.

## Problem / Goal

Non-LTI direct logins (coaches/instructors hitting `/login`) are broken: Supabase's built-in email service is project-rate-limited (`over_email_send_rate_limit` / `429`), and no controllable sending domain exists to configure custom SMTP (a `*.vercel.app` host can't be DKIM-verified; no owned domain; NLU IT is slow). Students and LTI-launched instructors are **unaffected** (LTI never sends email). This affects only the ~dozen non-LTI staff.

**Goal:** a permanent, per-coach bookmarkable URL that logs that coach in with **no email, no controllable domain, and no per-use admin action** — issued once per person, reusable forever, revocable. A bridge while the email/domain track is resolved.

## Recon facts this design rests on (verified, read-only)

- **"Instructor" is not an auth identity in v2.** The `instructor` table (`migration 014`) is Valence-sync metadata only — columns `id,name,email,d2l_user_id,org_defined_id,status,created_at,updated_at`, **no `auth_user_id`**, no identity RLS, never read by `getV2Identity`. Every non-student human who logs in is a `coach` row.
- `getV2Identity` (`src/lib/v2-auth.ts:51-155`) resolves only `coach` and `student` by `auth_user_id`; `V2Identity` has only `role:'coach'|'student'`. `ACTIVE_ROLE_COOKIE = 'le3-v2-active-role'` (coach-first default).
- LTI instructor launch (`src/app/api/lti/launch/route.ts:251-321`) already provisions instructors as a **`coach`** row: `admin.auth.admin.createUser({email,email_confirm:true})` → insert `coach{auth_user_id,name,email,status:'active'}` → `redirectWithSession(...)` → `/v2/coach`, setting `le3-v2-active-role=coach`. This is the exact target mechanism.
- Vetted no-email session mechanism: `redirectWithSession(admin,email,redirectPath,origin)` (`src/app/api/lti/launch/route.ts:545-572`, currently file-private): `admin.auth.admin.generateLink({type:'magiclink',email})` → `data.properties.hashed_token` → redirect `/api/auth/callback?token_hash=…&type=magiclink&next=…`.
- `/api/auth/callback/route.ts`: token-hash path calls `supabase.auth.verifyOtp({token_hash,type})` and sets session cookies via the `createServerClient` cookie adapter (`:66-81`); record-linking claims an unlinked `coach` by email (`:163-182`); the **rejection path (`:230-245`) signs out and `admin.auth.admin.deleteUser(user.id)`** then `/login?error=not_enrolled` when the email has no `coach`/`student` row and isn't in `ADMIN_EMAILS`.
- `coach` columns: `id, auth_user_id (uuid null, unique → auth.users), name, email, status, created_at, is_demo, demo_slug`. "Active" = `status='active'`. `createAdminClient()` is a memoized service-role singleton (`src/lib/supabase-admin.ts`).
- `src/middleware.ts` public allowlist includes `pathname.startsWith('/api/auth')` → an endpoint under `/api/auth/...` is **already public**; middleware needs no change.
- The deployed base URL is available to server code via the LTI tool config (`getToolConfig().toolUrl` in `src/lib/lti/config.ts`); a CLI script (no request origin) resolves the URL from that same source.

## Settled decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Subject model | **Coach-only.** Instructors are coach rows (provisioned exactly as LTI instructor launch does) and land `/v2/coach`. Students are **never** issued links (LTI-only). No `subject_type`, no instructor identity path. |
| Session mechanism | **Reuse the vetted path** — delegate to the existing `/api/auth/callback` via `redirectWithSession` (`generateLink` magic-link `token_hash`). No bespoke cookie/session code. |
| Endpoint location | **`GET /api/auth/passlink`** — inside middleware's existing `/api/auth` public prefix; **middleware UNCHANGED**; structurally avoids the chicken-and-egg class. |
| Token at rest | **Hashed (SHA-256).** Plaintext token is never stored and is unrecoverable after issuance. |
| Re-issue behavior | **Idempotent no-op + report.** Re-running `issue` for a coach with an active (non-revoked) link does **not** mint/rotate — it reports status; the existing bookmark keeps working forever. `--rotate` revokes the old link and prints a new URL. (A lost URL therefore requires `--rotate`; the plaintext-storage alternative was rejected as weaker.) |
| Provisioning | Issuance provisions the auth user + **active `coach` row up front** (mirroring LTI instructor launch) so the callback links rather than deleting the user. |
| Revocation | `revoked_at` timestamp; a `revoke` script + a documented SQL one-liner. |
| Session longevity | Lengthen Supabase refresh-token validity — **config only, documented as an ops step, not built.** |

## Architecture

One additive migration + one new endpoint + two CLI scripts + one pure refactor (extract a shared helper). No middleware change, no schema change to existing tables, no new trust surface beyond the explicitly-accepted bearer-URL tradeoff. The passlink endpoint validates a token then **delegates entirely to the existing, vetted `redirectWithSession → /api/auth/callback (verifyOtp + coach link + cookies)`** flow, so the Supabase session, identity (`getV2Identity`), and RLS model are reused unchanged.

## Components / exact change set

**Create — migration `auth_passlink` table:**
```
id          uuid primary key default gen_random_uuid()
coach_id    uuid not null references coach(id) on delete cascade
token_hash  text not null unique         -- SHA-256 hex of the URL token
created_at  timestamptz not null default now()
last_used_at timestamptz
revoked_at  timestamptz
```
Enable RLS, no policy (service-role-only access — consistent with repo convention; anon/authenticated get deny-all).

**Refactor — extract shared session helper (no behavior change):**
- Create `src/lib/auth/redirect-with-session.ts` exporting `redirectWithSession(admin, email, redirectPath, origin): Promise<NextResponse>` — the verbatim body currently at `src/app/api/lti/launch/route.ts:545-572`.
- `src/app/api/lti/launch/route.ts`: delete the local definition, `import { redirectWithSession } from '@/lib/auth/redirect-with-session'`. Behavior byte-identical.

**Create — `GET /api/auth/passlink`** (`src/app/api/auth/passlink/route.ts`, `dynamic='force-dynamic'`, `runtime='nodejs'`):
1. Read `t` query param; missing → redirect `/login?error=invalid_link`.
2. `tokenHash = sha256hex(t)` (node `crypto`).
3. Admin lookup `auth_passlink` where `token_hash = tokenHash` and `revoked_at is null`, `maybeSingle()`. Not found → `/login?error=invalid_link`.
4. Load `coach` by `coach_id`; require `status='active'`. Missing/inactive → `/login?error=invalid_link`.
5. Best-effort `update auth_passlink set last_used_at = now()` (do not block on failure).
6. `const res = await redirectWithSession(admin, coach.email, '/v2/coach', req.nextUrl.origin)`; set `res.cookies.set({ name: 'le3-v2-active-role', value: 'coach', ... })` (mirroring the LTI instructor branch — relevant only for dual-role accounts; harmless otherwise); `return res`.
- All failure branches use the **same generic** `/login?error=invalid_link` (no unknown-vs-revoked distinction → no enumeration).

**Create — `scripts/issue-passlink.ts`** (`npx tsx scripts/issue-passlink.ts <email> [--name "Full Name"] [--rotate]`):
1. Resolve base URL from `getToolConfig().toolUrl`; require it.
2. Ensure auth user + active coach:
   - `coach` by email exists & `auth_user_id` set → use it.
   - `coach` by email exists & `auth_user_id` null → `admin.auth.admin.createUser({email,email_confirm:true})`, set `coach.auth_user_id`.
   - no `coach` → `admin.auth.admin.createUser({email,email_confirm:true})` then insert `coach{auth_user_id,name:(--name || derived from email),email,status:'active'}`.
3. If an active (`revoked_at is null`) `auth_passlink` exists for this coach and **not** `--rotate`: print a status report (`created_at`, `last_used_at`) and exit **without** minting/rotating.
4. Otherwise: if `--rotate`, set `revoked_at=now()` on the coach's active links. Generate a 32-byte URL-safe random token; insert `auth_passlink{coach_id, token_hash:sha256hex(token)}`; print `"<baseUrl>/api/auth/passlink?t=<token>"` exactly once (it is unrecoverable afterward — save it).

**Create — `scripts/revoke-passlink.ts`** (`npx tsx scripts/revoke-passlink.ts <email>`): set `revoked_at=now()` on all active links for that coach; print count. Documented SQL fallback: `update auth_passlink set revoked_at=now() where coach_id=(select id from coach where email='…') and revoked_at is null;`.

**Explicitly UNCHANGED:** `src/middleware.ts`; `/api/auth/callback`; `getV2Identity`; `student`/`instructor` tables; LTI launch behavior (only the helper's location moves); demo-as; the `/v2/demo` middleware bug (separate).

## Data flow

```
bookmarked GET /api/auth/passlink?t=TOKEN   (public via /api/auth prefix)
  → sha256(TOKEN) → auth_passlink (revoked_at null) → coach (status active)
  → last_used_at = now()
  → redirectWithSession(admin, coach.email, '/v2/coach', origin)
      → /api/auth/callback?token_hash=…&type=magiclink&next=/v2/coach
      → verifyOtp + coach link-by-email + session cookies
  → /v2/coach   (le3-v2-active-role=coach)
invalid / revoked / inactive / missing token → /login?error=invalid_link
```

## Error handling / security (proportionate)

Token hashed at rest; revocable (`revoked_at`); coach `status='active'` enforced; single generic error for every token failure (no enumeration); reuses the existing `verifyOtp`/callback/RLS path → **no new session or trust surface**. Accepted residual (stated once): a leaked URL grants standing access to that coach's caseload (their students' FERPA-relevant reflection data) until revoked — mitigated by `revoke` + `last_used_at` visibility. Issuance provisions the coach row up front so the callback's auth-user-delete rejection path is never hit. Students are never issued links.

## Testing / definition of done

- **Structural source-scan** `scripts/test-staff-passlink.ts` (repo convention: `npx tsx`, imports `{assertEqual,section,finish}` from `./_sync-test-harness`, no `bootstrapTestEnv`, local `read()/stripComments()`, single `finish()`): asserts the migration defines `auth_passlink` with `token_hash` + `revoked_at` + `coach_id` FK; `src/lib/auth/redirect-with-session.ts` exports `redirectWithSession` and `lti/launch/route.ts` imports it (no local redefinition); `src/app/api/auth/passlink/route.ts` SHA-256-hashes `t`, queries `auth_passlink` with `revoked_at` null, checks coach `status`, calls `redirectWithSession`, and every failure path is `/login?error=invalid_link`; `issue-passlink.ts` references `createUser`, `sha256`, idempotent reuse + `--rotate`; `revoke-passlink.ts` sets `revoked_at`; `src/middleware.ts` still gates via the `/api/auth` public prefix (no per-route addition needed).
- Gates: `npx tsc --noEmit` 0 · `npx eslint --no-eslintrc --config .eslintrc.json <files>` no warnings · `npm run build` 0.
- **Manual DoD runbook:** issue a link for a test email → open it logged-out/incognito → lands `/v2/coach` as that coach; revoke → same link → `/login?error=invalid_link`; re-run `issue` (no `--rotate`) → reports existing, does not rotate, old link still works; `issue --rotate` → new URL works, old URL → `invalid_link`.

## Rollout & sequencing

Code + one additive migration (reversible: `drop table auth_passlink`). Own PR, subagent-driven in a NEW worktree `.worktrees/staff-passlink` off current `main`; do not touch other worktrees; copy `.env.local` in for a faithful build. **Independent** of: the Resend/SMTP track (this is the no-email bridge), the `/v2/demo` middleware bug (decoupled — passlink is public via `/api/auth`; that bug is fixed separately), and the immediate one-off admin-link unblock (unaffected). Post-merge ops step (not code, not gated): lengthen Supabase refresh-token validity so coaches rarely re-auth.

## Out of scope / non-goals

- Instructor-distinct identity or surface (v2 has none; instructors are coach rows).
- Any student passlink (students are LTI-only).
- Email/SMTP/Resend/domain work (separate, deferred track).
- A web UI for issuing/revoking links (scripts only — the "spreadsheet" is: run the script, paste the URL into your roster).
- Endpoint rate-limiting (hashing + `revoked_at` + coach `status` is the control; revisit only if abused).
- The session-longevity change is documented as an ops step, not built or tested here.
