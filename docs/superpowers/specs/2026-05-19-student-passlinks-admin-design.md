# Student/Pilot Passlinks + Admin Surface — Design Spec

**Date:** 2026-05-19
**Status:** Approved (design); pending implementation plan
**Owner:** Andrew Curran
**Scope:** Extends the merged staff-passlink bridge (main `f6c5d83`). One cohesive sub-project. Independent of the other open threads (`/v2/demo` middleware bug; Resend/SMTP).

## Problem / Goal

NLU IT cannot embed the LTI launch in D2L before the pilot must start. The merged passlink bridge is **coach-only by design** ("students are LTI-only and must never be issued links"), so there is no way to get the 56 pilot students (and instructors) into the product without LTI. **Goal:** an admin can issue and distribute permanent login links for the entire pilot population — 56 active students, 2 coaches, 23 instructors — from the Tools page, as a one-time downloadable CSV, **preserving the merged security model** (tokens hashed at rest; no standing credential trove).

## Recon facts this design rests on (verified, read-only, this session)

- **Pilot population (DB, prod):** 56 active non-demo students (1 cohort); 2 non-demo coaches; 23 instructor rows, all with valid distinct emails, **0 already coaches, 0 colliding with student emails**. Total subjects = **81**.
- **Auth path needs no change.** `src/lib/auth/redirect-with-session.ts` `redirectWithSession(admin,email,redirectPath,origin)` is role-agnostic. `src/app/api/auth/callback/route.ts` links a student symmetrically to a coach: branch "already linked as student" (`auth_user_id` match → redirect `nextPath||'/v2'`) and branch "unlinked student matching email" (sets `auth_user_id`, redirect `nextPath||'/v2'`); `nextPath = next && next.startsWith('/') ? next : null` (L62). So a student passlink = `redirectWithSession(admin, student.email, '/v2/today', origin)`. Caveat (non-issue for single-role subjects): callback checks coach branches before student branches, so a dual-role email lands coach.
- Student post-login landing: `LTI_STUDENT_PATH = process.env.LTI_POST_LAUNCH_STUDENT_PATH || '/v2/today'` (module-scoped, **not exported**, in `lti/launch/route.ts:17`).
- **Schema blocker:** `auth_passlink` (migration 017) has only `coach_id uuid not null references coach(id) on delete cascade` — no student linkage. The `not null` is the hard blocker; needs a generalizing migration.
- `src/app/api/auth/passlink/route.ts` is coach-bound: selects `coach_id`, loads `coach` by it, checks `coach.status !== 'active'`, lands `/v2/coach`, sets `ACTIVE_ROLE_COOKIE='coach'`. Generic `/login?error=invalid_link` on every failure (no enumeration). Public via middleware's existing `/api/auth` prefix.
- Tools page: `src/app/v2/(coach)/coach/tools/page.tsx` (server; gate `const identity = await getV2Identity(); if (!identity) redirect('/login'); const allowed = identity.role === 'coach' && isAdminEmail(identity.email)`; server-prefetches via `Promise.all`, passes props) + `ToolsView.tsx` (client; `useState<Tab>` switcher `'sync'|'lti'|'activity'`, `TabBtn` helper, panels per tab).
- Existing `/api/admin/*` routes (e.g. `recover-extractions`) are middleware-session-gated (`/api/admin` is NOT in the public allowlist) **and** re-check `isAdminEmail` in-handler — the pattern admin passlink routes follow. `/api/auth/passlink` stays public (middleware unchanged).
- **No CSV/download precedent** anywhere in the repo and no CSV lib in `package.json` — hand-rolled `text/csv` + `Content-Disposition` in a route handler.
- `getV2StudentId()`/`getV2CoachId()`/`isAdminEmail()` exported from `@/lib/v2-auth`; a student-only account resolves `role:'student'` automatically once `auth_user_id` is set (cookie not required).
- `instructor` table is Valence-sync metadata with no `auth_user_id` and is never an auth identity — instructors who log in are provisioned as `coach` rows (what LTI instructor launch and `issue-passlink.ts` already do).

