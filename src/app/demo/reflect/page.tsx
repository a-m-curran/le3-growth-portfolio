'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DemoReflectPage() {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return
    setLoading(true)
    // Navigate to a demo conversation after brief loading
    setTimeout(() => {
      router.push('/demo/conversation/work_aja_onboarding?student=stu_aja')
    }, 1500)
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-green-900 mb-1">Reflection</h1>
        <p className="text-sm text-gray-500">
          Something on your mind? Describe what happened and we&apos;ll think through it together.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder="What's been on your mind? Describe something that happened — at school, work, home, anywhere. It doesn't have to be about an assignment."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none bg-white placeholder:text-gray-400"
        />

        <button
          type="submit"
          disabled={loading || !description.trim()}
          className="w-full py-3 bg-green-700 text-white rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Starting...' : 'Let\u2019s talk about it'}
        </button>
      </form>

      {/* Sample past reflections for demo */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Past Reflections (2)
        </h2>
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-white border border-gray-200 opacity-75">
            <h3 className="text-sm font-medium text-gray-900">Had a hard conversation with a classmate about our group project direction</h3>
            <p className="text-xs text-gray-500 mt-1">
              Apr 2 <span className="ml-2 text-green-600">Completed</span>
            </p>
            <p className="text-xs text-gray-500 mt-2 italic">
              You found a way to say what you actually thought without blowing up the relationship. That pause before you spoke...
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-gray-200 opacity-75">
            <h3 className="text-sm font-medium text-gray-900">My daughter asked me why I go to school and I didn&apos;t have a quick answer</h3>
            <p className="text-xs text-gray-500 mt-1">
              Mar 28 <span className="ml-2 text-green-600">Completed</span>
            </p>
            <p className="text-xs text-gray-500 mt-2 italic">
              The answer you gave her wasn&apos;t rehearsed — it came from somewhere real. You told her you&apos;re learning how to finish things...
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
