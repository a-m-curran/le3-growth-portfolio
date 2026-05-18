# SP2 — /v2/me Preferences Pane + Dual-Role Switcher — Design Spec

**Date:** 2026-05-18
**Status:** Approved (design); pending implementation plan
**Owner:** Andrew Curran
**Sub-project:** 2 of 3 (SP1 cutover · SP2 /v2/me preferences · SP3 mobile-nav). Independent; own spec → plan → PR.

## Problem / Goal

The v2 `/v2/me` "Preferences" card is three **static stub rows**
(`MeView.tsx`): "Email notifications" → "Coming soon", "Push
notifications" → "Coming soon", and "Data handling preferences" → "View
consent notice" (a dead label, **no action wired**). The data-handling
row should actually function; the notification stubs are noise; the pane
also has dead `nluId`/`programStartDate` props `page.tsx` never passes.
Separately, the PR #7 dual-role switcher is invisible on `/v2/me` (that
page is outside the route groups and builds its own `AppShell` without
`dualRole` — a flagged, deliberately-unfixed Minor), and `/v2/me` is the
natural home for an identity/account control.

**Goal:** tidy the Preferences card; drop push/email for now; make "Data
handling preferences" actually work (reusing the existing consent infra,
no schema change); and surface the dual-role switcher in the `/v2/me`
Account card (fixing the `dualRole`-not-passed Minor).

## Recon facts this design rests on (verified, read-only, this session)

- `src/app/v2/me/MeView.tsx` is a `'use client'` component receiving
  `{kind,name,email,meta,nluId?,programStartDate?}`. `page.tsx`
  (`src/app/v2/me/page.tsx`) passes only `kind/name/email/meta` — so the
  `nluId`/`programStartDate` identity sub-grid (MeView ~L45-60) **never
  renders**: dead props/code.
- The Preferences card (MeView ~L63-71) is three static `PrefRow`s with
  no handlers/links.
- Consent infra exists and is correct: `student.data_consent_
  acknowledged_at` (migration `016_student_data_consent.sql` —
  explicitly *informational, one-time, NOT access-gating*); `GET/POST
  /api/student/acknowledge-consent` (GET → `{acknowledged,
  acknowledgedAt}`; non-students get `{acknowledged:true}`; POST is
  idempotent + audit-logged); `src/components/student/DataConsentModal
  .tsx`.
- `DataConsentModal` is self-contained: on mount it fetches the GET and
  **renders `null` while loading OR once acknowledged**
  (`if (!status || status.acknowledged) return null`) — a first-visit
  gate only. It is **mounted only on `src/app/garden/page.tsx`** (v1
  garden). SP1 turns `/garden` into a redirect stub → this would
  **orphan the first-visit notice** for new students. (SP1↔SP2
  dependency.)
- PR #7 infra (on main): `getV2Identity()` returns `dualRole: boolean`
  on both `V2Identity` variants; `RoleSwitcher` (`src/components/v2/
  RoleSwitcher.tsx`, a `dualRole`-only form POSTing
  `/api/v2/switch-role`); `POST /api/v2/switch-role` (ownership-gated).
  `AppShell` renders `RoleSwitcher` via its `belowUser` slot **only when
  passed `dualRole`** — `/v2/me/page.tsx` builds its own `<AppShell>`
  and does **not** pass `dualRole` (the flagged Minor).
- Dual-role is an in-place role toggle for ONE `auth_user_id` owning
  BOTH a coach and a student row — **not** an account switcher between
  two emails. (`andrewmcurran@gmail.com` has 0 student rows today → not
  dual-role; the `DUALROLE-ANDREW` runbook in PR #7's verification
  commit makes it dual-role. Out of scope here — SP2 only surfaces the
  control.)

## Settled decisions (from brainstorming)

