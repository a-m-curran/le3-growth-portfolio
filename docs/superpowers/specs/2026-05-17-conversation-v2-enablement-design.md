# Conversation/Reflection in v2 — Enablement Design Spec

**Date:** 2026-05-17
**Status:** Approved (design); pending implementation plan
**Owner:** Andrew Curran

## Problem / Goal

The conversation/reflection "excavation loop" (Phase 1 → 2 → 3 → synthesis →
skill-tags → `conversation_output`) is **fully built and works in v1**. It is
**not usable from the v2 surface**, which is becoming the primary surface and
will eventually migrate to an internal NLU environment. v2 already resumes and
replays *existing* conversations (the engine and `api/conversation/[id]/next-phase`
are version-agnostic; the v2 `ConversationFlowView`/replay components exist and
work, incl. for demo personas) — but **starting a new conversation/reflection
from v2 is a deliberate dead-end**: `src/app/v2/(student)/reflect/start/page.tsx`
is a "not working yet" stub, and `JournalView`'s open-reflection entry bounces
into the v1 layout.

Root cause (verified by read-only recon this session): three write routes —
`api/conversation/start`, `api/reflect/start`, `api/conversation/[id]/tags` —
resolve identity with the **v1 pattern** `supabase.auth.getUser()` + `student`
by `auth_user_id`, returning `401` for any v2/demo-persona identity. The v2
stub exists precisely to avoid bouncing demo users into v1 (which treats
everyone as a coach).

**Goal:** enable the existing, working conversation/reflection loop in the v2
UI for every real student entry path — magic-link login, **D2L LTI launch**,
and demo personas — **without altering the D2L LTI integration contract in any
way.**

## Recon facts this design rests on (verified, read-only, this session)

- **`getV2Identity()`/`getV2StudentId()` (`src/lib/v2-auth.ts`) is a strict
  superset of the v1 auth path.** Its real-auth branch is *exactly*
  `supabase.auth.getUser()` → `student` by `auth_user_id` (identical to v1),
  **plus** the `le3-v2-demo-persona` cookie path. Switching the 3 routes to it
  cannot regress real students; it adds demo personas.
- **LTI launch ends in a normal Supabase session.** `api/lti/launch` verifies
  the platform JWT, provisions/links a Supabase auth user and sets
  `student.auth_user_id`, then mints a session via the shared
  `/api/auth/callback` magic-link path. An LTI-launched student is
  indistinguishable from a magic-link student at the `auth.getUser()` layer —
  so `getV2Identity()` resolves them with no LTI-specific bridge.
- **Already proven in production:** the v2 route `api/student/today` uses
  `getV2StudentId()` *and* reads the LTI `lti_context` cookie to render the
  Today LTI-pinned card for LTI-launched students. The pattern is shipped and
  working.
- The post-launch redirect inside `api/lti/launch` is an **internal** redirect
  string (currently `/conversation?lti_resource=…` for students, `/coach` for
  instructors) — executed *after* the D2L handshake is fully complete. D2L
  never sees it.

## Settled decisions (from brainstorming)

| Decision | Choice |
|---|---|
| v1 status | v2 is the go-forward main surface. Not a risky cutover: `getV2Identity()` ⊇ v1 auth path, so v1 pages keep resolving real students unchanged. |
| Identity resolver on the 3 write routes | **Replace** the v1 `auth.getUser()` block with `getV2StudentId()`/`getV2Identity()` (not a dual-path fallback — needless complexity given the superset). |
| LTI post-launch landing | Student → `/v2/today` (the LTI resource already auto-pins there via the existing `lti_context` cookie + v2 `TodayView` pinned card). Instructor → the existing v2 coach entry path. Both targets env-gated (next row). |
| LTI integration contract | **100% unchanged.** No D2L-facing endpoint, OIDC/JWKS handshake, `redirect_uri`, deployment/client ID, or env config is altered. Only one *internal, post-handshake* redirect string changes. |
| Redirect reversibility | Both post-launch targets are **env-gated**: `LTI_POST_LAUNCH_STUDENT_PATH` (default `/v2/today`) and `LTI_POST_LAUNCH_INSTRUCTOR_PATH` (default = the existing v2 coach entry path — exact value pinned in the implementation plan against the current v2 coach landing). Flippable per-environment with no code deploy; travels cleanly to the NLU environment. |
| Demo-persona writes | Demo personas will now **persist real** `growth_conversation`/`conversation_output` rows on their `is_demo=true` student rows. Correct and `is_demo`-filterable; this is the real feature (distinct from the parked, deliberately zero-write conversation-*validator* aid). |
| Definition of done | A full conversation is driven **end-to-end in v2 to completion** and produces a `conversation_output` row (this also finally exercises a finish path that has *never executed in prod*). |

