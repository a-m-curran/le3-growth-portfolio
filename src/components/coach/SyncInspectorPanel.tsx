'use client'

import { useState } from 'react'

/**
 * Coach-only inspector that dumps the actual DB rows produced by the
 * most recent D2L sync. Intended for debugging — lets the coach see
 * without SQL access whether rows landed correctly, whether
 * student_work.content has real text (the content_len=0 failure mode),
 * and the full error_details of recent sync runs.
 *
 * Fetched on demand (click "Load") so it doesn't slow the dashboard
 * render when not needed.
 */

interface InspectResponse {
  counts: {
    courses: number
    students: number
    coaches: number
    instructors: number
    assignments: number
    work: number
    work_with_content: number
    work_empty: number
  }
  courses: Array<{
    id: string
    name: string
    code: string | null
    quarter: string | null
    active: boolean
    brightspace_org_unit_id: string | null
    synced_at: string | null
  }>
  students: Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    nlu_id: string
    d2l_user_id: string | null
    coach_id: string | null
    cohort: string | null
    status: string
    created_at: string
  }>
  coaches: Array<{
    id: string
    name: string
    email: string
    status: string
    auth_user_id: string | null
    created_at: string
  }>
  instructors: Array<{
    id: string
    name: string
    email: string
    d2l_user_id: string | null
    status: string
    created_at: string
  }>
  assignments: Array<{
    id: string
    title: string
    work_type: string | null
    brightspace_folder_id: string | null
    due_date: string | null
    active: boolean
    synced_at: string | null
  }>
  work: Array<{
    id: string
    student_id: string
    assignment_id: string | null
    title: string
    grade: string | null
    source: string | null
    brightspace_submission_id: string | null
    submitted_at: string | null
    imported_at: string | null
    content_len: number
    content_preview: string | null
  }>
  syncRuns: Array<{
    id: string
    started_at: string
    completed_at: string | null
    status: string
    source: string
    mode: string
    courses_synced: number
    students_synced: number
    assignments_synced: number
    submissions_synced: number
    submissions_skipped: number
    errors_count: number
    error_details: unknown
  }>
}

type Tab = 'overview' | 'people' | 'students' | 'assignments' | 'work' | 'runs'

