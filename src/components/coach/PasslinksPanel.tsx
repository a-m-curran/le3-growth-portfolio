'use client'

import { useState } from 'react'
import type { RosterRow } from '@/lib/auth/passlink-admin'

/**
 * Admin panel: issue/list/rotate/revoke pilot login links. URLs are
 * never displayed in the list (hashed at rest) — they exist only in
 * the one-time CSV download and in a single rotate result.
 */
export function PasslinksPanel({ roster }: { roster: RosterRow[] }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [rotated, setRotated] = useState<{ email: string; url: string } | null>(null)

  async function issueAll(rotateAll: boolean) {
    setBusy('issue')
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/passlinks/issue${rotateAll ? '?rotateAll=1' : ''}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pilot-passlinks-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setMsg('CSV downloaded. Distribute it now — URLs are not stored and cannot be re-listed.')
    } catch (e) {
      setMsg(`Issue failed: ${String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  async function rotateOne(passlinkId: string, email: string) {
    setBusy(passlinkId)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/passlinks/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passlinkId }),
      })
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !j.url) throw new Error(j.error || `HTTP ${res.status}`)
      setRotated({ email, url: j.url })
    } catch (e) {
      setMsg(`Rotate failed: ${String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  async function revokeAll() {
    if (!confirm('Revoke ALL pilot login links? Everyone will need a re-issued link.')) return
    setBusy('revoke-all')
    setMsg(null)
    try {
      const res = await fetch('/api/admin/passlinks/revoke-all', { method: 'POST' })
      const j = (await res.json().catch(() => ({}))) as { revoked?: number; error?: string }
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setMsg(`Revoked ${j.revoked ?? 0} link(s). Reload to refresh status.`)
    } catch (e) {
      setMsg(`Revoke-all failed: ${String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Pilot passlinks</h2>
        <span className="text-xs text-gray-500">{roster.length} subjects</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => issueAll(false)}
          className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
        >
          {busy === 'issue' ? 'Issuing…' : 'Issue links for everyone (download CSV)'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => issueAll(true)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:border-gray-400 disabled:opacity-50"
        >
          Rotate ALL + re-export
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={revokeAll}
          className="px-3 py-2 bg-white border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
        >
          Revoke ALL
        </button>
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
          {msg}
        </div>
      )}
      {rotated && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-900 break-all">
          New link for <strong>{rotated.email}</strong> (shown once — copy it now):<br />
          {rotated.url}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Last used</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {roster.map(r => (
              <tr key={`${r.role}:${r.email}`} className="border-b border-gray-100">
                <td className="py-2 pr-3 text-gray-900">{r.name}</td>
                <td className="py-2 pr-3 text-gray-600">{r.email}</td>
                <td className="py-2 pr-3 text-gray-600">{r.role}</td>
                <td className="py-2 pr-3">
                  <span
                    className={
                      r.status === 'active'
                        ? 'text-green-700'
                        : r.status === 'revoked'
                          ? 'text-red-700'
                          : 'text-gray-400'
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-500">
                  {r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleDateString() : '—'}
                </td>
                <td className="py-2">
                  {r.passlinkId && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => rotateOne(r.passlinkId as string, r.email)}
                      className="text-xs text-green-700 hover:text-green-900 hover:underline disabled:opacity-50"
                    >
                      Rotate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
