'use client'

import { useState } from 'react'

interface Props {
  skillId: string
  skillName: string
  pillarName: string
  narrativeText?: string
  narrativeRichness?: string
  version?: number
  generatedAt?: string
  conversationCount?: number
}

export function NarrativeCard({
  skillId,
  skillName,
  pillarName,
  narrativeText,
  narrativeRichness,
  version,
  generatedAt,
}: Props) {
  const [text, setText] = useState(narrativeText || '')
  const [richness, setRichness] = useState(narrativeRichness || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentVersion, setCurrentVersion] = useState(version || 0)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/narrative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to generate')
        setLoading(false)
        return
      }

      setText(data.narrativeText)
      setRichness(data.richness)
      setCurrentVersion(data.version)
      setLoading(false)
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  const richnessColor = {
    thin: 'bg-gray-100 text-gray-600',
    developing: 'bg-amber-100 text-amber-700',
    rich: 'bg-green-100 text-green-700',
  }[richness] || 'bg-gray-100 text-gray-600'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{skillName}</h3>
          <p className="text-xs text-gray-500">{pillarName}</p>
        </div>
        <div className="flex items-center gap-2">
          {richness && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${richnessColor}`}>
              {richness}
            </span>
          )}
          {currentVersion > 0 && (
            <span className="text-[10px] text-gray-400">v{currentVersion}</span>
          )}
        </div>
      </div>

      {text ? (
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-4">
          {text}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic mb-4">
          No narrative generated yet. Click below to create one.
        </p>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="text-sm px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50"
        >
          {loading ? 'Generating...' : text ? 'Regenerate' : 'Generate Narrative'}
        </button>
        {generatedAt && (
          <span className="text-xs text-gray-400">
            {new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  )
}
