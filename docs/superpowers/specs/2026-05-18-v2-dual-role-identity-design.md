# v2 Dual-Role Identity (Coach/Instructor ↔ Student) — Design Spec

**Date:** 2026-05-18
**Status:** Approved (design); pending implementation plan
**Owner:** Andrew Curran

## Problem / Goal

`getV2Identity()` (`src/lib/v2-auth.ts`) resolves a real-auth user as
**coach before student**, keyed by `auth_user_id`, with an explicit
"coaches who are also students would still want the coach shell as
their primary view" comment. Consequence (surfaced this session while
enabling the v2 conversation loop): a real coach/instructor account can
**never** resolve as a student, so such a human cannot enter the v2
student conversation/reflection experience at all. The only workaround
was provisioning a separate `+alias` magic-link student — a hack, not a
production answer.

**Goal:** support **genuine dual-role humans** — one person who is
*both* a coach/instructor **and** an enrolled learner with their own
real student data — letting them move between the coach and student
experiences as themselves, **without altering the D2L LTI integration
contract and without regressing any single-role behavior.**

## Recon facts this design rests on (verified, read-only, this session)

- **Coach-first precedence is in `getV2Identity()`** (`src/lib/v2-auth.ts`,
  the real-auth branch ~lines 97–134): query `coach` by `auth_user_id`
  first; only if absent, query `student`. No toggle, no dual-role path.
- **The DB already represents dual-role.** `student` and `coach` each
  carry a `UNIQUE (auth_user_id)` constraint, so a single `auth_user_id`
  can own at most one `coach` row **and** one `student` row — both keyed
  to the same login. The representation exists; only resolution + a
  switch + UI are missing. **No schema change is required.**
- **The only existing role switch is demo-only.** `/api/v2/demo-as`
  sets `PERSONA_COOKIE` (`le3-v2-demo-persona`) to a `demo_slug`,
  validated against `is_demo = true` rows. There is no real-auth
  equivalent.
- **LTI is per-launch and unaffected by web coach-first precedence.**
  `api/lti/launch` already decides instructor vs. student from the LTI
  roles claim (`isInstructor`/`isStudent`), provisions accordingly,
  mints a Supabase session, sets the `lti_context` cookie, and redirects
  (instructor → `/v2/coach`, student → `/v2/today` via the Task 5 env
  gate). The coach-first gap is a **post-login web-session** problem,
  not an LTI-handshake one.

