'use client'

import { useState, useEffect } from 'react'

interface SkillDescription {
  skillId: string
  skillName: string
  resumeLanguage: string
  talkingPoints: string[]
}

export default function CareerPage() {
  const [resumeSummary, setResumeSummary] = useState<string | null>(null)
  const [skillDescriptions, setSkillDescriptions] = useState<SkillDescription[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/career/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to generate')
        setLoading(false)
        return
      }

      setResumeSummary(data.resumeSummary)
      setSkillDescriptions(data.skillDescriptions || [])
      setLoading(false)
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  // Auto-load most recent career output
  useEffect(() => {
    // Could fetch existing career output here
    // For now, user clicks generate
  }, [])

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-green-900 mb-1">Career & Resume</h1>
      <p className="text-sm text-gray-500 mb-6">
        Professional language synthesized from your growth narratives.
      </p>

      {!resumeSummary && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">
            Generate resume-ready language from your skill narratives.
          </p>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-3 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            Generate Career Output
          </button>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="animate-pulse text-green-700 text-lg mb-2">Synthesizing your narratives...</div>
          <p className="text-sm text-gray-500">This may take a moment.</p>
        </div>
      )}

      {resumeSummary && (
        <div className="space-y-8">
          {/* Professional Summary */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Professional Summary
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-700 leading-relaxed">{resumeSummary}</p>
              <button
                onClick={() => navigator.clipboard?.writeText(resumeSummary)}
                className="mt-3 text-xs text-green-700 hover:underline"
              >
                Copy to clipboard
              </button>
            </div>
          </section>

          {/* Per-skill descriptions */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Skill Descriptions
            </h2>
            <div className="space-y-4">
              {skillDescriptions.map(sd => (
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
              onClick={handleGenerate}
              disabled={loading}
              className="text-sm text-green-700 hover:underline disabled:opacity-50"
            >
              Regenerate with latest narratives
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