export function SyncInspectorPanel() {
  const [data, setData] = useState<InspectResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [expanded, setExpanded] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearMessage, setClearMessage] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/sync-inspect', { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as InspectResponse
      setData(json)
      setExpanded(true)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const clearEmpty = async () => {
    if (
      !confirm(
        'Delete all D2L-synced student_work rows with empty content? ' +
          'Use this to unblock re-sync after a failed text extraction. ' +
          'Rows with real content will NOT be touched.'
      )
    ) {
      return
    }
    setClearing(true)
    setClearMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/admin/sync-inspect/clear-empty', {
        method: 'POST',
      })
      const j = (await res.json()) as { deleted?: number; error?: string }
      if (!res.ok) {
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      setClearMessage(
        `Deleted ${j.deleted ?? 0} empty work rows. ` +
          `Trigger a sync to re-import them with fresh text extraction.`
      )
      // Refresh inspector data so the table reflects the delete.
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="mb-6 p-4 rounded-xl bg-white border border-gray-200">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
            Sync Inspector
          </h3>
          <p className="text-xs text-gray-500">
            Direct view of the DB rows produced by the most recent sync — no
            SQL needed.
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

      {clearMessage && (
        <div className="mt-2 p-2 rounded-md bg-green-50 border border-green-200 text-xs text-green-800">
          {clearMessage}
        </div>
      )}

      {data && expanded && (
        <>
          {/* Counts strip */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
            <Count label="Courses" value={data.counts.courses} />
            <Count label="Students" value={data.counts.students} />
            <Count label="Coaches" value={data.counts.coaches} />
            <Count label="Instructors" value={data.counts.instructors} />
            <Count label="Assignments" value={data.counts.assignments} />
            <Count label="Work Rows" value={data.counts.work} />
            <Count
              label="w/ Content"
              value={data.counts.work_with_content}
              highlight={data.counts.work_with_content > 0 ? 'good' : undefined}
            />
            <Count
              label="Empty"
              value={data.counts.work_empty}
              highlight={data.counts.work_empty > 0 ? 'bad' : undefined}
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 mb-3 text-xs flex-wrap">
            <TabBtn label="Overview" active={tab === 'overview'} onClick={() => setTab('overview')} />
            <TabBtn label="People" active={tab === 'people'} onClick={() => setTab('people')} />
            <TabBtn label="Students" active={tab === 'students'} onClick={() => setTab('students')} />
            <TabBtn label="Assignments" active={tab === 'assignments'} onClick={() => setTab('assignments')} />
            <TabBtn label="Student Work" active={tab === 'work'} onClick={() => setTab('work')} />
            <TabBtn label="Runs" active={tab === 'runs'} onClick={() => setTab('runs')} />
          </div>

          <div className="text-xs">
            {tab === 'overview' && <OverviewTab data={data} />}
            {tab === 'people' && <PeopleTab data={data} />}
            {tab === 'students' && <StudentsTab data={data} />}
            {tab === 'assignments' && <AssignmentsTab data={data} />}
            {tab === 'work' && (
              <WorkTab data={data} onClearEmpty={clearEmpty} clearing={clearing} />
            )}
            {tab === 'runs' && <RunsTab data={data} />}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tabs ──────────────────────────────────────────

function OverviewTab({ data }: { data: InspectResponse }) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="font-semibold text-gray-900 mb-1">Courses ({data.courses.length})</h4>
        <ul className="space-y-0.5 text-gray-700">
          {data.courses.slice(0, 10).map(c => (
            <li key={c.id}>
              <span className="font-mono text-gray-500">ou={c.brightspace_org_unit_id ?? '-'}</span>{' '}
              <span className="font-medium">{c.name}</span>
              {c.code && <span className="text-gray-500"> ({c.code})</span>}
              {!c.active && <span className="text-amber-700"> [inactive]</span>}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold text-gray-900 mb-1">
          Content quality: {data.counts.work_with_content} of {data.counts.work} work rows have extracted text
        </h4>
        {data.counts.work_empty > 0 && (
          <p className="text-amber-700">
            {data.counts.work_empty} work rows landed with empty content — file download or text
            extraction is silently failing. Check the Student Work tab.
          </p>
        )}
      </div>
    </div>
  )
}

function PeopleTab({ data }: { data: InspectResponse }) {
  return (
    <div className="space-y-4">
      <section>
        <h4 className="font-semibold text-gray-900 mb-1">
          Coaches ({data.coaches.length})
          <span className="text-gray-500 font-normal text-[11px] ml-2">
            LE3 program-level humans. Manually managed. Real coaches need
            auth_user_id set so they can log in.
          </span>
        </h4>
        {data.coaches.length === 0 ? (
          <Empty>No coaches yet — seed at least one before sync can provision new students.</Empty>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-gray-600">
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Has Login</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.coaches.map(c => (
                <tr key={c.id} className="border-t border-gray-100">
                  <Td>{c.name}</Td>
                  <Td className="font-mono">{c.email}</Td>
                  <Td>
                    {c.auth_user_id ? (
                      <span className="text-green-700">✓</span>
                    ) : (
                      <span className="text-amber-700">no</span>
                    )}
                  </Td>
                  <Td>{c.status}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h4 className="font-semibold text-gray-900 mb-1">
          Instructors ({data.instructors.length})
          <span className="text-gray-500 font-normal text-[11px] ml-2">
            Brightspace course teachers. Auto-pulled from classlist on every sync.
          </span>
        </h4>
        {data.instructors.length === 0 ? (
          <Empty>No instructors synced yet.</Empty>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-gray-600">
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>D2L User ID</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.instructors.map(i => (
                <tr key={i.id} className="border-t border-gray-100">
                  <Td>{i.name}</Td>
                  <Td className="font-mono">{i.email}</Td>
                  <Td className="font-mono">{i.d2l_user_id ?? '—'}</Td>
                  <Td>{i.status}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function StudentsTab({ data }: { data: InspectResponse }) {
  if (data.students.length === 0) return <Empty>No students synced yet.</Empty>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-gray-600">
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>nlu_id</Th>
            <Th>d2l_user_id</Th>
            <Th>Cohort</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {data.students.map(s => (
            <tr key={s.id} className="border-t border-gray-100">
              <Td>
                {s.first_name} {s.last_name}
              </Td>
              <Td className="font-mono">{s.email}</Td>
              <Td className="font-mono">{s.nlu_id}</Td>
              <Td className="font-mono">{s.d2l_user_id ?? '—'}</Td>
              <Td>{s.cohort ?? '—'}</Td>
              <Td>{s.status}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AssignmentsTab({ data }: { data: InspectResponse }) {
  if (data.assignments.length === 0) return <Empty>No assignments synced yet.</Empty>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-gray-600">
            <Th>Title</Th>
            <Th>Type</Th>
            <Th>Folder</Th>
            <Th>Due</Th>
            <Th>Active</Th>
          </tr>
        </thead>
        <tbody>
          {data.assignments.map(a => (
            <tr key={a.id} className="border-t border-gray-100">
              <Td>{a.title}</Td>
              <Td>{a.work_type ?? '—'}</Td>
              <Td className="font-mono">{a.brightspace_folder_id ?? '—'}</Td>
              <Td>{a.due_date ? a.due_date.slice(0, 10) : '—'}</Td>
              <Td>{a.active ? 'yes' : 'no'}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WorkTab({
  data,
  onClearEmpty,
  clearing,
}: {
  data: InspectResponse
  onClearEmpty: () => void
  clearing: boolean
}) {
  if (data.work.length === 0) return <Empty>No D2L-synced student work yet.</Empty>
  const emptyCount = data.counts.work_empty
  return (
    <div>
      {emptyCount > 0 && (
        <div className="mb-2 p-2 rounded border border-amber-200 bg-amber-50 flex items-center justify-between gap-2">
          <span className="text-amber-900">
            {emptyCount} work row{emptyCount === 1 ? '' : 's'} with empty content. Delete
            them so the next sync can re-import with text extraction.
          </span>
          <button
            type="button"
            onClick={onClearEmpty}
            disabled={clearing}
            className="shrink-0 px-2.5 py-1 text-[11px] font-medium rounded bg-red-700 text-white hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearing ? 'Clearing…' : `Delete ${emptyCount} empty row${emptyCount === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-gray-600">
            <Th>Title</Th>
            <Th>Student</Th>
            <Th>Sub ID</Th>
            <Th>Grade</Th>
            <Th>Content Len</Th>
            <Th>Preview</Th>
          </tr>
        </thead>
        <tbody>
          {data.work.map(w => {
            const student = data.students.find(s => s.id === w.student_id)
            const empty = w.content_len === 0
            return (
              <tr key={w.id} className="border-t border-gray-100 align-top">
                <Td>{w.title}</Td>
                <Td>
                  {student ? `${student.first_name} ${student.last_name}` : w.student_id.slice(0, 8)}
                </Td>
                <Td className="font-mono">{w.brightspace_submission_id ?? '—'}</Td>
                <Td>{w.grade ?? '—'}</Td>
                <Td className={empty ? 'text-red-700 font-semibold' : 'text-green-700'}>
                  {w.content_len}
                </Td>
                <Td className="max-w-xs">
                  {w.content_preview ? (
                    <span className="text-gray-600">{w.content_preview}</span>
                  ) : (
                    <span className="text-red-600 italic">empty</span>
                  )}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}

function RunsTab({ data }: { data: InspectResponse }) {
  if (data.syncRuns.length === 0) return <Empty>No sync runs yet.</Empty>
  return (
    <div className="space-y-2">
      {data.syncRuns.map(r => (
        <div key={r.id} className="p-2 rounded border border-gray-200">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span
                className={
                  r.status === 'completed'
                    ? 'text-green-700 font-semibold'
                    : r.status === 'failed'
                    ? 'text-red-700 font-semibold'
                    : 'text-amber-700 font-semibold'
                }
              >
                {r.status}
              </span>{' '}
              <span className="text-gray-500">{r.source}</span>{' '}
              <span className="text-gray-500">({r.mode})</span>
            </div>
            <div className="font-mono text-gray-500 text-[10px]">
              {new Date(r.started_at).toLocaleString()}
            </div>
          </div>
          <div className="mt-1 text-gray-700">
            {r.courses_synced} courses · {r.students_synced} students ·{' '}
            {r.assignments_synced} assignments ·{' '}
            <span className={r.submissions_synced > 0 ? 'font-semibold text-green-800' : ''}>
              {r.submissions_synced} submissions
            </span>
            {r.submissions_skipped > 0 && (
              <span className="text-gray-500"> · {r.submissions_skipped} skipped</span>
            )}
            {r.errors_count > 0 && (
              <span className="text-red-700"> · {r.errors_count} errors</span>
            )}
          </div>
          {r.error_details != null && (
            <details className="mt-1">
              <summary className="cursor-pointer text-red-700 text-[11px]">
                error_details
              </summary>
              <pre className="mt-1 p-2 rounded bg-red-50 overflow-x-auto text-[10px] whitespace-pre-wrap">
                {JSON.stringify(r.error_details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Primitives ─────────────────────────────────

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

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="italic text-gray-500 py-2">{children}</div>
}
