'use client'

import { useState } from 'react'

/**
 * Coach-only panel for observing LTI 1.3 integration state. Separate
 * from the Valence Sync Inspector because the two systems are driven by
 * different moving parts (scheduled sync vs. real-time browser launch)
 * and lumping them together makes the UI hard to read.
 *
 * Designed for end-to-end testing when NLU IT (Matt) registers our tool
 * in Brightspace and does a test launch. Shows:
 *   - The URLs Matt needs (for copy-pasting into Brightspace admin)
 *   - Which env vars are populated on our side (presence only, not
 *     values — values contain secrets or platform-specific IDs we
 *     don't want leaked to a browser console)
 *   - Recent launch attempts with pass/fail status + error_stage so
 *     failures are diagnosed inline rather than requiring log digging
 *   - Deep-linked LTI resources + LTI-provisioned students
 *
 * Fetched on demand (click "Load") to keep the dashboard render fast
 * when the coach isn't actively testing LTI.
 */

interface LtiInspectResponse {
  tool: {
    url: string
    endpoints: {
      login: string
      launch: string
      jwks: string
      config: string
      register_guide: string
    }
  }
  env: {
    allRequiredPresent: boolean
    presence: Record<string, boolean>
    values: Record<string, string | null>
  }
  launches: Array<{
    id: string
    launched_at: string
    status: string
    message_type: string | null
    platform_issuer: string | null
    resource_link_id: string | null
    resource_link_title: string | null
    context_id: string | null
    context_title: string | null
    user_sub: string | null
    user_email: string | null
    user_name: string | null
    student_id: string | null
    error_stage: string | null
    error_message: string | null
    duration_ms: number | null
  }>
  launchCounts: {
    total: number
    success: number
    jwt_error: number
    provision_error: number
    other_error: number
  }
  resources: Array<{
    id: string
    platform_issuer: string
    resource_link_id: string
    deployment_id: string
    context_id: string
    context_title: string | null
    assignment_title: string | null
    line_item_id: string | null
    created_at: string
  }>
  ltiStudents: Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    nlu_id: string
    d2l_user_id: string | null
    cohort: string | null
    status: string
    created_at: string
  }>
}

type Tab = 'setup' | 'launches' | 'resources' | 'students'