## Settled decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Storage / distribution | **Export-once CSV.** Tokens stay SHA-256-hashed at rest (no regression). Bulk-issue mints + returns a one-time CSV; the screen afterward shows status only + per-row rotate (re-exports that row). The admin page is never a standing credential trove. |
| Subject scope | **Everyone:** 56 active non-demo students + 2 non-demo coaches + 23 instructors. Instructors are provisioned as **coach rows** (no distinct instructor identity/view — consistent with v2). |
| Schema | **Generalize `auth_passlink`** (add nullable `student_id`, relax `coach_id` nullable, CHECK exactly-one) — not a parallel table. One table, one endpoint; existing coach scripts/endpoint path unchanged (DRY). |
| Auth path | **Reuse unchanged.** `redirectWithSession` + callback already link students symmetrically; pass `(student.email,'/v2/today')`. |
| FERPA / security | Security-clean model chosen (no plaintext at rest, revocable, ADMIN_EMAILS-gated, bulk revoke-all teardown). Accepted, time-boxed pilot tradeoff. |

## Architecture

Pure extension of the merged passlink infra: one additive owner-applied migration generalizing the subject; a generalized public lookup endpoint; a shared server issuance lib; ADMIN_EMAILS-gated admin routes (issue→CSV / list / rotate / revoke-all); a new "Passlinks" tab in the existing Tools surface. No middleware change; no change to `redirectWithSession`, the callback, or the merged coach scripts.

## Components / exact change set

**Create — migration `supabase/migrations/018_auth_passlink_student.sql`** (owner-applied, after 017; additive, reversible):
- `alter table auth_passlink add column student_id uuid references student(id) on delete cascade;`
- `alter table auth_passlink alter column coach_id drop not null;`
- `alter table auth_passlink add constraint auth_passlink_one_subject check ((coach_id is not null) <> (student_id is not null));`
- `create index auth_passlink_student_active_idx on auth_passlink (student_id) where revoked_at is null;`
- `comment on` documenting the polymorphic subject + that exactly one of coach_id/student_id is set. Existing coach rows/indexes/path unaffected.

**Modify — `src/app/api/auth/passlink/route.ts`** (generalize; failure behavior unchanged):
- Select `id, coach_id, student_id, revoked_at`.
- `coach_id` set → existing coach path verbatim (load `coach`, `status==='active'`, `redirectWithSession(admin, coach.email, '/v2/coach', origin)`, `ACTIVE_ROLE_COOKIE='coach'`).
- `student_id` set → load `student` (`id,email,status`); require `status==='active'`; `redirectWithSession(admin, student.email, STUDENT_LANDING, origin)`; `ACTIVE_ROLE_COOKIE='student'`. `const STUDENT_LANDING = process.env.LTI_POST_LAUNCH_STUDENT_PATH || '/v2/today'` (mirrors the unexported launch constant).
- Every failure → the same `invalid(origin)` → `/login?error=invalid_link` (unchanged; no enumeration). Public via unchanged `/api/auth` middleware prefix.

**Create — `src/lib/auth/passlink-issue.ts`** (shared server lib; service-role admin client):
- `ensureSubjectAndMint(input): Promise<{ url: string | null; status: 'minted'|'already-active'|'error'; ... }>`. For `kind:'coach'` (incl. instructors): ensure auth user (`admin.auth.admin.createUser({email,email_confirm:true})` if absent) + active `coach` row (insert if absent; mirrors `issue-passlink.ts`); insert `auth_passlink{coach_id, token_hash:sha256(token)}`. For `kind:'student'`: require an existing active non-demo `student` row by email; ensure auth user; set `student.auth_user_id` if null; insert `auth_passlink{student_id, token_hash}`. Idempotent: if a non-revoked link exists for the subject and not `rotate` → `status:'already-active'`, `url:null` (hashed → not re-exportable). `rotate` → revoke active then mint.

**Create — admin API routes** (each: `dynamic='force-dynamic'`, `runtime='nodejs'`; server guard replicating the Tools gate — `getV2Identity()` → `identity.role==='coach' && isAdminEmail(identity.email)`, else 401/403; these sit under `/api/admin` which middleware already session-gates):
- `POST /api/admin/passlinks/issue` — gather subjects (active non-demo students=student; non-demo coaches=coach; 23 instructor emails dedup’d lowercased against coaches/students=coach), call `ensureSubjectAndMint` per subject (idempotent unless `?rotateAll=1`), return `text/csv` (`name,email,role,status,url`; RFC4180-escaped, hand-rolled) with `Content-Disposition: attachment; filename="pilot-passlinks-<date>.csv"`.
- `GET /api/admin/passlinks` — roster + status (counts, `last_used_at`, revoked) — **no URLs**.
- `POST /api/admin/passlinks/rotate` — one subject (by passlink id) → revoke + mint, return `{ url }` once.
- `POST /api/admin/passlinks/revoke-all` — set `revoked_at=now()` on all non-revoked rows (pilot teardown); UI confirm-gated.

