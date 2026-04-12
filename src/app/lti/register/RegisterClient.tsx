'use client'

import { useState } from 'react'

/**
 * Human-friendly registration helper for NLU IT.
 *
 * Two parallel registration flows are documented here:
 *
 *   Part A — LTI 1.3 tool (for SSO + push-based submission notices)
 *   Part B — Valence OAuth2 application (for bulk data sync)
 *
 * Both flows end with NLU IT sending us back a set of values that we
 * plug into Vercel env vars to activate the integration.
 *
 * Client component. Receives env-derived values (tool URL, contact email)
 * as props from the server component wrapper in page.tsx so copy buttons
 * work while still reflecting current Vercel env var values.
 */

export interface RegisterClientProps {
  toolUrl: string
  vendorContact: string
}

const LTI_SCOPES = [
  {
    name: 'noticehandlers',
    url: 'https://purl.imsglobal.org/spec/lti/scope/noticehandlers',
    purpose: 'Subscribe to Asset Processor submission notices (push path)',
  },
  {
    name: 'asset.readonly',
    url: 'https://purl.imsglobal.org/spec/lti/scope/asset.readonly',
    purpose: 'Download files students submit via the push path',
  },
  {
    name: 'report',
    url: 'https://purl.imsglobal.org/spec/lti/scope/report',
    purpose: 'Report processing status back to attached dropboxes',
  },
  {
    name: 'lti-ags/lineitem.readonly',
    url: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
    purpose: 'Read assignment line items',
  },
  {
    name: 'lti-ags/result.readonly',
    url: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
    purpose: 'Read assignment results and grades',
  },
]

const VALENCE_SCOPES = [
  { name: 'core:*:*', purpose: 'General Valence API read access' },
  { name: 'dropbox:folders:read', purpose: 'List assignment dropbox folders' },
  { name: 'dropbox:submissions:read', purpose: 'List student submissions' },
  { name: 'dropbox:folder-attachments:read', purpose: 'Download submitted files' },
  { name: 'enrollment:orgunit:read', purpose: 'Read course enrollments (rosters)' },
  { name: 'users:userdata:read', purpose: 'Read student and instructor profiles' },
  { name: 'orgunit:children:read', purpose: 'Walk the LE3 org unit to find courses' },
]

const LTI_PLACEMENTS = [
  {
    name: 'Course Navigation',
    critical: true,
    brightspaceName: 'course_navigation',
    messageType: 'LtiResourceLinkRequest',
    acceptTypes: '—',
    purpose:
      'Adds "Growth Portfolio" to the course navigation bar. This is the primary entry point for students and instructors.',
  },
  {
    name: 'Assignment Attachment',
    critical: false,
    brightspaceName: 'assignment_attachment',
    messageType: 'LtiDeepLinkingRequest',
    acceptTypes: 'ltiAssetProcessor',
    purpose:
      'Optional. Lets instructors attach the portfolio to individual dropboxes as an Asset Processor. Delivers new submissions in real time as a parallel path to bulk sync.',
  },
  {
    name: 'Link Selection',
    critical: false,
    brightspaceName: 'link_selection',
    messageType: 'LtiDeepLinkingRequest',
    acceptTypes: 'ltiResourceLink',
    purpose: 'Optional. Lets instructors drop portfolio links into course pages or modules.',
  },
]