## Settled decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Driving need | **Genuine dual-role humans** (coach/instructor *and* a real enrolled learner), used for real over time — not merely staff previewing the student UI. |
| LTI vs. toggle | **LTI launch sets the role on arrival** (the launch's LTI roles claim wins so D2L expectations hold), **switchable mid-session** via the in-app toggle (same cookie). |
| Persistence | **Cookie-only session role** (`le3-v2-active-role`, httpOnly). No schema change, no migration. Persists in that browser until cleared (not cross-device — acceptable, since LTI sets it per-launch anyway). |
| No-cookie default | **Coach-first preserved.** Absent/invalid cookie → exactly today's behavior. Pure coaches/pure students/demo personas are byte-unchanged. |
| Mechanism | **Approach A** — resolve inside `getV2Identity()`, the single identity choke point every v2 surface and the 3 write routes already funnel through. (Rejected: per-layout role logic — drifts into security bugs; extending the demo-persona cookie — conflates demo and real identity in the most security-sensitive resolver.) |
| Scope | **Standalone effort, its own branch.** Explicitly **not** scope-crept onto the in-flight PR #6 (v2-enablement). |

## Architecture

A new concept — an **active role** — applies *only* to dual-role
humans (one `auth_user_id` owning both a `coach` and a `student` row).
It is carried in a dedicated cookie `le3-v2-active-role` (httpOnly,
secure, sameSite=lax; value strictly `coach` | `student`).
`getV2Identity()` remains the one resolver and is taught to honor it.

**The cookie selects among roles the human provably owns; it never
grants a role.** `getV2Identity()` re-derives both row lookups from the
DB every request, so the cookie is only a *selector*, never an
authority.

### Resolution precedence (`getV2Identity()`, real-auth branch)

1. demo-persona cookie → `resolvePersonaFromDb` — **unchanged**
2. `supabase.auth.getUser()`; then look up **both** `coach` and
   `student` by `auth_user_id`
3. **both exist (dual-role):** read `le3-v2-active-role` — value
   `student` (and a student row exists) → resolve **student**; value
   `coach`, unset, or invalid → resolve **coach** (coach-first default
   preserved)
4. **exactly one exists:** that role — **byte-unchanged from today**
5. **neither:** `null` — **unchanged**

Total and explicit ordering: demo-persona > dual-role active-role
cookie > coach-first default > single role > null. No ambiguous state.

## Components / change set

**Modify — `src/lib/v2-auth.ts`:**
- The precedence above + a small reader for `le3-v2-active-role`.
- Add `dualRole: boolean` to **both** `V2Identity` variants — true iff
  the resolved `auth_user_id` owns both a `coach` and a `student` row.
  The dual-role detection already performs both lookups, so the flag is
  free. Demo-persona path: `dualRole: false` (demo personas are
  single-role; out of scope to change).
- `getV2StudentId()` / `getV2CoachId()` need no change — they call
  `getV2Identity()` and check `role`, so they become correct
  automatically.
- Export the active-role cookie name (mirroring the exported
  `PERSONA_COOKIE`) so the switch route and LTI launch share one
  constant.

**Create — `POST /api/v2/switch-role`** (real-auth analog of `demo-as`):
- Resolve the *real* Supabase auth user. Param/body `role=coach|student`
  (plus a `clear` path that unsets the cookie).
- Server-validate the user **actually owns** the requested role's row
  for that `auth_user_id`. Owned → set `le3-v2-active-role` + redirect
  to that role's Today (`/v2/today` student | `/v2/coach` coach).
  **Not owned → `403`, cookie unchanged.** Never trust the client.

**Modify — `src/app/api/lti/launch/route.ts`:**
- In the **same post-handshake block** that already sets the
  `lti_context` cookie (after `verifyPlatformJwt` + session mint +
  provisioning; the Task 5 redirect lives here too), additionally set
  `le3-v2-active-role` from the already-read LTI roles claim
  (instructor → `coach`, student → `student`). This realizes "LTI sets
  the role on arrival"; the toggle can flip it mid-session via the same
  cookie. **No D2L-facing change** (see Integration-safety).

**Modify — the v2 shell (shared `(student)`/`(coach)` chrome):**
- A "Switch to Student / Switch to Coach" control rendered **only when
  `identity.dualRole` is true**; it POSTs `/api/v2/switch-role`. Exact
  shell component pinned during the implementation-plan phase.

**Add — structural + behavioral tests** (see Testing).

## Data flow

```
Plain web / magic-link login (dual-role human):
  → no le3-v2-active-role cookie → getV2Identity resolves COACH
    (coach-first default; identical to today)
  → "Switch to Student" → POST /api/v2/switch-role?role=student
  → server verifies a student row exists for this auth_user_id
  → sets le3-v2-active-role=student → redirect /v2/today
  → every v2 surface + the 3 write routes (via getV2StudentId)
    now resolve STUDENT. Switch back is symmetric.

LTI launch (dual-role human):
  → D2L handshake (verifyPlatformJwt, nonce/state)  [UNCHANGED]
  → provision/link + session mint                    [UNCHANGED]
  → post-handshake: set lti_context cookie           [UNCHANGED]
                  + set le3-v2-active-role from LTI role   [NEW]
                  + redirect (Task 5 env-gated path)  [UNCHANGED]
  → arrives in the LTI-dictated role; switchable mid-session.

Pure coach / pure student / demo persona:
  → exactly-one-row (or demo) path; active-role cookie not consulted
  → IDENTICAL to today (byte-unchanged).
```

## Integration-safety guarantee (load-bearing — the owner's hard constraint)

The LTI change is **one additional `Set-Cookie`** placed in the
existing post-handshake block, beside the unchanged `lti_context`
`Set-Cookie` and the Task 5 redirect — executed only **after**
`verifyPlatformJwt`, nonce/state validation, provisioning/linking, and
session mint. D2L's involvement is complete before this line runs; D2L
never observes the `le3-v2-active-role` cookie. **No `/api/lti/*`
handshake, OIDC/JWKS, `redirect_uri`, deployment/client ID,
provisioning, or role-claim *parsing* changes** — the LTI roles claim
is *already read today* (`isInstructor`/`isStudent`); this only reuses
that decision to choose a cookie value. Reversibility: if
`le3-v2-active-role` is absent for any reason, `getV2Identity()` falls
back to coach-first — exactly today's behavior — so the change is inert
by construction when the cookie is not present.

## Error handling / security

- `switch-role` to a role the authenticated user does not own → `403`,
  no cookie mutation. No silent fallback.
- `getV2Identity()` re-derives **both** the coach and student row
  lookups from the DB on every request. The cookie is purely a selector
  among provably-owned roles. A forged / tampered / garbage cookie
  (e.g., `coach` set by a student-only user, or `xyz`) is ignored →
  resolution falls back to the user's actual single role (or coach-first
  if genuinely dual). **No privilege-escalation path exists:** a
  single-role user setting any cookie value still has no second row.