**Modify — Tools surface:** `src/app/v2/(coach)/coach/tools/ToolsView.tsx` add `'passlinks'` to the `Tab` union + a `<TabBtn label="Passlinks">` + `{tab==='passlinks' && <PasslinksPanel roster={passlinkRoster} />}`. Create `src/components/coach/PasslinksPanel.tsx` (client): status table (name/email/role/status/last-used) + "Issue links for everyone (download CSV)" (POST issue → browser download) + per-row Rotate + "Revoke ALL pilot links" (confirm). `page.tsx`: add `getPasslinkRoster()` to the existing `Promise.all`, pass as a new `ToolsView` prop (mirrors `recentSyncRuns`).

**Explicitly UNCHANGED:** `src/middleware.ts`; `src/lib/auth/redirect-with-session.ts`; `/api/auth/callback`; `scripts/issue-passlink.ts` / `scripts/revoke-passlink.ts` (coach CLI stays, byte-identical); `getV2Identity`; the coach `coach_id` lookup path in the endpoint.

## Data flow

```
Admin (logged-in, ADMIN_EMAILS) → /v2/coach/tools → Passlinks tab
  → "Issue links for everyone" → POST /api/admin/passlinks/issue
      → gather 56 students + 2 coaches + 23 instructors(→provision coach)
      → ensureSubjectAndMint each (idempotent; hashed token stored)
      → one-time CSV download (name,email,role,status,url)
  → admin distributes CSV
  → screen now shows status only; per-row Rotate re-exports that row;
    Revoke ALL = pilot teardown
Subject clicks URL → GET /api/auth/passlink?t= (public)
  → coach_id → /v2/coach (role coach) | student_id → /v2/today (role student)
  → invalid/revoked/inactive → /login?error=invalid_link
```

## Error handling / security (FERPA)

Hashed-at-rest preserved (no plaintext, no standing trove). All admin routes session-gated (middleware) **and** `isAdminEmail`-gated in-handler; the public lookup endpoint keeps the single generic `/login?error=invalid_link` (no enumeration). Instructor→coach provisioning reuses the vetted LTI/issue pattern (no new trust surface). Residuals (accepted, stated once): the downloaded CSV is sensitive — admin must distribute/store it carefully; each link is standing access to that subject's records until revoked; `Revoke ALL` provides a clean time-boxed-pilot teardown. Idempotency + email dedup prevent duplicate/instructor double-provisioning on re-runs.

## Testing / definition of done

- **Structural source-scan** `scripts/test-student-passlinks.ts` (repo convention: `npx tsx`, `{assertEqual,section,finish}` from `./_sync-test-harness`, no bootstrap, local `read()/stripComments()`, single `finish()`): 018 adds `student_id` + drops `coach_id not null` + the exactly-one CHECK + student partial index; endpoint resolves coach vs student with correct landings (`/v2/coach` vs `/v2/today`) + active gate + generic `invalid_link` on every failure; admin routes guard `isAdminEmail` + issue returns `text/csv`+`Content-Disposition`; `ensureSubjectAndMint` provisions instructor-as-coach + dedups by lowercased email + sha256 + idempotent/rotate; ToolsView has the Passlinks tab; `scripts/issue-passlink.ts`/`revoke-passlink.ts` and `redirect-with-session.ts` unchanged (regression); `src/middleware.ts` unchanged.
- Gates: `npx tsc --noEmit` 0 · `npx eslint --no-eslintrc --config .eslintrc.json <files>` no warnings · `npm run build` 0.
- **Manual DoD (owner):** apply 018 → Tools→Passlinks → "Issue links for everyone" → CSV (81 rows) downloads → a student URL signs in as that student to `/v2/today`; a coach/instructor URL to `/v2/coach`; per-row Rotate yields a new working URL, old dead; "Revoke ALL" kills every link (→ `invalid_link`).

## Rollout & sequencing

Code + one additive owner-applied migration (`018`, after `017`; reversible — drop column/constraint/index, restore `coach_id not null`). Own PR, subagent-driven in a NEW worktree off `main`; existing/parked worktrees untouched. No cross-spec ordering constraint. Not live until the owner applies 018 and runs "Issue links for everyone".

## Out of scope / non-goals

- A distinct instructor identity or view (instructors are coach rows — consistent with v2).
- A permanent student-link strategy beyond the pilot (this is the LTI-embedding bridge; LTI remains the real path).
- Plaintext/reversible token storage (rejected — export-once chosen).
- Email/SMTP/Resend, push notifications, the `/v2/demo` middleware fix (separate threads).
- Changing `redirectWithSession`, the callback, the coach CLI, or middleware.