function CopyField({
  label,
  value,
  alt,
}: {
  label: string
  value: string
  alt?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* no-op */
    }
  }

  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            {label}
          </span>
          {alt && (
            <span className="text-xs text-gray-400 ml-2 italic">or {alt}</span>
          )}
        </div>
      </div>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-800 font-mono break-all">
          {value}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-2 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-green-600 hover:text-green-700 transition-colors whitespace-nowrap"
          aria-label={`Copy ${label}`}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function Step({
  number,
  title,
  time,
  children,
  part,
}: {
  number: number
  title: string
  time: string
  children: React.ReactNode
  part?: 'A' | 'B'
}) {
  const partColor = part === 'B' ? 'bg-orange-700' : 'bg-green-700'
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-4 pb-2 border-b-2 border-gray-300">
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full ${partColor} text-white font-bold text-sm shrink-0`}
        >
          {number}
        </div>
        <h2 className="text-xl font-bold text-green-900 flex-1">{title}</h2>
        <span className="text-xs text-gray-500 font-medium">{time}</span>
      </div>
      <div className="pl-11">{children}</div>
    </section>
  )
}

function PartHeader({
  label,
  title,
  description,
  color,
}: {
  label: string
  title: string
  description: string
  color: 'green' | 'orange'
}) {
  const bg = color === 'orange' ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
  const labelColor = color === 'orange' ? 'text-orange-800' : 'text-green-800'
  return (
    <div className={`mb-6 p-5 rounded-lg border-2 ${bg}`}>
      <div className={`text-xs font-bold uppercase tracking-wider ${labelColor} mb-1`}>
        {label}
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-700">{description}</p>
    </div>
  )
}

export default function RegisterClient({ toolUrl, vendorContact }: RegisterClientProps) {
  const FIELDS = {
    name: 'LE3 Growth Portfolio',
    description:
      'AI-guided reflective conversations for students in the LE3 program. Students reflect on submitted work through 3-phase AI-guided conversations. Built for NLU and eventually administered directly by NLU.',
    vendorName: 'LE3 Growth Portfolio',
    vendorContact,
    iconUrl: `${toolUrl}/favicon.ico`,
    privacyUrl: `${toolUrl}/privacy`,
    termsUrl: `${toolUrl}/terms`,
    loginUrl: `${toolUrl}/api/lti/login`,
    launchUrl: `${toolUrl}/api/lti/launch`,
    jwksUrl: `${toolUrl}/api/lti/jwks`,
    domain: toolUrl.replace(/^https?:\/\//, ''),
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 text-gray-800">
      {/* ─── Header ──────────────────────────────── */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <div className="text-xs font-semibold uppercase tracking-wider text-green-700 mb-1">
          For NLU Brightspace Administrators
        </div>
        <h1 className="text-3xl font-bold text-green-900 mb-2">
          🌱 LE3 Growth Portfolio — Registration Helper
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          The LE3 Growth Portfolio is being built for NLU&rsquo;s LE3 program
          and will eventually be administered directly by NLU. This page walks
          you through two parallel registrations in Brightspace:
          <strong> Part A</strong> is an LTI 1.3 tool (for SSO and push-based
          submission delivery), and <strong>Part B</strong> is a Valence
          OAuth2 application (for bulk data sync covering all historical and
          ongoing LE3 course data). Both paths run in parallel and share
          dedup keys so the same submission never lands twice.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
          <div>
            <span className="font-semibold">Total time:</span> ~60 minutes
          </div>
          <div>
            <span className="font-semibold">Prereq:</span> Brightspace admin access
          </div>
          <div>
            <span className="font-semibold">Ends with:</span> emailing back 6 values
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          PART A — LTI 1.3 TOOL REGISTRATION
          ═══════════════════════════════════════════════ */}
      <PartHeader
        label="Part A · ~30 min"
        title="LTI 1.3 Tool Registration"
        description="Sets up SSO from Brightspace into the portfolio. Once registered, students and instructors clicking a Growth Portfolio link in a course are automatically authenticated. Also enables the push-based Asset Processor path as a real-time secondary for submission delivery."
        color="green"
      />

      <Step number={1} title="Open the Brightspace LTI Advantage form" time="1 min" part="A">
        <p className="text-sm mb-2">
          Navigate to{' '}
          <strong>
            Admin Tools → Manage Extensibility → LTI Advantage → Register Tool
          </strong>
          .
        </p>
      </Step>

      <Step number={2} title="Tool information" time="3 min" part="A">
        <CopyField label="Tool Name" value={FIELDS.name} />
        <CopyField label="Description" value={FIELDS.description} />
        <CopyField label="Vendor / Provider Name" value={FIELDS.vendorName} />
        <CopyField label="Contact Email" value={FIELDS.vendorContact} />
        <CopyField label="Domain" value={FIELDS.domain} />
        <CopyField label="Icon URL" value={FIELDS.iconUrl} />
        <CopyField label="Privacy Policy URL" value={FIELDS.privacyUrl} />
        <CopyField label="Terms of Service URL" value={FIELDS.termsUrl} />
      </Step>

      <Step number={3} title="LTI 1.3 endpoints" time="2 min" part="A">
        <p className="text-sm mb-4 text-gray-600">
          Each field below includes both Canvas-style and IMS-standard labels
          since Brightspace versions use different names for the same thing.
          Copy the value into whichever field matches your form.
        </p>
        <CopyField
          label="OIDC Login URL"
          alt="Initiate Login URI"
          value={FIELDS.loginUrl}
        />
        <CopyField
          label="Target Link URI"
          alt="Redirect URL"
          value={FIELDS.launchUrl}
        />
        <CopyField
          label="Keyset URL"
          alt="JWKS URI / Public JWK URL"
          value={FIELDS.jwksUrl}
        />
      </Step>

      <Step number={4} title="Enable LTI scopes" time="2 min" part="A">
        <p className="text-sm mb-4 text-gray-600">
          Enable all five scopes. They are standard IMS Global scopes — no
          Brightspace-proprietary scopes here. These cover both the OIDC
          identity layer (for SSO) and the Asset Processor push path.
        </p>
        {LTI_SCOPES.map(scope => (
          <div key={scope.name} className="mb-4">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-green-700 font-semibold text-sm">☐</span>
              <span className="font-mono text-sm font-semibold">{scope.name}</span>
            </div>
            <p className="text-xs text-gray-500 ml-5 mb-1">{scope.purpose}</p>
            <div className="ml-5">
              <CopyField label="Full scope URI" value={scope.url} />
            </div>
          </div>
        ))}
      </Step>

      <Step number={5} title="Add LTI placements" time="3 min" part="A">
        <p className="text-sm mb-4 text-gray-600">
          Course Navigation is critical. The other two are optional but
          recommended — Assignment Attachment powers the real-time secondary
          submission delivery path.
        </p>
        {LTI_PLACEMENTS.map((p, i) => (
          <div
            key={p.name}
            className={`mb-6 p-4 rounded-lg border ${
              p.critical
                ? 'border-green-600 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="font-bold text-sm text-green-900">
                Placement {i + 1}: {p.name}
              </h3>
              {p.critical && (
                <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
                  Critical
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mb-3">{p.purpose}</p>
            <div className="text-xs space-y-1 mb-3">
              <div>
                <span className="font-semibold text-gray-700">Internal name:</span>{' '}
                <code className="font-mono bg-white px-1 rounded">
                  {p.brightspaceName}
                </code>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Message type:</span>{' '}
                <code className="font-mono bg-white px-1 rounded">
                  {p.messageType}
                </code>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Accept types:</span>{' '}
                <code className="font-mono bg-white px-1 rounded">
                  {p.acceptTypes}
                </code>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Label / Text:</span>{' '}
                <span className="font-mono">Growth Portfolio</span>
              </div>
            </div>
            <CopyField
              label={`Target Link URI (${p.name})`}
              value={FIELDS.launchUrl}
            />
          </div>
        ))}
      </Step>

      <Step number={6} title="Create LTI deployment" time="2 min" part="A">
        <p className="text-sm mb-3">
          After registering the tool, create a <strong>deployment</strong> of
          it. For the pilot, scope the deployment to the LE3 org unit (or
          whichever org unit contains the pilot course) to limit access while
          we test.
        </p>
        <p className="text-sm text-gray-700 mb-2">
          Brightspace will generate two values to send back in the final step:
        </p>
        <ul className="text-sm mt-2 ml-5 list-disc space-y-1 text-gray-700">
          <li>
            <strong>LTI Client ID</strong> — a UUID
          </li>
          <li>
            <strong>LTI Deployment ID</strong> — a string
          </li>
        </ul>
      </Step>

      {/* ═══════════════════════════════════════════════
          PART B — VALENCE OAUTH2 APPLICATION
          ═══════════════════════════════════════════════ */}
      <div className="mt-16">
        <PartHeader
          label="Part B · ~25 min"
          title="Valence OAuth2 Application"
          description="Sets up bulk data sync via Brightspace's native REST API. This is what makes the portfolio 'just work' — no per-assignment attachment needed, historical data available on day one, and all LE3 courses automatically synced on a schedule. Requires an admin-level service account."
          color="orange"
        />
      </div>

      <Step number={7} title="Register an OAuth2 client in Brightspace" time="5 min" part="B">
        <p className="text-sm mb-3">
          Navigate to{' '}
          <strong>Admin Tools → Manage Extensibility → OAuth 2.0 → Register an app</strong>
          .
        </p>
        <p className="text-sm mb-3">Fill in:</p>
        <CopyField label="Application Name" value="LE3 Growth Portfolio — Data Sync" />
        <div className="mb-3 text-sm">
          <span className="font-semibold text-gray-700">Grant Type:</span>{' '}
          <span>Client Credentials (server-to-server)</span>
        </div>
        <div className="mb-3 text-sm">
          <span className="font-semibold text-gray-700">Access Token Lifetime:</span>{' '}
          <span>72000 (seconds = 20 hours, the maximum)</span>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Brightspace will generate a <strong>Client ID</strong> and{' '}
          <strong>Client Secret</strong>. Save both — you&rsquo;ll send them
          back in the final step.
        </p>
      </Step>

      <Step number={8} title="Grant Valence scopes" time="3 min" part="B">
        <p className="text-sm mb-4 text-gray-600">
          These are Brightspace-specific scopes (not IMS standard). Grant all
          seven. If your OAuth registration UI asks for them as a
          space-separated string, use the &ldquo;all at once&rdquo; option below.
        </p>
        {VALENCE_SCOPES.map(scope => (
          <div key={scope.name} className="mb-2 text-sm flex items-baseline gap-2">
            <span className="text-orange-700 font-semibold">☐</span>
            <code className="font-mono font-semibold">{scope.name}</code>
            <span className="text-gray-500 text-xs">— {scope.purpose}</span>
          </div>
        ))}
        <details className="mt-4">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-orange-700">
            Show all seven as a single space-separated string
          </summary>
          <div className="mt-2">
            <CopyField
              label="All Valence scopes"
              value={VALENCE_SCOPES.map(s => s.name).join(' ')}
            />
          </div>
        </details>
      </Step>

      <Step number={9} title="Assign a service user" time="5 min" part="B">
        <p className="text-sm mb-3">
          The Client Credentials grant means our sync job acts as a specific
          Brightspace user. Designate an admin-level service account that has:
        </p>
        <ul className="text-sm ml-5 list-disc space-y-1 text-gray-700 mb-3">
          <li>Read access to all LE3 courses and their enrollments</li>
          <li>Permission to view dropbox submissions and download files</li>
          <li>Permission to read user profiles</li>
        </ul>
        <p className="text-sm text-gray-700">
          A dedicated service account (e.g.,{' '}
          <code className="font-mono text-xs bg-gray-100 px-1 rounded">
            le3-portfolio-sync@nlu.edu
          </code>
          ) is cleaner than using a real person&rsquo;s credentials. Attach
          that user to the OAuth2 application you created in Step 7.
        </p>
      </Step>

      <Step number={10} title="Identify the LE3 org unit" time="2 min" part="B">
        <p className="text-sm mb-3">
          The sync job needs to know where LE3 courses live in the
          Brightspace org structure so it can walk all descendants and find
          every LE3 course automatically.
        </p>
        <p className="text-sm mb-3">
          Find the <strong>org unit ID</strong> of the LE3 program container
          (or the top-level LE3 department, whichever is appropriate). You
          can see it in the URL when browsing the org structure:
        </p>
        <CopyField
          label="Example URL (yours will differ)"
          value="https://nlu.brightspace.com/d2l/orgstructure/home/12345"
        />
        <p className="text-xs text-gray-500">
          The number at the end is the org unit ID. Send it back in the
          final step.
        </p>
      </Step>

      {/* ═══════════════════════════════════════════════
          FINAL STEP — SEND VALUES
          ═══════════════════════════════════════════════ */}
      <Step number={11} title="Send back six values" time="2 min">
        <p className="text-sm mb-4 text-gray-600">
          Email the following to the address shown on the button below. Until
          all six values are set on our side, the integration cannot go live.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2 text-sm mb-4">
          <div className="text-xs font-bold text-yellow-900 uppercase tracking-wide mb-2">
            From Part A — LTI
          </div>
          <div>
            <input type="checkbox" className="mr-2" /> <strong>LTI Client ID</strong>{' '}
            (Step 6)
          </div>
          <div>
            <input type="checkbox" className="mr-2" />{' '}
            <strong>LTI Deployment ID</strong> (Step 6)
          </div>
          <div>
            <input type="checkbox" className="mr-2" />{' '}
            <strong>Brightspace issuer URL</strong> (e.g.,{' '}
            <code className="text-xs">https://nlu.brightspace.com</code>)
          </div>
          <div className="text-xs font-bold text-yellow-900 uppercase tracking-wide mt-4 mb-2">
            From Part B — Valence
          </div>
          <div>
            <input type="checkbox" className="mr-2" /> <strong>Valence Client ID</strong>{' '}
            (Step 7)
          </div>
          <div>
            <input type="checkbox" className="mr-2" />{' '}
            <strong>Valence Client Secret</strong> (Step 7)
          </div>
          <div>
            <input type="checkbox" className="mr-2" />{' '}
            <strong>LE3 Org Unit ID</strong> (Step 10)
          </div>
        </div>
        <a
          href={`mailto:${vendorContact}?subject=LE3%20Growth%20Portfolio%20%E2%80%94%20Brightspace%20Registration%20Complete&body=Hi%20%E2%80%94%20NLU%20IT%20has%20completed%20Brightspace%20registration.%20Here%20are%20the%20six%20values%3A%0A%0APart%20A%20%E2%80%94%20LTI%3A%0A%20%20LTI%20Client%20ID%3A%20%0A%20%20LTI%20Deployment%20ID%3A%20%0A%20%20Brightspace%20Issuer%20URL%3A%20%0A%0APart%20B%20%E2%80%94%20Valence%3A%0A%20%20Valence%20Client%20ID%3A%20%0A%20%20Valence%20Client%20Secret%3A%20%0A%20%20LE3%20Org%20Unit%20ID%3A%20%0A`}
          className="inline-block px-5 py-3 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 transition-colors"
        >
          Email the Six Values →
        </a>
      </Step>

      {/* ─── Troubleshooting ──────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-green-900 mb-3 pb-2 border-b-2 border-gray-200">
          If something doesn&rsquo;t work
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Symptom</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-700">Likely cause</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="px-3 py-2 align-top">SSO launch returns an error</td>
              <td className="px-3 py-2 align-top text-gray-600">
                LTI scopes not granted, or Redirect URL mismatch
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-3 py-2 align-top">
                Valence sync returns &ldquo;unauthorized&rdquo;
              </td>
              <td className="px-3 py-2 align-top text-gray-600">
                Valence scopes not granted, or service user lacks permission
                to read the org unit
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-3 py-2 align-top">
                Sync finds zero courses
              </td>
              <td className="px-3 py-2 align-top text-gray-600">
                Wrong LE3 org unit ID, or service user not enrolled in LE3 courses
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-3 py-2 align-top">
                &ldquo;Asset Processor&rdquo; placement isn&rsquo;t available
              </td>
              <td className="px-3 py-2 align-top text-gray-600">
                Brightspace version &lt; 20.24.3 — the Asset Processor
                (push) path is optional; the Valence sync still works.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ─── Footer ──────────────────────────────── */}
      <div className="border-t border-gray-200 pt-6 mt-10 text-xs text-gray-500 text-center">
        <p className="mb-1">
          <a href="/api/lti/config" className="text-green-700 hover:underline">
            Raw JSON configuration
          </a>{' '}
          ·{' '}
          <a href="/privacy" className="text-green-700 hover:underline">
            Privacy notice
          </a>{' '}
          ·{' '}
          <a href="/terms" className="text-green-700 hover:underline">
            Terms of use
          </a>
        </p>
        <p>LE3 Growth Portfolio · National Louis University · April 2026</p>
      </div>
    </main>
  )
}
