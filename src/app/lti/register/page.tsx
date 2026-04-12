'use client'

import { useState } from 'react'

/**
 * Human-friendly registration helper for NLU IT.
 *
 * When NLU IT needs to register the LE3 Growth Portfolio as an LTI 1.3 tool
 * in Brightspace, they can visit this page to see every value they need to
 * copy into Brightspace's admin UI, organized into numbered steps, with copy
 * buttons for each value. This is the URL to send to them — not /api/lti/config
 * (which returns raw JSON).
 *
 * Kept simple on purpose: no API fetching, all values statically rendered so
 * an admin on a locked-down workstation can still use it.
 */

const TOOL_URL = 'https://le3-growth-portfolio.vercel.app'

const FIELDS = {
  name: 'LE3 Growth Portfolio',
  description:
    'AI-guided reflective conversations for students in the LE3 program. Students reflect on submitted work through 3-phase AI-guided conversations. Attached as an Asset Processor, the tool automatically receives student submissions.',
  vendorName: 'LE3 Growth Portfolio',
  vendorContact: 'contact@le3-growth-portfolio.vercel.app',
  iconUrl: `${TOOL_URL}/favicon.ico`,
  privacyUrl: `${TOOL_URL}/privacy`,
  termsUrl: `${TOOL_URL}/terms`,
  loginUrl: `${TOOL_URL}/api/lti/login`,
  launchUrl: `${TOOL_URL}/api/lti/launch`,
  jwksUrl: `${TOOL_URL}/api/lti/jwks`,
  domain: 'le3-growth-portfolio.vercel.app',
}

const SCOPES = [
  {
    name: 'noticehandlers',
    url: 'https://purl.imsglobal.org/spec/lti/scope/noticehandlers',
    purpose: 'Subscribe to submission notices via Platform Notification Service',
  },
  {
    name: 'asset.readonly',
    url: 'https://purl.imsglobal.org/spec/lti/scope/asset.readonly',
    purpose: 'Download files students submit to Brightspace dropboxes',
  },
  {
    name: 'report',
    url: 'https://purl.imsglobal.org/spec/lti/scope/report',
    purpose: 'Report processing status back to dropboxes',
  },
  {
    name: 'lti-ags/lineitem.readonly',
    url: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
    purpose: 'Read assignment metadata',
  },
  {
    name: 'lti-ags/result.readonly',
    url: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
    purpose: 'Read assignment results',
  },
]

const PLACEMENTS = [
  {
    name: 'Assignment Attachment',
    critical: true,
    brightspaceName: 'assignment_attachment',
    messageType: 'LtiDeepLinkingRequest',
    acceptTypes: 'ltiAssetProcessor',
    purpose:
      'The critical one. Lets instructors attach the portfolio to individual dropboxes as an Asset Processor so submissions flow automatically.',
  },
  {
    name: 'Link Selection',
    critical: false,
    brightspaceName: 'link_selection',
    messageType: 'LtiDeepLinkingRequest',
    acceptTypes: 'ltiResourceLink',
    purpose: 'Lets instructors drop portfolio links into course pages or modules.',
  },
  {
    name: 'Course Navigation',
    critical: false,
    brightspaceName: 'course_navigation',
    messageType: 'LtiResourceLinkRequest',
    acceptTypes: '—',
    purpose: 'Adds "Growth Portfolio" to the course navigation bar.',
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
}: {
  number: number
  title: string
  time: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-4 pb-2 border-b-2 border-green-700">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-700 text-white font-bold text-sm shrink-0">
          {number}
        </div>
        <h2 className="text-xl font-bold text-green-900 flex-1">{title}</h2>
        <span className="text-xs text-gray-500 font-medium">{time}</span>
      </div>
      <div className="pl-11">{children}</div>
    </section>
  )
}

