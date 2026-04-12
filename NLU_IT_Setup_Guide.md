# LE3 Growth Portfolio — IT Setup Guide

**Audience:** NLU Brightspace administrator
**Time required:** ~30 minutes
**What you're doing:** Registering an external LTI 1.3 tool so NLU students can SSO into the Growth Portfolio and so student submissions to selected assignments flow to it automatically.

---

## The easy path

Open this URL in a browser for a step-by-step registration helper with
copy-to-clipboard buttons for every value you need:

```
https://le3-growth-portfolio.vercel.app/lti/register
```

That page walks you through the same steps as this document, but with
clickable copy buttons next to every URL, scope, and placement value so
you can paste directly into Brightspace's admin form. If you can reach
that URL from your workstation, **use it instead of this doc**. The rest
of this document is a reference for offline / locked-down environments.

---

## Before you start

You'll need:
- Brightspace admin access with permission to register LTI Advantage tools
- Brightspace version **20.24.3 or later** (required for Asset Processor)
- About 30 minutes

You'll be sending us four values at the end. Nothing else is required from your side.

---

## Step 1 — Register the tool (5 min)

In Brightspace, go to:

**Admin Tools → Manage Extensibility → LTI Advantage → Register Tool**

Fill in these fields:

| Field | Value |
|---|---|
| Name | `LE3 Growth Portfolio` |
| Description | `AI-guided reflective conversations for LE3` |
| Vendor / Provider Name | `LE3 Growth Portfolio` |
| Contact Email | `contact@le3-growth-portfolio.vercel.app` |
| Domain | `le3-growth-portfolio.vercel.app` |
| Icon URL | `https://le3-growth-portfolio.vercel.app/favicon.ico` |
| Privacy Policy URL | `https://le3-growth-portfolio.vercel.app/privacy` |
| Terms of Service URL | `https://le3-growth-portfolio.vercel.app/terms` |
| Redirect URL | `https://le3-growth-portfolio.vercel.app/api/lti/launch` |
| OpenID Connect Login URL *(a.k.a. Initiate Login URI)* | `https://le3-growth-portfolio.vercel.app/api/lti/login` |
| Target Link URI | `https://le3-growth-portfolio.vercel.app/api/lti/launch` |
| Keyset URL *(a.k.a. JWKS URI)* | `https://le3-growth-portfolio.vercel.app/api/lti/jwks` |

Raw JSON of all these values (for reference) is at:
```
https://le3-growth-portfolio.vercel.app/api/lti/config
```
Brightspace does not auto-import from this URL — it's provided so you can
confirm our expected values match what you're entering.

---

## Step 2 — Grant LTI Advantage scopes (2 min)

Enable these five scopes on the tool registration. They're all standard IMS Global scopes — no Brightspace-proprietary scopes needed.

```
https://purl.imsglobal.org/spec/lti/scope/noticehandlers
https://purl.imsglobal.org/spec/lti/scope/asset.readonly
https://purl.imsglobal.org/spec/lti/scope/report
https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly
https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly
```

**What each one does:**
- `noticehandlers` — lets us subscribe to submission notices
- `asset.readonly` — lets us download files students submitted
- `report` — lets us report "processed" back to the dropbox
- `lineitem.readonly` / `result.readonly` — lets us read assignment metadata

---

## Step 3 — Enable placements (2 min)

Enable these three placements on the tool:

| Placement | What it does |
|---|---|
| **Assignment Attachment** | Critical. Lets instructors attach the portfolio to individual dropboxes as an Asset Processor so submissions flow automatically. |
| **Link Selection** | Lets instructors drop a portfolio link into any course page or module. |
| **Course Navigation** | Adds "Growth Portfolio" to the course nav bar. |

If Brightspace's placement UI uses different names, look for:
- "Assignment Submission / Asset Processor"
- "Editor / Course Builder Link"
- "Course Navigation Link"

---

## Step 4 — Create a deployment (2 min)

After registering the tool, create a deployment of it. For the pilot, scope the deployment to the LE3 org unit (or whichever org unit contains the pilot course). This limits the tool to just LE3 courses while we test.

Brightspace will generate:
- **Client ID** — a UUID
- **Deployment ID** — a string

**Save these two values.** You'll send them to us.

---

## Step 5 — Send us four values (2 min)

Email the following to **[your email]**:

1. **Client ID** (from Step 4)
2. **Deployment ID** (from Step 4)
3. **Your Brightspace issuer URL** — usually `https://nlu.brightspace.com`
4. **Confirmation of your Brightspace release version** — so we can verify Asset Processor compatibility

We already know the standard Brightspace auth, token, and JWKS URLs for D2L, so we don't need those unless your instance uses non-standard ones.

---

## Step 6 — Quick verification test (5 min)

In a test course:

1. Add the Growth Portfolio link to the course nav (Course Tools → Navigation & Themes → add "Growth Portfolio")
2. Click it. You should land at `le3-growth-portfolio.vercel.app` authenticated as yourself.
3. If you see the portfolio homepage with your name in the corner, **SSO is working**.

Then test Asset Processor:

1. Create a new assignment dropbox in the test course
2. Edit it, go to Attachments / External Tools, add **Growth Portfolio**
3. In the deep-linking page that opens, click "Attach to Assignment"
4. Return to the dropbox and save it
5. As a test student, submit a PDF or DOCX to that dropbox
6. Within ~30 seconds, we should receive the submission. Let us know and we'll confirm on our side.

If all six steps work, the integration is live.

---

## That's it

Once the four values are in our hands and the test launch works, the integration is complete on your side. No ongoing maintenance. New LE3 courses each quarter work automatically — they'll just need the portfolio attached to individual assignments by instructors (or bulk-attached via course templates, if you prefer).

---

## If something doesn't work

Most common issues:

| Symptom | Likely cause |
|---|---|
| "Asset Processor" placement isn't an option | Brightspace version < 20.24.3, or Asset Processor feature flag disabled at the org level |
| SSO launch returns an error | Scopes not granted, or Redirect URL mismatch |
| Submission not received after student uploads | Tool not attached to the specific dropbox (attachment is per-assignment, not per-course) |
| Deep linking returns an error | Deployment not scoped to include the course |

Send us the error message or a screenshot and we'll diagnose.

---

## Questions we'd love answered on the kickoff call

1. What Brightspace release version are you on?
2. Is there a sandbox instance we should register against first, or go straight to production?
3. What's the pilot scope — single course, single instructor, or full LE3 org unit?
4. Do you require a Data Processing Agreement / FERPA addendum before we go live? If so, can you send your template?
5. Will a Brightspace admin bulk-attach the portfolio to LE3 assignments, or will individual instructors do it themselves?

---

## What we'll do on our side

Once you send the four values:
1. Set four environment variables on our Vercel deployment (~2 min)
2. Redeploy (~2 min)
3. Run through the verification steps in Step 6 with you on a call

Total time from receiving your values to live pilot: under 10 minutes.
