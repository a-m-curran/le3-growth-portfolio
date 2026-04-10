# LE3 Growth Portfolio × NLU Brightspace — Integration Requirements

## Overview

The LE3 Growth Portfolio integrates with NLU's Brightspace as an **LTI 1.3 tool**
with the **Asset Processor** extension enabled. This gives us a single, standards-based
integration that handles everything we need:

1. **Single sign-on** — Students click a link in Brightspace and land in the portfolio
   authenticated. No separate account creation, no magic links.
2. **Course context** — The portfolio knows which course, which assignment, and which
   student is viewing it, without any manual configuration.
3. **Automatic submission delivery (Asset Processor)** — When a student submits work
   to a dropbox that has the Growth Portfolio attached as an Asset Processor,
   Brightspace pushes us the submission and we pull the files via a standard LTI
   service. No polling, no credentials to manage, no separate API.
4. **Processing reports back to Brightspace** — The portfolio reports back to the
   dropbox when a student's submission has been received and processed.

This replaces the previous plan that used the proprietary Valence REST API.
Asset Processor is an IMS Global / 1EdTech extension to LTI 1.3 that NLU IT has
confirmed Brightspace supports.

---

## What NLU IT Needs to Do

Everything below happens in **one place** in Brightspace: the LTI Advantage
registration screen (Admin Tools → Manage Extensibility → LTI Advantage, or
Admin Tools → External Learning Tools depending on the version).

### Step 1: Register the tool

NLU IT registers the Growth Portfolio as a new LTI 1.3 tool. We'll provide a
**Tool Configuration URL** that returns all the values Brightspace needs:

```
https://le3-growth-portfolio.vercel.app/api/lti/config
```

Brightspace can consume this URL directly, or IT can copy the individual values
from it manually. Either way, the configuration specifies:

- **OIDC Login URL:** `https://le3-growth-portfolio.vercel.app/api/lti/login`
- **Target Link URI:** `https://le3-growth-portfolio.vercel.app/api/lti/launch`
- **Public JWKS URL:** `https://le3-growth-portfolio.vercel.app/api/lti/jwks`
- **Redirect URIs:** the launch URL above
- **Deployment:** a single deployment covering the LE3 program

### Step 2: Grant the required scopes

When registering the tool, IT should enable these five LTI Advantage scopes:

| Scope | Purpose |
|---|---|
| `https://purl.imsglobal.org/spec/lti/scope/noticehandlers` | Receive submission notifications via the Platform Notification Service |
| `https://purl.imsglobal.org/spec/lti/scope/asset.readonly` | Download files students submitted to Brightspace dropboxes |
| `https://purl.imsglobal.org/spec/lti/scope/report` | Report processing status back to the dropbox |
| `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly` | Read assignment metadata (Assignment and Grade Services) |
| `https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly` | Read assignment results (Assignment and Grade Services) |

These are all standard LTI Advantage scopes. No proprietary Brightspace scopes
are required.

### Step 3: Enable the tool placements

The tool configuration declares three placements, all of which should be enabled:

| Placement | What it does |
|---|---|
| **Assignment Attachment** (`assignment_attachment`) | Lets instructors attach the Growth Portfolio as an Asset Processor to an individual dropbox assignment. This is the key placement for automatic submission delivery. |
| **Link Selection** (`link_selection`) | Lets instructors add a "Growth Portfolio" link anywhere in a course page or module, with per-link configuration. |
| **Course Navigation** (`course_navigation`) | Adds "Growth Portfolio" to the course navigation bar so students can access their portfolio from any LE3 course. |

Only Assignment Attachment is strictly required for the Asset Processor flow.
The other two are for convenience — students can also reach the portfolio by
clicking a link in their course.

### Step 4: Send us the generated credentials

After registration, Brightspace generates two values that we need:

- **Client ID** — a UUID identifying our tool to Brightspace
- **Deployment ID** — identifies this particular deployment

We'll set these as environment variables in our hosting environment. We also
need two URLs from Brightspace, which are standard per-platform and public:

- **Platform issuer** — e.g., `https://nlu.brightspace.com`
- **Platform JWKS URL** — e.g., `https://nlu.brightspace.com/d2l/.well-known/jwks`
- **Platform auth URL** — e.g., `https://auth.brightspace.com/oauth2/auth`
- **Platform token URL** — e.g., `https://auth.brightspace.com/core/connect/token`

---

## How the Integration Works End-to-End

### Instructor attaches the portfolio to an assignment (once per assignment)

1. Instructor opens an assignment dropbox in Brightspace and edits it
2. In the "Attachments" / "External Tools" section, they add **Growth Portfolio**
3. Brightspace opens our deep-linking page. The instructor optionally pastes the
   assignment title and prompt so the AI can ask grounded questions
4. The instructor clicks "Attach to Assignment" and returns to Brightspace
5. The Growth Portfolio is now attached as an Asset Processor for that dropbox

### Student submits work (automatic from this point on)

1. Student submits a file (PDF, DOCX, TXT, or MD) to the dropbox in Brightspace
2. Brightspace sends the Growth Portfolio an `LtiAssetProcessorSubmissionNotice`
   via the Platform Notification Service — this is push-based, no polling
3. The portfolio receives the notice, downloads the submitted file(s) via the
   LTI Asset Service, and extracts the text