export default function LtiRegisterPage() {
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
          This page walks you through registering the Growth Portfolio as an
          LTI 1.3 tool in Brightspace. Work through each step, clicking{' '}
          <span className="font-semibold">Copy</span> to grab each value and
          paste it into the corresponding Brightspace admin field.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
          <div>
            <span className="font-semibold">Time:</span> ~30 minutes
          </div>
          <div>
            <span className="font-semibold">Prereq:</span> Brightspace 20.24.3+
            (for Asset Processor)
          </div>
          <div>
            <span className="font-semibold">Ends with:</span> you emailing us 4 values
          </div>
        </div>
      </div>

      {/* ─── Step 1 ──────────────────────────────── */}
      <Step number={1} title="Open the Brightspace registration form" time="1 min">
        <p className="text-sm mb-3">
          In Brightspace, navigate to{' '}
          <strong>
            Admin Tools → Manage Extensibility → LTI Advantage → Register Tool
          </strong>
          . If your version of Brightspace uses different navigation, look for
          &ldquo;External Learning Tools&rdquo; or &ldquo;LTI Advantage Tools.&rdquo;
        </p>
        <p className="text-sm text-gray-600">
          You&rsquo;ll see a form with fields for name, URLs, scopes, and
          placements. Work through Steps 2–4 below to fill it in.
        </p>
      </Step>

      {/* ─── Step 2 ──────────────────────────────── */}
      <Step number={2} title="Tool information" time="3 min">
        <CopyField label="Tool Name" value={FIELDS.name} />
        <CopyField label="Description" value={FIELDS.description} />
        <CopyField label="Vendor / Provider Name" value={FIELDS.vendorName} />
        <CopyField label="Contact Email" value={FIELDS.vendorContact} />
        <CopyField label="Domain" value={FIELDS.domain} />
        <CopyField label="Icon URL" value={FIELDS.iconUrl} />
        <CopyField label="Privacy Policy URL" value={FIELDS.privacyUrl} />
        <CopyField label="Terms of Service URL" value={FIELDS.termsUrl} />
      </Step>

      {/* ─── Step 3 ──────────────────────────────── */}
      <Step number={3} title="LTI 1.3 endpoints" time="2 min">
        <p className="text-sm mb-4 text-gray-600">
          Each field below includes both the Canvas-style label and the
          IMS-standard label, since Brightspace versions use different names.
          Copy the value into whichever label matches your form.
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

      {/* ─── Step 4 ──────────────────────────────── */}
      <Step number={4} title="Enable all five scopes" time="2 min">
        <p className="text-sm mb-4 text-gray-600">
          These are all standard IMS Global scopes — no Brightspace-proprietary
          scopes are needed. Your registration form will either have checkboxes
          for each scope, or a text field where you paste all five as a
          space-separated list.
        </p>
        {SCOPES.map(scope => (
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
        <details className="mt-4">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-green-700">
            Show all five as a single space-separated string
          </summary>
          <div className="mt-2">
            <CopyField
              label="All scopes (space-separated)"
              value={SCOPES.map(s => s.url).join(' ')}
            />
          </div>
        </details>
      </Step>

      {/* ─── Step 5 ──────────────────────────────── */}
      <Step number={5} title="Add three placements" time="5 min">
        <p className="text-sm mb-4 text-gray-600">
          In Brightspace, each placement is configured separately. Add all
          three. Labels may differ slightly in your version — the Brightspace
          internal name is listed below each.
        </p>
        {PLACEMENTS.map((p, i) => (
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
                <span className="font-semibold text-gray-700">
                  Internal name:
                </span>{' '}
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

      {/* ─── Step 6 ──────────────────────────────── */}
      <Step number={6} title="Create a deployment" time="2 min">
        <p className="text-sm mb-3">
          After registering the tool, Brightspace will ask you to create a{' '}
          <strong>deployment</strong> — this is separate from registration. For
          the pilot, scope the deployment to the LE3 org unit (or whichever org
          unit contains the pilot course) to limit access while we test.
        </p>
        <p className="text-sm text-gray-700">
          Brightspace will generate two values you&rsquo;ll need to send us in
          Step 8:
        </p>
        <ul className="text-sm mt-2 ml-5 list-disc space-y-1 text-gray-700">
          <li>
            <strong>Client ID</strong> — a UUID
          </li>
          <li>
            <strong>Deployment ID</strong> — a string
          </li>
        </ul>
      </Step>

      {/* ─── Step 7 ──────────────────────────────── */}
      <Step number={7} title="Quick verification test" time="5 min">
        <p className="text-sm mb-3 font-semibold text-gray-800">Test SSO:</p>
        <ol className="text-sm list-decimal ml-5 space-y-1 mb-4 text-gray-700">
          <li>
            In a test course, add &ldquo;Growth Portfolio&rdquo; to the course
            navigation (Course Tools → Navigation &amp; Themes)
          </li>
          <li>Click it. You should land in the portfolio, authenticated as yourself.</li>
          <li>
            If you see the portfolio homepage with your name,{' '}
            <strong>SSO is working</strong>.
          </li>
        </ol>
        <p className="text-sm mb-3 font-semibold text-gray-800">
          Test Asset Processor:
        </p>
        <ol className="text-sm list-decimal ml-5 space-y-1 text-gray-700">
          <li>Create a new assignment dropbox in the test course</li>
          <li>
            Edit it → Attachments / External Tools → add{' '}
            <strong>Growth Portfolio</strong>
          </li>
          <li>
            On the deep-linking page, click{' '}
            <strong>Attach to Assignment</strong>
          </li>
          <li>As a test student, submit a PDF or DOCX to the dropbox</li>
          <li>
            Within ~30 seconds we should receive the submission — let us know
            and we&rsquo;ll confirm on our side.
          </li>
        </ol>
      </Step>

      {/* ─── Step 8 ──────────────────────────────── */}
      <Step number={8} title="Send us four values" time="2 min">
        <p className="text-sm mb-4 text-gray-600">
          Email the following to the LE3 Growth Portfolio team. Until you send
          these four values, the integration cannot go live.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2 text-sm mb-4">
          <div>
            <input type="checkbox" className="mr-2" /> <strong>Client ID</strong>{' '}
            (from Step 6)
          </div>
          <div>
            <input type="checkbox" className="mr-2" />{' '}
            <strong>Deployment ID</strong> (from Step 6)
          </div>
          <div>
            <input type="checkbox" className="mr-2" />{' '}
            <strong>Brightspace issuer URL</strong> (e.g.,{' '}
            <code className="text-xs">https://nlu.brightspace.com</code>)
          </div>
          <div>
            <input type="checkbox" className="mr-2" />{' '}
            <strong>Brightspace release version</strong> (so we can confirm
            compatibility)
          </div>
        </div>
        <a
          href={`mailto:${FIELDS.vendorContact}?subject=LE3%20Growth%20Portfolio%20%E2%80%94%20Brightspace%20Registration%20Complete&body=Hi%20%E2%80%94%20NLU%20IT%20has%20completed%20LTI%201.3%20registration.%20Here%20are%20the%20four%20values%20you%20need%3A%0A%0AClient%20ID%3A%20%0ADeployment%20ID%3A%20%0ABrightspace%20issuer%20URL%3A%20%0ABrightspace%20release%20version%3A%20%0A`}
          className="inline-block px-5 py-3 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 transition-colors"
        >
          Email Us the Four Values →
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
              <td className="px-3 py-2 align-top">&ldquo;Asset Processor&rdquo; placement isn&rsquo;t available</td>
              <td className="px-3 py-2 align-top text-gray-600">Brightspace version &lt; 20.24.3, or feature flag disabled at org level</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-3 py-2 align-top">SSO launch returns an error</td>
              <td className="px-3 py-2 align-top text-gray-600">Scopes not granted, or redirect URL mismatch</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-3 py-2 align-top">Submission not received after student upload</td>
              <td className="px-3 py-2 align-top text-gray-600">Tool not attached to the specific dropbox (attachment is per-assignment)</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-3 py-2 align-top">Deep linking returns an error</td>
              <td className="px-3 py-2 align-top text-gray-600">Deployment not scoped to include the course</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-3">
          Send us the error message or a screenshot and we&rsquo;ll diagnose.
        </p>
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
        <p>
          LE3 Growth Portfolio · National Louis University · April 2026
        </p>
      </div>
    </main>
  )
}