export function LTIInspectorPanel() {
  const [data, setData] = useState<LtiInspectResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('setup')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/lti-inspect', { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      setData((await res.json()) as LtiInspectResponse)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6 p-4 rounded-xl bg-white border border-gray-200">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
            LTI Inspector
          </h3>
          <p className="text-xs text-gray-500">
            Launch URLs, env var setup, recent LTI launches (success or
            failure), and LTI-provisioned students. Use while NLU IT tests
            the Brightspace-side registration.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Loading…' : data ? 'Refresh' : 'Load'}
        </button>
      </div>

      {error && (
        <div className="mt-2 p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Launch counts strip */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
            <Count label="Launches" value={data.launchCounts.total} />
            <Count
              label="Success"
              value={data.launchCounts.success}
              highlight={data.launchCounts.success > 0 ? 'good' : undefined}
            />
            <Count
              label="JWT Err"
              value={data.launchCounts.jwt_error}
              highlight={data.launchCounts.jwt_error > 0 ? 'bad' : undefined}
            />
            <Count
              label="Provision Err"
              value={data.launchCounts.provision_error}
              highlight={
                data.launchCounts.provision_error > 0 ? 'bad' : undefined
              }
            />
            <Count label="Resources" value={data.resources.length} />
            <Count label="LTI Students" value={data.ltiStudents.length} />
          </div>

          <div className="flex gap-1 border-b border-gray-200 mb-3 text-xs">
            <TabBtn label="Setup" active={tab === 'setup'} onClick={() => setTab('setup')} />
            <TabBtn label="Launches" active={tab === 'launches'} onClick={() => setTab('launches')} />
            <TabBtn label="Resources" active={tab === 'resources'} onClick={() => setTab('resources')} />
            <TabBtn label="Students" active={tab === 'students'} onClick={() => setTab('students')} />
          </div>

          <div className="text-xs">
            {tab === 'setup' && <SetupTab data={data} />}
            {tab === 'launches' && <LaunchesTab data={data} />}
            {tab === 'resources' && <ResourcesTab data={data} />}
            {tab === 'students' && <LtiStudentsTab data={data} />}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tabs ──────────────────────────────────────────

function SetupTab({ data }: { data: LtiInspectResponse }) {
  return (
    <div className="space-y-4">
      <section>
        <h4 className="font-semibold text-gray-900 mb-1">
          Tool URLs (give these to NLU IT)
        </h4>
        <UrlRow label="OIDC Login / Initiate Login URI" url={data.tool.endpoints.login} />
        <UrlRow label="Target Link URI / Redirect URL" url={data.tool.endpoints.launch} />
        <UrlRow label="Keyset URL / JWKS URI" url={data.tool.endpoints.jwks} />
        <UrlRow label="Tool Config JSON" url={data.tool.endpoints.config} />
        <UrlRow label="Human-Readable Registration Guide" url={data.tool.endpoints.register_guide} />
      </section>

      <section>
        <h4 className="font-semibold text-gray-900 mb-1">Environment variables on our side</h4>
        <p className={
          data.env.allRequiredPresent
            ? 'text-green-700 mb-2'
            : 'text-amber-700 mb-2'
        }>
          {data.env.allRequiredPresent
            ? 'All required LTI env vars are set. Ready to accept launches.'
            : 'Some required LTI env vars are missing — launches will fail until all are set on Vercel.'}
        </p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-gray-600">
              <Th>Variable</Th>
              <Th>Set?</Th>
              <Th>Current Value (non-secret)</Th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.env.presence).map(([name, present]) => (
              <tr key={name} className="border-t border-gray-100">
                <Td className="font-mono">{name}</Td>
                <Td>
                  {present ? (
                    <span className="text-green-700 font-semibold">✓ set</span>
                  ) : (
                    <span className="text-red-700 font-semibold">✗ missing</span>
                  )}
                </Td>
                <Td className="font-mono text-gray-600">
                  {renderEnvValue(name, data.env.values)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function renderEnvValue(name: string, values: Record<string, string | null>): string {
  // For secret-ish values, we only exposed the suffix.
  if (name === 'LTI_PLATFORM_CLIENT_ID') return values.LTI_PLATFORM_CLIENT_ID_suffix ?? '—'
  if (name === 'LTI_DEPLOYMENT_ID') return values.LTI_DEPLOYMENT_ID_suffix ?? '—'
  if (name === 'LTI_PRIVATE_KEY') return '(hidden)'
  if (name === 'LTI_PUBLIC_KEY') return '(set, hidden)'
  return values[name] ?? '—'
}

function LaunchesTab({ data }: { data: LtiInspectResponse }) {
  if (data.launches.length === 0) {
    return (
      <div className="italic text-gray-500 py-2">
        No LTI launch attempts yet. Once Matt registers the tool in
        Brightspace and someone clicks a Growth Portfolio link, the
        attempt will appear here — successful or not.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-gray-600">
            <Th>When</Th>
            <Th>Status</Th>
            <Th>User</Th>
            <Th>Context</Th>
            <Th>Stage / Error</Th>
          </tr>
        </thead>
        <tbody>
          {data.launches.map(l => (
            <tr key={l.id} className="border-t border-gray-100 align-top">
              <Td className="font-mono text-gray-500 whitespace-nowrap">
                {new Date(l.launched_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
                {l.duration_ms != null && (
                  <div className="text-[10px]">({l.duration_ms}ms)</div>
                )}
              </Td>
              <Td>
                <span className={statusClass(l.status)}>{l.status}</span>
                {l.message_type && (
                  <div className="text-gray-500 text-[10px]">{l.message_type}</div>
                )}
              </Td>
              <Td>
                {l.user_name || l.user_email || l.user_sub || '—'}
                {l.user_email && l.user_email !== l.user_name && (
                  <div className="text-gray-500 text-[10px] font-mono">{l.user_email}</div>
                )}
              </Td>
              <Td>
                {l.context_title || l.context_id || '—'}
                {l.resource_link_title && (
                  <div className="text-gray-500 text-[10px]">{l.resource_link_title}</div>
                )}
              </Td>
              <Td className="max-w-xs">
                {l.status === 'success' ? (
                  <span className="text-green-700">OK</span>
                ) : (
                  <>
                    <div className="text-red-700 font-semibold">{l.error_stage || 'other'}</div>
                    {l.error_message && (
                      <div className="text-gray-700 text-[10px] break-words">
                        {l.error_message.slice(0, 200)}
                      </div>
                    )}
                  </>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function statusClass(status: string): string {
  switch (status) {
    case 'success':
      return 'text-green-700 font-semibold'
    case 'jwt_error':
    case 'provision_error':
    case 'other_error':
    case 'config_error':
      return 'text-red-700 font-semibold'
    default:
      return 'text-amber-700 font-semibold'
  }
}

function ResourcesTab({ data }: { data: LtiInspectResponse }) {
  if (data.resources.length === 0) {
    return (
      <div className="italic text-gray-500 py-2">
        No deep-linked LTI resources yet. These appear when an instructor
        uses the LTI deep linking flow to embed a specific Growth Portfolio
        link into a course.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-gray-600">
            <Th>Assignment</Th>
            <Th>Context</Th>
            <Th>Resource Link</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {data.resources.map(r => (
            <tr key={r.id} className="border-t border-gray-100">
              <Td>{r.assignment_title ?? '—'}</Td>
              <Td>{r.context_title ?? r.context_id}</Td>
              <Td className="font-mono text-[10px]">{r.resource_link_id}</Td>
              <Td className="text-gray-500 text-[10px]">
                {new Date(r.created_at).toLocaleString()}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LtiStudentsTab({ data }: { data: LtiInspectResponse }) {
  if (data.ltiStudents.length === 0) {
    return (
      <div className="italic text-gray-500 py-2">
        No LTI-provisioned students yet. Students whose nlu_id starts with
        &ldquo;lti:&rdquo; appear here after they launch the tool through a
        Brightspace SSO link.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-gray-600">
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>nlu_id (LTI sub)</Th>
            <Th>d2l_user_id (Valence)</Th>
            <Th>Provisioned</Th>
          </tr>
        </thead>
        <tbody>
          {data.ltiStudents.map(s => (
            <tr key={s.id} className="border-t border-gray-100">
              <Td>
                {s.first_name} {s.last_name}
              </Td>
              <Td className="font-mono">{s.email}</Td>
              <Td className="font-mono text-[10px]">{s.nlu_id}</Td>
              <Td className="font-mono text-[10px]">{s.d2l_user_id ?? '—'}</Td>
              <Td className="text-gray-500 text-[10px]">
                {new Date(s.created_at).toLocaleString()}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Primitives ─────────────────────────────────

function UrlRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false)
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* no-op */
    }
  }
  return (
    <div className="mb-1.5">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
        {label}
      </div>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded font-mono text-[11px] text-gray-800 break-all">
          {url}
        </code>
        <button
          type="button"
          onClick={handle}
          className="shrink-0 px-2 py-1 text-[10px] font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          {copied ? '✓' : 'copy'}
        </button>
      </div>
    </div>
  )
}

function Count({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: 'good' | 'bad'
}) {
  const color =
    highlight === 'good'
      ? 'text-green-700'
      : highlight === 'bad'
      ? 'text-red-700'
      : 'text-gray-900'
  return (
    <div className="p-2 rounded bg-gray-50 border border-gray-100 text-center">
      <div className={`text-base font-semibold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  )
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 -mb-px border-b-2 ${
        active
          ? 'border-green-700 text-green-900 font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-1 pr-3 font-semibold text-[11px]">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-1 pr-3 text-[11px] ${className}`}>{children}</td>
}