## Architecture

No new architecture. The engine (`conversation-engine-live.ts`),
`api/conversation/[id]/next-phase`, the v2 `ConversationFlowView`/replay
components, the v2 read route `api/conversations/[id]`, and the entire
LTI→Supabase-session chain **already work and are reused unchanged**. This
feature is exactly three mechanical moves:

1. Swap the identity resolver on 3 write routes (v1 `auth.getUser()` →
   `getV2StudentId()`).
2. Un-stub the v2 start surface using components that already exist.
3. Change one internal post-handshake redirect string (env-gated) v1 → v2.

Migration-safe: the LTI tool URL stays env-driven (`LTI_TOOL_URL`); we change
only redirect *paths*, behind an env var.

## Components / exact change set

**Modify — identity resolver (no behavior change for real/LTI students; adds demo + v2):**
- `src/app/api/conversation/start/route.ts`
- `src/app/api/reflect/start/route.ts`
- `src/app/api/conversation/[id]/tags/route.ts`

  In each: replace the `supabase.auth.getUser()` + `student`-by-`auth_user_id`
  block with `getV2StudentId()` — the precise primitive here, since these are
  student-scoped writes; it returns the resolved student id, or `null` for any
  non-student / unresolved identity (→ `401`). **Preserve the existing
  per-student ownership checks**, re-keyed to the resolved id: a student/persona
  may only start/tag *their own* work/conversation; demo personas only act on
  their own `is_demo` rows. Ownership violation → `403`. No silent fallback.

**Modify — v2 start surface (the un-stub):**
- `src/app/v2/(student)/reflect/start/page.tsx` — replace the stub with a real
  surface: read the work / `lti` resource context, POST the now-v2-aware start
  route, then route into the existing `/v2/conversation/{id}`
  (`ConversationFlowView`, already working for in-progress).
- `JournalView` (open-reflection entry) — replace the v1 `ReflectForm` bounce
  with a v2-native entry that hits the v2-aware `api/reflect/start` and stays
  in v2.

**Modify — LTI post-handshake internal redirect (NOT a D2L-facing change):**
- `src/app/api/lti/launch/route.ts` — the final internal redirect, executed
  *after* JWT verification + session mint. Replace the hardcoded student
  `/conversation?lti_resource=…` and instructor `/coach` targets with two env
  knobs: `LTI_POST_LAUNCH_STUDENT_PATH` (default `/v2/today`) and
  `LTI_POST_LAUNCH_INSTRUCTOR_PATH` (default = the existing v2 coach entry path;
  the exact current v2 coach landing is pinned in the implementation plan). The
  LTI resource pin is preserved (the existing `lti_context` cookie + v2
  `TodayView` already consume it). No D2L-facing change — see Integration-safety.

**Explicitly UNCHANGED:** every `/api/lti/*` endpoint (`login`, `launch`
contract, `jwks`, `deep-link`, `config`, `notice`), the OIDC/JWKS handshake,
`redirect_uri` (= `${LTI_TOOL_URL}/api/lti/launch`), deployment/client IDs, all
LTI env; the engine; `next-phase`; the v2 conversation flow/replay components;
`api/conversations/[id]`; v1 `/conversation` & `/reflect` pages.

## Data flow

