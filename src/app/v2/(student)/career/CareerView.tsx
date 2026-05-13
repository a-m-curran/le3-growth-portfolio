'use client'

import { useEffect, useState } from 'react'

/**
 * Client view for /v2/career.
 *
 * Intentionally a thin v1-parity port — plain neutral cards, no
 * pillar tints, no extra polish. A more comprehensive Career
 * module is on the roadmap; this page exists so the v2 IA has the
 * surface, not to be where the design lives.
 *
 * Behavior:
 *   - Fetches the latest career_output via /api/student/career
 *   - Empty state: single "Generate career output" CTA
 *   - Populated state: Professional Summary card with copy-to-clipboard,
 *     per-skill cards (resume language + interview talking points),
 *     and a Regenerate link at the bottom
 *   - Generate / Regenerate posts to the existing /api/career/generate
 *     endpoint (unchanged from v1) and refetches our wrapper
 */

interface SkillDescription {
  skillId: string
  skillName: string
  resumeLanguage: string
  talkingPoints: string[]
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
        <div className="h-32 rounded-xl bg-white border border-gray-200 animate-pulse" />
        <div className="h-40 rounded-xl bg-white border border-gray-200 animate-pulse" />
      </div>
    )
  }

  // Empty state
  if (!output) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">
          Generate resume-ready language from your skill narratives.
        </p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {generating ? (
          <div className="animate-pulse text-green-700 text-sm">
            Synthesizing your narratives…
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            className="px-6 py-3 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
          >
            Generate Career Output
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Professional Summary */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Professional Summary
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-700 leading-relaxed">{output.resumeSummary}</p>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 text-xs text-green-700 hover:underline"
          >
            {copied ? 'Copied' : 'Copy to clipboard'}
          </button>
        </div>
      </section>

      {/* Per-skill descriptions */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Skill Descriptions
        </h2>
        <div className="space-y-4">
          {output.skillDescriptions.map(sd => (
            <div key={sd.skillId} className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-2">{sd.skillName}</h3>
              <p className="text-sm text-gray-700 mb-3">{sd.resumeLanguage}</p>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Interview Talking Points:</p>
                <ul className="space-y-1.5">
                  {sd.talkingPoints.map((tp, i) => (
                    <li key={i} className="text-sm text-gray-600 pl-3 border-l-2 border-green-200">
                      {tp}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Regenerate */}
      <div className="text-center pt-4">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="text-sm text-green-700 hover:underline disabled:opacity-50"
        >
          {generating ? 'Regenerating…' : 'Regenerate with latest narratives'}
        </button>
      </div>
    </div>
  )
}
