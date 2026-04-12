# LE3 Growth Portfolio × NLU Brightspace — Integration Requirements

## Overview

The LE3 Growth Portfolio integrates with NLU's Brightspace via two parallel
paths that run simultaneously and share data through a unified dedup key.

### Path A — LTI 1.3 (for SSO + real-time push)

A standards-based LTI 1.3 tool registration. Handles:

- **Single sign-on.** Students click a "Growth Portfolio" link in their
  course navigation and land in the portfolio, authenticated, without
  creating an account or entering a password.
- **Course context.** Every launch carries the student's identity, course,
  and role — the portfolio knows who they are and what course they came
  from automatically.
- **Real-time push** (optional). If an instructor attaches the portfolio
  as an Asset Processor to a specific dropbox, new submissions to that
  dropbox are delivered via webhook within seconds.

### Path B — D2L Valence REST API (for bulk sync)

A Brightspace-native OAuth2 application with admin-level read access.
Handles:

- **Bulk sync of all LE3 data.** Every course in the LE3 org unit, every
  enrolled student, every assignment, every submission — pulled on a
  schedule and kept in sync automatically.
- **Historical data.** On the first sync, the portfolio pulls every
  past submission for every LE3 student, so the pilot feels populated
  on day one.
- **No per-assignment attachment needed.** Instructors don't have to
  opt each dropbox in individually — the sync walks the org unit
  automatically.
- **Coach-student assignments.** Enrollment data from Valence tells us
  which instructor teaches each course, so we can assign coaches
  properly instead of defaulting every student to the first active coach.

### Why both paths

The two paths are complementary:

- **Valence is comprehensive** — it sees everything and doesn't require
  instructor action — but it's polling-based, so new submissions appear
  in the portfolio after the next sync interval (typically a few
  minutes).
- **Asset Processor is instant** — a submission webhook arrives within
  seconds — but it only works for dropboxes where an instructor has
  explicitly attached the tool.

Running both means new submissions appear immediately when a dropbox is
attached, and everything else gets caught up on the next Valence sync.
Both paths share a unified `brightspace_submission_id` key so the same
submission never lands twice regardless of which path delivered it.

---

## What NLU IT Needs to Do

Two parallel registrations in Brightspace, both in the same Admin Tools
section. Total time is ~60 minutes.

### Part A — LTI 1.3 Tool Registration (~30 min)

**Where:** Admin Tools → Manage Extensibility → LTI Advantage → Register Tool

**Steps:**

1. Enter the tool information (name, description, vendor, contact, icon URL,
   privacy URL, terms URL — all provided in the helper page below or in
   the accompanying Word doc)
2. Enter the OIDC login URL, target link URI, and JWKS URL
3. Grant the five LTI Advantage scopes:
   - `https://purl.imsglobal.org/spec/lti/scope/noticehandlers`
   - `https://purl.imsglobal.org/spec/lti/scope/asset.readonly`
   - `https://purl.imsglobal.org/spec/lti/scope/report`
   - `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly`
   - `https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly`
4. Enable three placements:
   - **Course Navigation** (critical) — adds "Growth Portfolio" to the
     course nav bar
   - **Assignment Attachment** (optional) — lets instructors attach the
     tool to individual dropboxes for real-time submission push
   - **Link Selection** (optional) — lets instructors drop portfolio
     links into any course page or module
5. Create a deployment scoped to the LE3 org unit (or org-wide if you
   prefer)
6. Save and note the generated Client ID and Deployment ID

### Part B — Valence OAuth2 Application (~25 min)

**Where:** Admin Tools → Manage Extensibility → OAuth 2.0 → Register an app

**Steps:**

1. Create a new OAuth2 application:
   - Name: `LE3 Growth Portfolio — Data Sync`
   - Grant type: **Client Credentials**
   - Access token lifetime: 72000 seconds (20h, the max)
2. Grant these Brightspace-native scopes:
   - `core:*:*`
   - `dropbox:folders:read`
   - `dropbox:submissions:read`
   - `dropbox:folder-attachments:read`
   - `enrollment:orgunit:read`
   - `users:userdata:read`
   - `orgunit:children:read`
3. Assign a **service user** (admin-level account) that has read access to
   all LE3 courses. Dedicated service accounts are preferred over personal
   credentials.
4. Identify the **LE3 org unit ID** so the sync job knows where to start
   walking. This is the org unit that contains all LE3 courses as
   descendants (whether a program-level container or a top-level LE3
   department).
5. Save and note the generated Client ID and Client Secret.

### What to send back

Six values in a single email:

| From | Value | Source |
|---|---|---|
| Part A | LTI Client ID | Brightspace registration output |
| Part A | LTI Deployment ID | Brightspace registration output |
| Part A | Brightspace issuer URL | e.g., `https://nlu.brightspace.com` |
| Part B | Valence Client ID | OAuth2 application output |
| Part B | Valence Client Secret | OAuth2 application output |
| Part B | LE3 Org Unit ID | From your Brightspace org structure |

---

## How the Integration Works After Setup

### Instructor experience

**Nothing changes for instructors.** They teach their LE3 courses in
Brightspace normally. The Growth Portfolio automatically receives all
student submissions via bulk sync — no per-assignment configuration
required.

If they want real-time delivery (so the portfolio sees submissions within
seconds instead of minutes), they can optionally attach the Growth
Portfolio as an Asset Processor to their dropbox. This is a 30-second
action and the Valence sync continues to work as a backup regardless.

### Student experience

1. On day one of the LE3 program, a student clicks "Growth Portfolio" in
   the course nav of any LE3 course. This is the onboarding trigger.