```
Arrival (any of):
  • D2L LTI launch → /api/lti/* handshake (UNCHANGED) → Supabase session
      → internal redirect to LTI_POST_LAUNCH_STUDENT_PATH (default /v2/today)
      → v2 TodayView pinned card (existing lti_context plumbing, UNCHANGED)
  • magic-link login → v2
  • demo-persona cookie → v2
→ v2 start surface (un-stubbed reflect/start, or v2 JournalView entry)
→ POST api/conversation/start | api/reflect/start   (resolves via getV2StudentId)
→ /v2/conversation/{id}  (existing ConversationFlowView)
→ phases via api/conversation/[id]/next-phase  (UNCHANGED, version-agnostic)
→ synthesis → tags via api/conversation/[id]/tags  (now v2-aware)
→ finish → inserts conversation_output  (existing logic; first prod exercise)
```

Persistence is identical to v1; only the identity resolver, the v2 entry
surface, and one internal post-launch redirect string changed.

## Integration-safety guarantee (load-bearing — the owner's hard constraint)

D2L's LTI involvement is **complete before the changed line runs**. The
sequence inside `api/lti/launch` is: receive id_token → `verifyPlatformJwt` →
provision/link Supabase user → mint session → **[then, and only then] the
internal redirect string we change**. D2L has already finished and is not a
participant in that redirect; it never observes the path. Therefore changing
`/conversation` → `/v2/today` **cannot affect the integration by construction**.
No endpoint D2L points at, no handshake step, no JWKS, no `redirect_uri`, no
client/deployment ID, no LTI env is touched anywhere in this work. The env-gated
redirect adds an instant, deploy-free revert lever.

## Error handling / security

- Identity unresolved on a write route → `401`. Ownership violation (acting on
  another student's work/conversation) → `403`. Preserve the existing
  per-student ownership checks, re-keyed to the `getV2StudentId()`-resolved id.
  No silent fallback (explicit status + message).
- **Descoped by the owner (closed pilot; future NLU migration):**
  `api/conversation/[id]/next-phase` has no caller authorization. Out of scope;
  recorded, not addressed here.

## Testing / definition of done

- **End-to-end (the real proof):** drive a full conversation to completion in
  v2 — start → phase 1/2/3 → synthesis → tags → finish — using a **demo
  persona** as the safe vehicle, and confirm it both completes and writes a
  `conversation_output` row. This is also the first time the finish→
  `conversation_output` path is exercised in this database (currently 0 rows
  ever), so it doubles as proof that path works.
- **No v1 regression (superset behavior):** v1 `/conversation` still resolves a
  real authed student unchanged (sanity/manual — the resolver swap is a
  superset, so this must hold).
- **Structural:** the 3 write routes no longer contain the v1
  `supabase.auth.getUser()` + `auth_user_id` resolution pattern; the LTI launch
  redirect honors `LTI_POST_LAUNCH_STUDENT_PATH`.
- Typecheck (`npx tsc --noEmit`) exit 0; lint clean
  (`npx eslint --no-eslintrc --config .eslintrc.json <files>` — `npx next lint`
  is environmentally broken in this repo's worktrees).

## Rollout

Code-only (no migration, no Trigger.dev). `git push` → Vercel. The env-gated
LTI redirect (`LTI_POST_LAUNCH_STUDENT_PATH`) is set in the deployment env; it
is reversible without a code deploy and carries cleanly to the internal-NLU
environment.

## Relationship to the parked conversation-validator

The conversation-*validator* (parked: spec/plan banner-marked, blocked on the
engine's `event_log` auto-write) was a *zero-write quality-validation aid* built
on the premise that the feature already worked end-to-end. This spec instead
makes the **real** feature usable in v2. Once this lands, manual quality
validation can be done the obvious way — drive the real v2 flow with a demo
persona (writes are expected and `is_demo`-filterable) — which largely obviates
the original need the validator was trying to serve. The validator stays parked;
no work here depends on or revives it.

## Out of scope / flagged (YAGNI)

- `next-phase` caller authorization — descoped by the owner.
- The `conversation_output` rubric-descriptor `{}` `TODO` in `next-phase` —
  pre-existing output-quality degradation; noted, not fixed here.
- **Migration footgun to track separately:** `demo_slug` / `is_demo` exist only
  in app code + `scripts/seed-demo-data.ts`, **not in any tracked migration**;
  they will not replay in a fresh internal-NLU environment. Out of scope for
  this feature; warrants its own follow-up before the NLU migration.
- No engine changes; no `api/conversation/*` changes beyond the 3 named routes;
  no new auth mechanism; **no D2L LTI integration changes**.
