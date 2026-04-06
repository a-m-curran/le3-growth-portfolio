'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const WORK_TYPES = [
  { value: 'essay', label: 'Essay' },
  { value: 'project', label: 'Project' },
  { value: 'discussion_post', label: 'Discussion Post' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'exam', label: 'Exam' },
  { value: 'lab_report', label: 'Lab Report' },
  { value: 'portfolio_piece', label: 'Portfolio Piece' },
  { value: 'other', label: 'Other' },
]

export default function SubmitWorkPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [workType, setWorkType] = useState('essay')
  const [courseName, setCourseName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/work/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, workType, courseName }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to submit work')
        setLoading(false)
        return
      }

      router.push('/conversation')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-green-900 mb-1">Submit Work</h1>
      <p className="text-sm text-gray-500 mb-6">
        Add a piece of work you&apos;d like to reflect on in a growth conversation.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Research Paper on Climate Policy"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="workType" className="block text-sm font-medium text-gray-700 mb-1">
            Type of Work
          </label>
          <select
            id="workType"
            value={workType}
            onChange={e => setWorkType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
          >
            {WORK_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="courseName" className="block text-sm font-medium text-gray-700 mb-1">
            Course Name <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="courseName"
            type="text"
            value={courseName}
            onChange={e => setCourseName(e.target.value)}
            placeholder="e.g. ENV 301"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Brief Description <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="What was this work about? What were you trying to do?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !title}
          className="w-full py-3 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : 'Submit & Start Reflection'}
        </button>
      </form>
    </main>
  )
}