- Cookie attributes: httpOnly, secure, sameSite=lax (same-site web
  navigation; distinct from `lti_context`'s cross-site needs). Exact
  attributes pinned in the plan against the existing cookie helpers.
- Precedence is total and explicit (no undefined ordering between
  demo-persona, dual-role cookie, coach-first default, single role).

## Testing / definition of done

- **Structural source-scan** (repo convention — standalone `tsx`
  script): `getV2Identity()` consults `le3-v2-active-role` *and*
  re-validates row ownership; `switch-role` `403`s on an unowned role;
  the LTI launch sets the active-role cookie in the post-handshake
  block while `verifyPlatformJwt` / session-mint / `lti_context` remain
  present and unaltered; precedence ordering present.
- **Behavioral (the real proof):** give the real
  `andrewmcurran@gmail.com` (which has a `coach` row) an additional
  **`student`** row on the *same* `auth_user_id`. Normal login still
  resolves **coach** (unchanged). Use the new switcher → reach the v2
  **student conversation experience as yourself**, drive a conversation,
  → switch back to coach. This finally provides the real answer and
  retires the `+alias` `seed-test-student` workaround for the owner's
  own testing (not required by this work — noted).
- **No regression (superset behavior):** pure coach, pure student,
  demo persona, **LTI instructor launch**, **LTI student launch** all
  behave exactly as before.
- Typecheck (`npx tsc --noEmit`) exit 0; lint clean
  (`npx eslint --no-eslintrc --config .eslintrc.json <files>`);
  `npm run build` exit 0 (catches CSR-bailout/RSC-boundary errors the
  other gates cannot).

## Rollout & sequencing

Code-only (no migration, no Trigger.dev). `git push` → Vercel. The
behavior is inert unless a human owns both rows *and* the cookie is set,
so deploy risk is low and per-environment reversible (clear the cookie /
revert the resolver = today's behavior).

**Open sequencing decision (raise at spec review):** this work touches
`src/app/api/lti/launch/route.ts` and `src/lib/v2-auth.ts`, which the
unmerged **PR #6** (v2-enablement) also modifies (Task 5 LTI redirect;
the resolver swap on the 3 write routes consumes `getV2Identity`).
Branch-base options:
- (a) Branch from current `main` (`467b09f`): independent; accept a
  small, predictable merge resolution in `lti/launch` /
  `v2-auth.ts` when both land.
- (b) Stack on the PR #6 branch: conflict-free but depends on #6
  merging first.
- (c) Wait for #6 to merge, then branch from updated `main`.
The post-handshake `lti_context` block this design hooks already exists
on `main` (it predates PR #6; Task 5 only changed the *redirect
string*), so option (a) is technically viable; the choice is about
merge ergonomics, not feasibility.

## Out of scope / non-goals (YAGNI)

- No schema/migration; no server-stored or cross-device preference (the
  cookie-only decision is deliberate).
- No change to single-role behavior, demo personas, or the demo-as
  mechanism.
- No `/api/lti/*` handshake/contract change of any kind.
- `next-phase` caller authorization — remains descoped (closed pilot;
  future internal-NLU migration), consistent with the v2-enablement
  spec.
- Making demo personas dual-role; admin "impersonate any user" tooling.
- Not scope-crept onto PR #6.
