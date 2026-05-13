'use client'

import { useEffect, useState } from 'react'
import { getPillarPalette } from '@/lib/constants'

/**
 * Client view for /v2/career.
 *
 * Renders the latest career_output for the current student:
 *   - Hero card: Professional Summary, with a copy-to-clipboard
 *   - Per-skill cards: resume language + interview talking points,
 *     each tinted by its pillar
 *
 * When no output exists yet, shows a CTA to generate it. The
 * generation hits the existing /api/career/generate endpoint which
 * already handles both demo (synthetic delay) and real (LLM) flows.
 */

interface SkillDescription {
  skillId: string
  skillName: string
  resumeLanguage: string
  talkingPoints: string[]
  pillarName: string | null
}

interface CareerOutput {
  resumeSummary: string
  skillDescriptions: SkillDescription[]
  version: number
  generatedAt: string | null
}

interface CareerResponse {
  output: CareerOutput | null
}

export function CareerView() {
  const [output, setOutput] = useState<CareerOutput | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/career', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || `HTTP ${r.status}`)
        }
        return (await r.json()) as CareerResponse
      })
      .then(j => {
        if (!cancelled) {
          setOutput(j.output)
          setLoading(false)
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(String(e))
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/career/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const j = await res.json()
      if (!res.ok) {
        setError(j.error || 'Failed to generate')
        setGenerating(false)
        return
      }
      // Refetch to pick up the freshly stored output (with pillar
      // enrichment from our API wrapper) rather than trying to
      // reshape /api/career/generate's payload here.
      const refreshed = await fetch('/api/student/career', { cache: 'no-store' })
      const refreshedJson = (await refreshed.json()) as CareerResponse
      setOutput(refreshedJson.output)
    } catch {
      setError('Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!output) return
    navigator.clipboard?.writeText(output.resumeSummary).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (error && !output) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
        Couldn&rsquo;t load career output: {error}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        <div className="h-40 rounded-2xl bg-white border border-gray-200 animate-pulse" />
      </div>
    )
  }

  // Empty state — no career output generated yet
  if (!output) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 p-10 text-center">
        <p className="text-gray-600 mb-2">
          Translate your growth into resume-ready language.
        </p>
        <p className="text-xs text-gray-400 mb-5 max-w-md mx-auto">
          We&rsquo;ll synthesize your skill narratives into a professional summary, per-skill resume bullets, and interview talking points.
        </p>
        {generating ? (
          <div className="animate-pulse text-sm text-green-700">
            Synthesizing your narratives…
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            className="px-5 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
          >
            Generate career output
          </button>
        )}
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Professional Summary */}
      <section>
        <h2 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">
          Professional Summary
        </h2>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-800 leading-relaxed">{output.resumeSummary}</p>
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              {copied ? 'Copied ✓' : 'Copy to clipboard'}
            </button>
            <span className="text-[11px] text-gray-400">v{output.version}</span>
          </div>
        </div>
      </section>

      {/* Skill Descriptions */}
      <section>
        <h2 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">
          Skill Descriptions
        </h2>
        <div className="space-y-3">
          {output.skillDescriptions.map(sd => (
            <SkillCard key={sd.skillId} sd={sd} />
          ))}
        </div>
      </section>

      {/* Regenerate */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="text-xs text-gray-500 hover:text-gray-800 underline-offset-2 hover:underline disabled:opacity-50"
        >
          {generating ? 'Regenerating…' : 'Regenerate with latest narratives'}
        </button>
      </div>
    </div>
  )
}

function SkillCard({ sd }: { sd: SkillDescription }) {
  const palette = getPillarPalette(sd.pillarName)
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
      <h3 className="font-semibold text-gray-900 mb-2">{sd.skillName}</h3>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">{sd.resumeLanguage}</p>
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-2">
        Interview talking points
      </p>
      <ul className="space-y-2">
        {sd.talkingPoints.map((tp, i) => (
          <li
            key={i}
            className="text-sm text-gray-700 leading-relaxed pl-3"
            style={{ borderLeft: `2px solid ${palette.surfaceBorder}80` }}
          >
            {tp}
          </li>
        ))}
      </ul>
    </article>
  )
}