| Decision | Choice |
|---|---|
| "Data handling actually works" | **View notice + acknowledgement state.** Row opens the data-handling notice (reused content), shows acknowledged status + date (existing GET); if unacknowledged, an acknowledge action (existing POST). No granular opt-outs, no sync changes, **no schema change**. |
| Reuse approach | **Extract one shared `DataHandlingNotice` presentational component** (single source of truth — it's a privacy notice that must stay accurate). Rejected: duplicating the notice JSX into the pane (privacy-text drift); a separate `/v2/me/data` sub-page (heavier; breaks the modal pattern). |
| Notifications | **Remove** the "Email notifications" + "Push notifications" stub rows for now (explicitly descoped). |
| Dead identity props | **Remove** `nluId`/`programStartDate` props + the never-rendered sub-grid (YAGNI tidy; wiring them needs new identity plumbing — out of "tidy" scope). |
| First-visit modal | **Re-home `DataConsentModal` into the v2 student flow** (SP1 retires `/garden` where it currently lives). |
| Dual-role switcher | **Fold into SP2:** pass `dualRole` into `/v2/me`'s `AppShell` (fixes the Minor → sidebar switcher works on `/v2/me` too) **and** add a `dualRole`-gated "Switch to Student/Coach" control to the `/v2/me` **Account** card (its natural home). Reuse PR #7 infra; no account-switching; no schema change. (Does **not** make any account dual-role — that's the separate `DUALROLE-ANDREW` runbook step.) |

## Architecture

Pure v2-frontend + reuse of existing consent infra and PR #7 dual-role
infra. **No schema change, no new API.** Net moves: (a) extract the
notice content to a shared component with two consumers; (b) tidy the
Preferences card and make the data-handling row functional; (c)
re-home the first-visit modal into v2; (d) plumb `dualRole` into
`/v2/me` and add the switcher to the Account card.

## Components / exact change set

**Create — `src/components/student/DataHandlingNotice.tsx`:**
- Presentational component holding the notice body (the "what we bring
  in from Brightspace / what we don't do / AI in conversations" content
  currently inline in `DataConsentModal` ~L73-162), plus an optional
  action slot (so a consumer can render an Acknowledge button or an
  ack-state line). No data fetching of its own.

**Modify — `src/components/student/DataConsentModal.tsx`:**
- Becomes a thin first-visit wrapper: keep the existing GET-status fetch
  and the `if (!status || status.acknowledged) return null` gate
  (first-visit behavior **unchanged**); when unacknowledged, render the
  overlay using `<DataHandlingNotice>` with the existing acknowledge
  button + POST. Net: identical first-visit UX, content now sourced from
  the shared component.

**Modify — re-home the first-visit modal into v2:**
- Mount `DataConsentModal` in the v2 student flow so new students still
  get the first-visit notice after SP1 retires `/garden`. Target: the
  v2 student layout (`src/app/v2/(student)/layout.tsx`) — it wraps all
  student surfaces and is the natural successor to the v1 garden mount.
  (The modal self-gates: non-students/acknowledged render nothing, so a
  layout-level mount is safe and is the minimal correct re-home.)

**Modify — `src/app/v2/me/page.tsx`:**
- It already passes `role={identity.role}` to the `<AppShell>` it
  constructs; **add `dualRole={identity.dualRole}`** to that `<AppShell>`
  (fixes the flagged Minor → the sidebar `RoleSwitcher` now also renders
  on `/v2/me`).
- It already passes `kind` (= the active role) to `<MeView>`; **add
  `dualRole={identity.dualRole}`** to `<MeView>` so the Account-card
  control can render. No redundant `role` prop — `MeView`'s existing
  `kind: 'student' | 'coach'` IS the active role and is what
  `RoleSwitcher` needs.

**Modify — `src/app/v2/me/MeView.tsx`:**
- **Remove** `nluId`/`programStartDate` from `MeViewProps` and delete the
  never-rendered identity sub-grid block.
- **Preferences card:** remove the "Email notifications" and "Push
  notifications" `PrefRow`s. Replace the dead "Data handling
  preferences" row with a functional control (student-only, i.e.
  `kind==='student'`): a button that opens `<DataHandlingNotice>` in a
  **review modal** (viewable anytime, even post-acknowledgement);
  alongside it, an ack-state line from `GET /api/student/acknowledge-
  consent` ("Acknowledged on <date>" / "Not yet acknowledged"); if
  unacknowledged, the review modal still offers the acknowledge action
  (`POST`). For `kind==='coach'` the data-handling row does not apply
  (GET returns `acknowledged:true` for non-students) — after removing
  the notif rows the coach Preferences card would be empty, so **render
  no Preferences card for coaches** (tidy: no empty card).
