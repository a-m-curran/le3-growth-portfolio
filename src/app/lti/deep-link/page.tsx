'use client'

import { useState } from 'react'

/**
 * Instructor-facing form shown during an LTI deep linking flow.
 *
 * When an instructor adds the Growth Portfolio as a resource in a Brightspace
 * assignment, Brightspace redirects them to /api/lti/launch, which verifies
 * the deep linking request JWT and then redirects here.
 *
 * The instructor pastes the assignment title and instructions. We store them
 * tied to a resource_link_id, then post back to Brightspace so the link
 * appears in the course.
 */
export default function DeepLinkPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [returnedHtml, setReturnedHtml] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/lti/deep-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        setError(data.error || 'Submission failed')
        setLoading(false)
        return
      }

      // The API returns an auto-submitting HTML form that posts back
      // to Brightspace. We inject it into the document and let it run.
      const html = await res.text()
      setReturnedHtml(html)
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  // Once we have the returned HTML, replace the document body with it so
  // the auto-submit form runs and posts back to Brightspace.
  if (returnedHtml) {
    return (
      <div
        ref={node => {
          if (node && returnedHtml) {
            const range = document.createRange()
            range.selectNode(node)
            const fragment = range.createContextualFragment(returnedHtml)
            node.innerHTML = ''
            node.appendChild(fragment)
          }
        }}
      />
    )
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-green-900 mb-1">Embed Assignment</h1>
      <p className="text-sm text-gray-500 mb-6">
        Paste your assignment instructions below. When students click this link
        in your course, they&apos;ll be asked to reflect on their submission using
        these instructions as context.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Assignment Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            placeholder="e.g. Week 3 Discussion: Power Dynamics"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
            Assignment Instructions <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="body"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={10}
            placeholder="Paste the assignment prompt here. The AI will use this to ask specific questions about the student's work."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            Tip: Copy the instructions from your assignment description in Brightspace.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="w-full py-3 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Embedding...' : 'Add to Course'}
        </button>
      </form>
    </main>
  )
}