2. LTI launches them into the portfolio, authenticated. Their student
   record — pre-populated by the first Valence sync — gets "claimed"
   and linked to their Brightspace account.
3. They immediately see all their past LE3 work waiting for them, tagged
   with durable skills by the AI auto-tagger.
4. They click any assignment to start a reflective conversation.
5. Going forward, new submissions they make in Brightspace flow into the
   portfolio automatically (via Valence sync on a schedule, or via
   Asset Processor push webhook for attached assignments — whichever is
   faster).

### Coach experience

Coaches launch the portfolio the same way (via LTI from any LE3 course)
and land on the coach dashboard. They see all students assigned to them,
with pre-synced work and conversations. A "Sync Now" button lets them
trigger an on-demand full sync if they want fresher data than the
scheduled run provides.

---

## Data Flow Summary

| Data | How it arrives | When |
|---|---|---|
| **Courses** (all LE3) | Valence sync, walking org unit descendants | Scheduled (hourly) + manual triggers |
| **Students** (rosters) | Valence sync, pulling classlist per course | Same |
| **Instructors** (coaches) | Valence sync, instructor role in classlist | Same |
| **Assignments** | Valence sync, listing dropbox folders per course | Same |
| **Submissions + file content + grades** | Valence sync downloads files, extracts text, auto-tags | Same |
| **Real-time submission delivery** | LTI Asset Processor webhook (for attached dropboxes) | Within seconds of submission |
| **Student identity** | LTI launch JWT (name, email, opaque ID) | On first click into portfolio |
| **Assignment prompt (instructor's instructions)** | Valence sync from dropbox custom instructions OR Asset Processor `activity.description` | Same |

---

## What We'll Set as Environment Variables

Once NLU IT provides the six values, we configure these on Vercel:

### For Part A (LTI 1.3)

```
LTI_PLATFORM_ISSUER=https://nlu.brightspace.com
LTI_PLATFORM_CLIENT_ID=<from Brightspace>
LTI_DEPLOYMENT_ID=<from Brightspace>
LTI_PLATFORM_AUTH_URL=https://auth.brightspace.com/oauth2/auth
LTI_PLATFORM_TOKEN_URL=https://auth.brightspace.com/core/connect/token
LTI_PLATFORM_JWKS_URL=https://nlu.brightspace.com/d2l/.well-known/jwks
LTI_PRIVATE_KEY=<our tool's RSA private key>
LTI_PUBLIC_KEY=<matching public key>
LTI_TOOL_URL=https://le3-growth-portfolio.vercel.app
```

### For Part B (Valence)

```
D2L_VALENCE_INSTANCE_URL=https://nlu.brightspace.com
D2L_VALENCE_CLIENT_ID=<from Brightspace>
D2L_VALENCE_CLIENT_SECRET=<from Brightspace>
D2L_VALENCE_TOKEN_URL=https://auth.brightspace.com/core/connect/token
D2L_VALENCE_API_VERSION=1.82
D2L_VALENCE_LE3_ORG_UNIT_ID=<the LE3 parent org unit>
```

No D2L Brightspace-provided credentials end up in our code — they all
flow through environment variables and are stored only in Vercel's
encrypted env var storage.

---

## Data Handling

- **What we store:** student name, email, stable opaque identifier,
  submitted assignments (metadata + extracted text), reflective
  conversations, AI-generated skill tags, AI-generated narratives,
  coach notes, quarterly goals
- **Where it lives:** PostgreSQL database on Supabase (SOC 2 Type II
  certified), hosted in the United States
- **Subprocessors:** Supabase (database), Vercel (hosting), Anthropic
  (Claude API, does not train on inputs), Google (Gemini API on paid
  tier, does not train on inputs). All US-based.
- **FERPA:** The portfolio handles educational records and operates as
  a "school official" under NLU's direction. Subject to revision with
  NLU's Office of the General Counsel before full pilot launch.

---

## Questions for NLU IT

1. **Brightspace version.** What release are you on? (Asset Processor
   requires 20.24.3+. Valence works on all supported versions.)
2. **Sandbox availability.** Can we test against a non-production
   instance first, or should we go straight to a scoped pilot in
   production?
3. **Pilot scope.** Which org unit should Part A deployment + Part B
   sync be scoped to — a single course, a specific LE3 department, or
   the whole LE3 program?
4. **Service user.** Which account should Part B's OAuth2 application
   act as? A dedicated service account is preferred.
5. **Data Processing Agreement.** Do you need us to sign a DPA or FERPA
   addendum before pilot launch? Can you send your template?
6. **Support contact.** Who should we direct students to for FERPA
   requests (access, correction, deletion of their records)?

---

## Summary for IT

| Task | Time | Who |
|---|---|---|
| Register LTI 1.3 tool (Part A) | ~30 min | Brightspace admin |
| Register Valence OAuth2 app (Part B) | ~25 min | Same |
| Designate service user for Valence | ~2 min | Same |
| Identify LE3 org unit ID | ~1 min | Same |
| Send six values back via email | ~2 min | Same |

**Total: ~60 minutes.**

After that, no instructor action is required to onboard new LE3
assignments — everything flows automatically. New courses added to the
LE3 org unit are picked up by the next Valence sync. New students
enrolled in those courses appear automatically. The integration is
maintenance-free once the initial registration is complete.

## Helper page

For step-by-step instructions with copy-to-clipboard buttons on every
value, open:

```
https://le3-growth-portfolio.vercel.app/lti/register
```

That page walks through both Part A and Part B in numbered steps and
ends with a mailto button that drafts the "here are the six values"
email automatically.
