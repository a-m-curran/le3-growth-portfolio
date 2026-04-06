'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface CoachOption {
  id: string
  name: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nluId, setNluId] = useState('')
  const [coachId, setCoachId] = useState('')
  const [coaches, setCoaches] = useState<CoachOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/onboarding/coaches')
      .then(r => r.json())
      .then(data => {
        setCoaches(data.coaches || [])
        if (data.coaches?.length) setCoachId(data.coaches[0].id)
      })
      .catch(() => setError('Failed to load coaches'))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, nluId, coachId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create account')
        setLoading(false)
        return
      }

      router.push('/garden')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-green-50 px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-green-900">Welcome to LE3</h1>
          <p className="text-sm text-gray-600 mt-2">
            Set up your Growth Portfolio to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block text-xs font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-xs font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="nluId" className="block text-xs font-medium text-gray-700 mb-1">
              NLU Student ID
            </label>
            <input
              id="nluId"
              type="text"
              value={nluId}
              onChange={e => setNluId(e.target.value)}
              placeholder="e.g. N00123456"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="coach" className="block text-xs font-medium text-gray-700 mb-1">
              Your Coach
            </label>
            <select
              id="coach"
              value={coachId}
              onChange={e => setCoachId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
            >
              {coaches.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !firstName || !lastName || !nluId || !coachId}
            className="w-full py-3 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create My Portfolio'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center">
          If you&apos;re a coach, please contact your administrator to set up your account.
        </p>
      </div>
    </main>
  )
}