4. A `student_work` record is created, tagged with 1-3 durable skills by AI,
   and linked to the student's portfolio
5. The portfolio sends a "processed" report back to the dropbox via the LTI
   Asset Report Service, so the instructor can see the portfolio received it

### Student reflects on their work

1. Student clicks "Growth Portfolio" in the course navigation (or any other
   entry point) and is SSO'd into their portfolio
2. The assignment they just submitted appears at the top of their conversation hub
3. They click it and start a reflective conversation with the AI about the work
4. Over time, their portfolio accumulates work from every LE3 course they take,
   grouped by durable skill — not by course

---

## Student Identity Mapping

LTI 1.3 provides a stable opaque `sub` claim for each user. We store this as the
student's NLU ID (prefixed with `lti:`) on first launch. LTI also provides the
student's email and full name, which we use for display and to populate the
student record.

**The portfolio never needs NLU's student ID system directly** — LTI's `sub`
claim serves as the permanent unique identifier and it's guaranteed stable across
sessions by the spec.

---

## What Happens If a Student Never Launches the Portfolio

If a student submits to a dropbox that has the Growth Portfolio attached but
has never actually clicked into the portfolio, we receive the submission notice
but have no student record to attach it to. In that case we silently skip
processing and do not send a report back.

The next time the student launches the portfolio for any reason, we can
optionally backfill their submissions — but for the pilot, we expect instructors
to have students launch the portfolio once at the start of the quarter as part
of program onboarding, which creates their record.

---

## LE3 Program Course Identification

Unlike the Valence approach, we don't need to know which courses are part of LE3
in advance. The tool is available to **any course** where an instructor has
added it, and the Asset Processor only fires for **assignments where an instructor
has explicitly attached the Growth Portfolio**.

This means:

- NLU IT doesn't need to maintain a list of "LE3 courses" anywhere
- The portfolio only receives submissions it's been explicitly attached to,
  which is the correct privacy default
- New LE3 courses and sections each quarter automatically work as long as the
  tool is registered at the org level

If NLU wants to pre-attach the portfolio to every LE3 assignment automatically
(rather than relying on each instructor to do it), that's also possible via
Brightspace's bulk course administration tools — but it's not required.

---

## Data Handling

- **What we store:** student name, email, NLU ID (from LTI `sub`), program
  start date, submitted assignments (metadata + extracted text), reflective
  conversations, AI-generated skill tags, AI-generated narratives
- **What we don't store:** Brightspace grades, roster data for students who
  haven't launched the portfolio, any course data beyond what's required to
  display assignments
- **Where it lives:** PostgreSQL database on Supabase (SOC 2 Type II certified),
  hosted in the United States. Submitted files are stored only as extracted text.
- **FERPA:** The portfolio holds educational records and should be covered by
  NLU's data handling and FERPA policies. We can sign a BAA/DPA with NLU if
  required.

---

## Environment Variables (Our Side)

Once NLU IT completes registration, we set these on our hosting environment:

```
LTI_PLATFORM_ISSUER=https://nlu.brightspace.com
LTI_PLATFORM_CLIENT_ID=<generated by Brightspace at registration>
LTI_DEPLOYMENT_ID=<generated by Brightspace at registration>
LTI_PLATFORM_AUTH_URL=https://auth.brightspace.com/oauth2/auth
LTI_PLATFORM_TOKEN_URL=https://auth.brightspace.com/core/connect/token
LTI_PLATFORM_JWKS_URL=https://nlu.brightspace.com/d2l/.well-known/jwks
LTI_PRIVATE_KEY=<our tool's RSA private key, we generate this>
LTI_PUBLIC_KEY=<matching public key, exposed via our JWKS URL>
LTI_KEY_ID=<arbitrary key identifier>
LTI_TOOL_URL=https://le3-growth-portfolio.vercel.app
```

No Brightspace-specific API tokens are needed. All authentication uses the
LTI 1.3 JWT client assertion flow with the key pair above.

---

## Questions for NLU IT

1. **Asset Processor confirmation:** You mentioned Brightspace supports an "asset
   processor" for LTI 1.3 integrations. Can you confirm it's enabled for NLU's
   instance and which Brightspace release version you're on? (Asset Processor
   requires Brightspace 20.24.3 or later.)
2. **Instance URL:** What's the public URL for NLU's Brightspace instance?
3. **Registration path:** Who handles LTI 1.3 tool registration on your side,
   and can we schedule a 30-minute call to walk through it together?
4. **Pilot scope:** Do you want to register the tool at the org level (available
   to all courses, instructors opt-in per assignment) or limited to a specific
   LE3 pilot course?
5. **Testing:** Is there a Brightspace sandbox we can register against before
   going live in production?
6. **Data governance:** Do you need us to sign a DPA or FERPA addendum? Are
   there any data residency requirements beyond "US-based hosting"?

---

## Summary for IT

| What you need to do | Effort | Who |
|---|---|---|
| Generate a Brightspace LTI 1.3 tool registration using our config URL | ~15 min | Brightspace admin |
| Grant the five LTI Advantage scopes listed above | included above | same |
| Send us the Client ID and Deployment ID | ~2 min | same |
| Optionally, attach the portfolio to LE3 assignments in bulk | variable | instructors or admin |

No API tokens to manage. No service users to create. No scheduled polling. No
maintenance once registered — new courses and new cohorts work automatically.