- **Account card:** add a `dualRole`-gated "Switch to Student / Switch
  to Coach" control next to "Sign out" (its natural home). Reuse the
  existing `RoleSwitcher` component (it already renders the correct
  target label and POSTs `/api/v2/switch-role?role=<other>`); render it
  only when `dualRole === true`. Single-role users (and any account not
  yet dual-role) see nothing — unchanged.

**Explicitly UNCHANGED:** `student` schema / migration 016; `GET/POST
/api/student/acknowledge-consent`; `POST /api/v2/switch-role`;
`getV2Identity`; the sidebar `RoleSwitcher` mechanism; demo-as.

## Data flow

```
Student /v2/me:
  page.tsx getV2Identity() → AppShell(dualRole, role) [sidebar switcher
    now works here] → MeView(kind=student, dualRole, role)
  Preferences card → "Data handling" → opens DataHandlingNotice review
    modal; ack-state line from GET; Acknowledge (if needed) → POST
  Account card → if dualRole: RoleSwitcher → POST /api/v2/switch-role
Coach /v2/me: no Preferences card; Account card switcher only if dualRole
New student (any v2 student page): (student) layout mounts
  DataConsentModal → self-gates → first-visit notice (re-homed from the
  retired v1 /garden)
```

## Error handling / security

- Data-handling control is student-only; the GET already returns
  `{acknowledged:true}` for non-students (no spurious modal). Review
  modal is viewable regardless of ack state; the acknowledge action is
  the existing idempotent POST (first timestamp preserved).
- The Account-card switcher reuses `RoleSwitcher` + the ownership-gated
  `POST /api/v2/switch-role` (server re-validates row ownership;
  `getV2Identity` re-derives `dualRole` every request) — no new trust
  surface; the cookie never grants a role. Renders only when
  `dualRole===true`.
- Re-homing the modal at the (student) layout is safe by the modal's
  own self-gating (loading/acknowledged/non-student → renders nothing).

## Testing / definition of done

- **Structural source-scan:** `DataHandlingNotice` exists and is
  imported by both `DataConsentModal` and `MeView`; `MeView` no longer
  contains the "Email notifications"/"Push notifications" rows nor
  `nluId`/`programStartDate`; the data-handling row is a real control
  (opens the notice; references the acknowledge-consent endpoint);
  `/v2/me/page.tsx` passes `dualRole` to `AppShell` and `MeView`;
  `MeView` renders `RoleSwitcher` gated on `dualRole`; the v2 (student)
  layout mounts `DataConsentModal`.
- `npx tsc --noEmit` 0; eslint clean; `npm run build` 0.
- **Manual:** student `/v2/me` → open the notice, see "Acknowledged on
  <date>"; a brand-new student still gets the first-visit modal in v2
  (not lost when `/garden` is retired by SP1); coach `/v2/me` shows no
  empty Preferences card; with a dual-role account, the Account card
  shows the switcher and it flips coach↔student; a single-role account
  shows no switcher.

## Rollout & sequencing

Code-only; no migration. Own PR (separate from SP1/SP3). **SP1↔SP2
dependency:** SP1 turns `/garden` into a redirect stub, orphaning the
v1-mounted `DataConsentModal`; SP2 re-homes it into the v2 (student)
layout. Therefore **SP2 should land with or before SP1's `/garden`
redirect** (or SP1's `/garden` stub must not ship until SP2's re-home
is in) so new students are never without the first-visit notice. The
implementation-plan/sequencing must enforce this ordering. (No
conflicting files expected: SP1 touches v1 pages/root/callback/login;
SP2 touches `/v2/me`, the v2 (student) layout, the consent components —
disjoint.)

## Out of scope / non-goals

- Push/email notifications; granular data opt-outs or any sync-pipeline
  change; any schema change.
- Making any specific account dual-role (the `DUALROLE-ANDREW` runbook
  is a separate, owner-run step).
- Wiring NLU ID / program-start into the pane (dead props removed, not
  populated).
- SP1 (cutover) and SP3 (mobile-nav) — separate specs.
