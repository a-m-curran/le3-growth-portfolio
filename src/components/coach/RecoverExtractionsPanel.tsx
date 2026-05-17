'use client'

import { useState } from 'react'

/**
 * Admin panel: trigger the one-time empty-extraction recovery.
 * Dry-run is the default and the recommended first action — it reports
 * how many empty rows would be recovered (by ground-truth file type)
 * without writing. Self-contained: button → POST → enqueue readout.
 * The run summary (scanned / recovered / still-empty by reason) lives
 * in the Trigger.dev dashboard, not here — the panel only confirms the
 * enqueue.
 */
interface EnqueueResponse {
  status?: string
  dryRun?: boolean
  triggerRunId?: string
  message?: string
  error?: string
}

export function RecoverExtractionsPanel() {
  const [dryRun, setDryRun] = useState(true)
  const [busy, setBusy] = useState(false)
  const [resp, setResp] = useState<EnqueueResponse | null>(null)

  async function run(): Promise<void> {
    setBusy(true)
    setResp(null)
    try {
      const r = await fetch('/api/admin/recover-extractions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      })
      setResp((await r.json()) as EnqueueResponse)
    } catch (e) {
      setResp({ error: String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">
        Recover empty extractions
      </h2>
      <p className="text-sm text-gray-600 mt-1">
        One-time repair of synced work rows the old PDF extractor left
        empty. Re-fetches each file from D2L and re-extracts in place.
        Dry-run reports what would be recovered without writing.
      </p>

      <label className="flex items-center gap-2 mt-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={dryRun}
          onChange={e => setDryRun(e.target.checked)}
        />
        Dry run (no writes) — recommended first
      </label>

      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="mt-3 px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-medium disabled:opacity-50"
      >
        {busy ? 'Enqueuing…' : dryRun ? 'Run dry-run' : 'Run recovery (writes)'}
      </button>

      {resp && (
        <div className="mt-4 text-sm">
          {resp.error ? (
            <p className="text-red-700">{resp.error}</p>
          ) : (
            <div className="space-y-1 text-gray-700">
              <p className="text-green-800 font-medium">{resp.message}</p>
              {resp.triggerRunId && (
                <p className="text-xs text-gray-500">
                  Trigger run: {resp.triggerRunId} — watch the Trigger.dev
                  dashboard for the summary (scanned / recovered / still-empty
                  by reason).
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
