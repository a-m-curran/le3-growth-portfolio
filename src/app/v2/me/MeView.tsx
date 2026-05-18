'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { DataHandlingNotice } from '@/components/student/DataHandlingNotice'
import { RoleSwitcher } from '@/components/v2/RoleSwitcher'

interface MeViewProps {
  kind: 'student' | 'coach'
  name: string
  email: string
  meta: string
  /** True iff this auth_user_id owns both a coach and a student row */
  dualRole?: boolean
}

interface ConsentStatus {
  acknowledged: boolean
  acknowledgedAt: string | null
}

export function MeView({ kind, name, email, meta, dualRole = false }: MeViewProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
      {/* Identity */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-xl font-semibold">
            {initials(name)}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{name}</h1>
            <p className="text-sm text-gray-500 truncate">{email}</p>
            <p className="text-xs text-gray-400 mt-0.5">{meta}</p>
          </div>
        </div>
      </Card>

      {/* Preferences — student-only (the data-handling notice is about
          student data ingestion; nothing else lives here for now). */}
      {kind === 'student' && (
        <Card>
          <SectionHeader title="Preferences" />
          <DataHandlingPref />
        </Card>
      )}

      {/* Account */}
      <Card>
        <SectionHeader title="Account" />
        {dualRole && (
          <div className="mb-2">
            <RoleSwitcher role={kind} />
          </div>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-700 hover:bg-red-50 transition-colors"
        >
          Sign out
        </button>
      </Card>

      <p className="text-[11px] text-gray-400 text-center">
        Questions about your data?{' '}
        {kind === 'student' ? 'Reach out to your LE3 coach.' : 'Contact NLU IT support.'}
      </p>
    </div>
  )
}

/**
 * Working "Data handling" control: shows acknowledgement state from
 * GET /api/student/acknowledge-consent and opens the shared notice in
 * a review modal (viewable anytime). If not yet acknowledged, the
 * modal offers the acknowledge action (idempotent POST).
 */
function DataHandlingPref() {
  const [status, setStatus] = useState<ConsentStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/acknowledge-consent', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: ConsentStatus) => {
        if (!cancelled) setStatus(j)
      })
      .catch(() => {
        if (!cancelled) setStatus({ acknowledged: false, acknowledgedAt: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const stateLabel = !status
    ? 'Loading…'
    : status.acknowledged && status.acknowledgedAt
    ? `Acknowledged ${new Date(status.acknowledgedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : status.acknowledged
    ? 'Acknowledged'
    : 'Not yet acknowledged'

  const handleAcknowledge = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/student/acknowledge-consent', { method: 'POST' })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const j = (await res.json()) as { acknowledgedAt: string }
      setStatus({ acknowledged: true, acknowledgedAt: j.acknowledgedAt })
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between py-2">
        <div className="min-w-0">
          <p className="text-sm text-gray-700">Data handling</p>
          <p className="text-xs text-gray-400 mt-0.5">{stateLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-green-800 hover:text-green-900 hover:underline shrink-0"
        >
          View notice
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-bold text-green-900">Data handling</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-700 text-sm"
              >
                Close
              </button>
            </div>

            <DataHandlingNotice />

            {error && (
              <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800">
                Couldn&rsquo;t record acknowledgement: {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              {status && !status.acknowledged && (
                <button
                  type="button"
                  onClick={handleAcknowledge}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Saving…' : 'I understand'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">{children}</div>
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() || '')
    .join('')
}
