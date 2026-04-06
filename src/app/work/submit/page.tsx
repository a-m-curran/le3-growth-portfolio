'use client'

import { useState, useRef } from 'react'
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

const ACCEPTED_TYPES = '.pdf,.docx,.txt,.md'

export default function SubmitWorkPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [workType, setWorkType] = useState('essay')
  const [courseName, setCourseName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null
    if (selected && selected.size > 4 * 1024 * 1024) {
      setError('File too large. Maximum size is 4MB.')
      setFile(null)
      return
    }
    setError(null)
    setFile(selected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      formData.append('workType', workType)
      formData.append('courseName', courseName)
      if (file) {
        formData.append('file', file)
      }

      const res = await fetch('/api/work/submit', {
        method: 'POST',
        body: formData,
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

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Upload Your Work <span className="text-gray-400">(optional)</span>
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`w-full px-4 py-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
              file
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-green-400 hover:bg-green-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div>
                <p className="text-sm font-medium text-green-800">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(file.size / 1024).toFixed(0)} KB &middot;{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">
                  Click to upload a PDF, Word doc, or text file
                </p>
                <p className="text-xs text-gray-400 mt-1">Max 4MB &middot; PDF, DOCX, TXT, MD</p>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Text is extracted so the AI can ask you more specific questions about your work.
          </p>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Brief Description <span className="text-gray-400">(optional if file uploaded)</span>
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
          {loading ? (file ? 'Uploading & processing...' : 'Submitting...') : 'Submit & Start Reflection'}
        </button>
      </form>
    </main>
  )
}
