'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface SkillOption {
  id: string
  name: string
  pillarName: string
}

export default function NewReflectionPage() {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [skillId, setSkillId] = useState('')
  const [skills, setSkills] = useState<SkillOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch available skills
    fetch('/api/skills')
      .then(r => r.json())
      .then(data => {
        setSkills(data.skills || [])
        if (data.skills?.length) setSkillId(data.skills[0].id)
      })
      .catch(() => setError('Failed to load skills'))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || !skillId) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/reflection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, skillId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to start reflection')
        setLoading(false)
        return
      }

      // Navigate to the conversation flow — use the conversation ID as the work ID
      // since the ConversationFlow component will call /api/conversation/start
      // which will detect the existing in-progress conversation and resume it
      router.push(`/conversation/${data.conversationId}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // Group skills by pillar
  const pillars = skills.reduce((acc, s) => {
    if (!acc[s.pillarName]) acc[s.pillarName] = []
    acc[s.pillarName].push(s)
    return acc
  }, {} as Record<string, SkillOption[]>)

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-green-900 mb-1">Create a Reflection</h1>
      <p className="text-sm text-gray-500 mb-6">
        Describe an experience you&apos;d like to reflect on. It doesn&apos;t need to be tied to a specific assignment.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            What happened?
          </label>
          <textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            required
            placeholder="Briefly describe the experience. What was the situation? What did you do? A few sentences is enough — the conversation will help you dig deeper."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Which skill does this relate to?
          </label>
          <div className="space-y-3">
            {Object.entries(pillars).map(([pillarName, pillarSkills]) => (
              <div key={pillarName}>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">
                  {pillarName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {pillarSkills.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSkillId(s.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        skillId === s.id
                          ? 'bg-green-700 text-white border-green-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !description.trim() || !skillId}
          className="w-full py-3 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Starting reflection...' : 'Start Reflection'}
        </button>
      </form>
    </main>
  )
}
