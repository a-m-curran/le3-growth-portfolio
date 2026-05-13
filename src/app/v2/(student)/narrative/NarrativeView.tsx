'use client'

import { useEffect, useState } from 'react'
import { getPillarPalette } from '@/lib/constants'

/**
 * Client view for /v2/narrative.
 *
 * Fetches the per-skill narrative list and renders it grouped by
 * pillar, mirroring the Growth view's pillar-sectioned layout. Each
 * narrative card carries a left-edge stripe in its pillar's
 * surface-border tone, matching the rest of the v2 IA's color system.
 *
 * Cards without a generated narrative show a quiet "Generate"
 * affordance — in demo mode this just reveals the static seed text
 * after a brief pause; in real mode it posts to /api/narrative/generate.
 */

interface Narrative {
  skillId: string
  skillName: string
  pillarId: string
  pillarName: string | null
  narrativeText: string | null
  narrativeRichness: string | null
  version: number
  generatedAt: string | null
}

interface NarrativeResponse {
  narratives: Narrative[]
}

export function NarrativeView() {
  const [data, setData] = useState<NarrativeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/narrative', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as NarrativeResponse
      })
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
        Couldn&rsquo;t load narratives: {error}
      </div>
    )
  }
  if (data === null) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        ))}
      </div>
    )
  }

  // Group by pillar, preserving the order the API returned skills in
  const pillarGroups = new Map<string, { pillarName: string; items: Narrative[] }>()
  for (const n of data.narratives) {
    const key = n.pillarId
    if (!pillarGroups.has(key)) {
      pillarGroups.set(key, { pillarName: n.pillarName ?? '', items: [] })
    }
    pillarGroups.get(key)!.items.push(n)
  }

  return (
    <div className="space-y-8">
      {Array.from(pillarGroups.values()).map(group => {
        const p = getPillarPalette(group.pillarName)
        return (
          <section key={group.pillarName}>
            <h2
              className="text-xs uppercase tracking-wider font-semibold mb-3"
              style={{ color: p.surfaceText }}
            >
              {group.pillarName}
            </h2>
            <div className="space-y-3">
              {group.items.map(n => (
                <NarrativeCard key={n.skillId} item={n} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function NarrativeCard({ item }: { item: Narrative }) {
  const [text, setText] = useState(item.narrativeText)
  const [richness, setRichness] = useState(item.narrativeRichness)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const palette = getPillarPalette(item.pillarName)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      // Real-mode flow posts to /api/narrative/generate; in demo
      // mode the seed already has the text, so this path is rarely
      // hit. Kept for parity so the button works in both modes.
      const res = await fetch('/api/narrative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: item.skillId }),
      })
      const j = await res.json()
      if (!res.ok) {
        setError(j.error || 'Failed to generate')
        setLoading(false)
        return
      }
      setText(j.narrativeText)
      setRichness(j.richness)
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const richnessTone =
    richness === 'rich'
      ? { bg: '#dcfce7', text: '#166534', label: 'rich' }
      : richness === 'developing'
      ? { bg: '#fef3c7', text: '#92400e', label: 'developing' }
      : richness === 'thin'
      ? { bg: '#f1f5f9', text: '#475569', label: 'thin' }
      : null

  return (
    <article
      className="bg-white rounded-xl p-5 transition-shadow hover:shadow-sm"
      style={{
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderLeftColor: palette.surfaceBorder,
        borderTopWidth: 1,
        borderTopStyle: 'solid',
        borderTopColor: '#e5e7eb',
        borderRightWidth: 1,
        borderRightStyle: 'solid',
        borderRightColor: '#e5e7eb',
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: '#e5e7eb',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{item.skillName}</h3>
        <div className="flex items-center gap-2 shrink-0">
          {richnessTone && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider"
              style={{ backgroundColor: richnessTone.bg, color: richnessTone.text }}
            >
              {richnessTone.label}
            </span>
          )}
          {item.version > 0 && (
            <span className="text-[10px] text-gray-400">v{item.version}</span>
          )}
        </div>
      </div>

      {text ? (
        <>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {text}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
              style={{
                backgroundColor: palette.surface,
                color: palette.surfaceText,
                border: `1px solid ${palette.surfaceBorder}88`,
              }}
              title="Regenerate this narrative from the latest conversations"
            >
              {loading ? 'Regenerating…' : 'Regenerate'}
            </button>
            {item.generatedAt && (
              <p className="text-[11px] text-gray-400">
                Generated {new Date(item.generatedAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </p>
            )}
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </>
      ) : loading ? (
        <div className="py-6 text-center">
          <div className="animate-pulse text-sm" style={{ color: palette.surfaceText }}>
            Generating narrative…
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Analyzing conversations and building your growth story
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400 italic mb-3">
            No narrative generated yet for this skill.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              backgroundColor: palette.surface,
              color: palette.surfaceText,
              border: `1px solid ${palette.surfaceBorder}`,
            }}
          >
            Generate Narrative
          </button>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </>
      )}
    </article>
  )
}
