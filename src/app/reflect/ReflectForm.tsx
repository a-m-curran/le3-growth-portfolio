'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ReflectForm() {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/reflect/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      router.push(`/conversation/${data.conversationId}`)
    } catch {
      setError('Failed to connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={4}
        placeholder="What's been on your mind? Describe something that happened — at school, work, home, anywhere. It doesn't have to be about an assignment."
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none bg-white placeholder:text-gray-400"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !description.trim()}
        className="w-full py-3 bg-green-700 text-white rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Starting...' : 'Let\u2019s talk about it'}
      </button>
    </form>
  )
}
